// ============================================================
// طبقة البيانات المشتركة بين كل تبويبات الموقع
// تجلب الترتيب الرسمي من مصدر الدوري الحقيقي (مع fallback
// إلى data/league.json) وتحتفظ بإحصاءات الهدافين والصناعات
// محلياً من "مركز المباراة".
// ============================================================

const STORAGE_KEY = 'jo_match_history';
const JFA_PROXY_URL = 'https://api.allorigins.win/raw?url=';

const Store = {
  base: null, // محتوى league.json كما هو

  async load() {
    const res = await fetch('data/league.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('تعذر تحميل بيانات الدوري');
    this.base = await res.json();
    await this.loadOfficialStandings();
    return this.base;
  },

  async loadOfficialStandings() {
    const sourceUrl = this.base?.source_url;
    if (!sourceUrl) return;

    try {
      const res = await fetch(`${JFA_PROXY_URL}${encodeURIComponent(sourceUrl)}`, { cache: 'no-store' });
      if (!res.ok) return;

      const html = await res.text();
      const extracted = this.extractOfficialStandingsFromHtml(html);
      if (!extracted.length) return;

      const byTeamId = {};
      extracted.forEach(row => { byTeamId[row.team_id] = row; });

      this.base.standings = this.base.standings.map(row => byTeamId[row.team_id] || row);
      this.base.season_started = this.base.standings.some(r => r.played > 0);
      this.base.last_updated = new Date().toISOString().slice(0, 10);
    } catch {
      // fallback على بيانات JSON المحلية
    }
  },

  normalizeTeamName(name) {
    return (name || '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ');
  },

  pickStatsFromNumbers(nums) {
    const patterns = [
      { played: -7, won: -6, drawn: -5, lost: -4, gf: -3, ga: -2, points: -1 }, // بدون فارق أهداف
      { played: -8, won: -7, drawn: -6, lost: -5, gf: -4, ga: -3, points: -1 }  // مع عمود فارق الأهداف
    ];

    const getByOffset = (arr, offset) => arr[arr.length + offset];
    for (const p of patterns) {
      if (nums.length < Math.abs(p.played)) continue;
      const played = getByOffset(nums, p.played);
      const won = getByOffset(nums, p.won);
      const drawn = getByOffset(nums, p.drawn);
      const lost = getByOffset(nums, p.lost);
      const gf = getByOffset(nums, p.gf);
      const ga = getByOffset(nums, p.ga);
      const points = getByOffset(nums, p.points);
      if ([played, won, drawn, lost, gf, ga, points].some(n => Number.isNaN(n))) continue;
      if (played < 0 || won < 0 || drawn < 0 || lost < 0 || gf < 0 || ga < 0 || points < 0) continue;
      if (won + drawn + lost !== played) continue;
      if (points > played * 3) continue;
      return { played, won, drawn, lost, gf, ga, points };
    }

    return null;
  },

  extractOfficialStandingsFromHtml(html) {
    if (!html || typeof DOMParser === 'undefined') return [];

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rows = [...doc.querySelectorAll('tr')];
    const teamIndex = this.base.teams.map(team => ({
      team,
      norm: this.normalizeTeamName(team.name)
    }));
    const found = {};

    rows.forEach(row => {
      const cells = [...row.querySelectorAll('td')];
      if (!cells.length) return;

      const texts = cells.map(c => c.textContent.trim()).filter(Boolean);
      const nums = texts
        .map(t => parseInt((t.match(/-?\d+/) || [])[0], 10))
        .filter(n => !Number.isNaN(n));
      const stats = this.pickStatsFromNumbers(nums);
      if (!stats) return;

      let matchedTeam = null;
      let bestLen = 0;
      texts.forEach(text => {
        const normText = this.normalizeTeamName(text);
        if (!normText) return;
        teamIndex.forEach(entry => {
          if (normText.includes(entry.norm) || entry.norm.includes(normText)) {
            if (entry.norm.length > bestLen) {
              bestLen = entry.norm.length;
              matchedTeam = entry.team;
            }
          }
        });
      });

      if (!matchedTeam || found[matchedTeam.id]) return;
      found[matchedTeam.id] = { team_id: matchedTeam.id, ...stats };
    });

    return Object.values(found);
  },

  getMatchHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  },

  saveMatch(match) {
    const history = this.getMatchHistory();
    history.push(match);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  },

  clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
  },

  teamById(id) {
    return this.base.teams.find(t => t.id === id);
  },

  // يعرض الترتيب الرسمي كما يأتي من مصدر الدوري الحقيقي
  computeStandings() {
    const rows = this.base.standings.map(row => ({
      ...row,
      team: this.teamById(row.team_id)
    }));

    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = a.gf - a.ga, gdB = b.gf - b.ga;
      if (gdB !== gdA) return gdB - gdA;
      return b.gf - a.gf;
    });

    return rows;
  },

  // يجمع الهدافين وصناع الأهداف من كل الأحداث المسجّلة بالمباريات المحفوظة
  computeGoalContributions() {
    const goals = {};   // player -> { player, team_id, goals }
    const assists = {}; // player -> { player, team_id, assists }

    const bump = (map, key, teamId) => {
      if (!key) return;
      if (!map[key]) map[key] = { player: key, team_id: teamId, count: 0 };
      map[key].count++;
    };

    this.getMatchHistory().forEach(m => {
      (m.events || []).forEach(ev => {
        if (ev.type !== 'goal') return;
        const teamId = ev.side === 'home' ? m.home_id : m.away_id;
        if (ev.scorer) bump(goals, ev.scorer.trim(), teamId);
        if (ev.assist) bump(assists, ev.assist.trim(), teamId);
      });
    });

    const toSortedList = (map) =>
      Object.values(map).sort((a, b) => b.count - a.count);

    return { scorers: toSortedList(goals), assists: toSortedList(assists) };
  }
};
