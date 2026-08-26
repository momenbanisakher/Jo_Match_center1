// ============================================================
// طبقة البيانات المشتركة بين كل تبويبات الموقع
// تجمع بين قاعدة البيانات الثابتة (data/league.json) وبين
// المباريات المحفوظة محلياً من "مركز المباراة" لتحسب ترتيب
// وهدافين وصناع أهداف محدّثين لحظياً.
// ============================================================

const STORAGE_KEY = 'jo_match_history';

const Store = {
  base: null, // محتوى league.json كما هو

  async load() {
    const res = await fetch('data/league.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('تعذر تحميل بيانات الدوري');
    this.base = await res.json();
    return this.base;
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

  // يحسب الترتيب النهائي = الأرقام الأساسية + كل المباريات المحفوظة محلياً
  computeStandings() {
    const table = {};
    this.base.standings.forEach(s => { table[s.team_id] = { ...s }; });

    this.getMatchHistory().forEach(m => {
      const home = table[m.home_id];
      const away = table[m.away_id];
      if (!home || !away) return;

      home.played++; away.played++;
      home.gf += m.home_score; home.ga += m.away_score;
      away.gf += m.away_score; away.ga += m.home_score;

      if (m.home_score > m.away_score) { home.won++; away.lost++; home.points += 3; }
      else if (m.home_score < m.away_score) { away.won++; home.lost++; away.points += 3; }
      else { home.drawn++; away.drawn++; home.points += 1; away.points += 1; }
    });

    const rows = Object.values(table).map(row => ({
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
