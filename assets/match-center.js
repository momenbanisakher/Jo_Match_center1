// ============================================================
// مركز المباراة — نسخة معدّلة من مشروع مؤمن الأصلي (Jo Match Center)
// تستخدم قائمة الفرق الموحدة (10 فرق حقيقية) وتحفظ كل مباراة
// بشكل يغذي تلقائياً الترتيب والهدافين وصناع الأهداف.
// ============================================================

let mcState = {
  scores: { home: 0, away: 0 },
  cards: { home: { y: 0, r: 0 }, away: { y: 0, r: 0 } },
  timeInSec: 0,
  phaseIdx: 0,
  events: [] // {type:'goal'|'yellow'|'red', side, minute, scorer, assist}
};

const mcPhases = ['الشوط الأول', 'استراحة', 'الشوط الثاني', 'نهاية المباراة'];
let mcTimer = null;
let mcRunning = false;
let mcAnimTimeout = null;

function mcTeam(side) {
  const sel = document.getElementById(side === 'home' ? 'home-select' : 'away-select');
  return Store.teamById(parseInt(sel.value, 10));
}

function mcFormatMinute() {
  return `${Math.floor(mcState.timeInSec / 60)}'`;
}

function mcLogEvent(icon, text) {
  const list = document.getElementById('events-list');
  const div = document.createElement('div');
  div.className = 'event-item';
  div.innerHTML = `<span class="event-time">${mcFormatMinute()}</span><span class="event-detail">${icon} ${text}</span>`;
  list.prepend(div);
}

function mcUpdateTeams() {
  const home = mcTeam('home');
  const away = mcTeam('away');

  document.getElementById('home-name').innerText = home.name;
  document.getElementById('away-name').innerText = away.name;

  const homeImg = document.getElementById('home-logo');
  const awayImg = document.getElementById('away-logo');
  homeImg.src = home.logo; homeImg.onerror = () => { homeImg.style.display = 'none'; };
  awayImg.src = away.logo; awayImg.onerror = () => { awayImg.style.display = 'none'; };

  document.getElementById('home-band').style.background =
    `linear-gradient(90deg, ${home.color}, ${home.color}cc)`;
  document.getElementById('away-band').style.background =
    `linear-gradient(-90deg, ${away.color}, ${away.color}cc)`;
}

function mcScoreGoal(side) {
  const team = mcTeam(side);
  const scorer = prompt('اسم مسجّل الهدف؟ (اتركه فارغاً للتخطي)') || '';
  const assist = scorer ? (prompt('اسم صانع الهدف؟ (اختياري)') || '') : '';

  mcState.scores[side]++;
  document.getElementById(`${side}-score`).innerText = mcState.scores[side];
  document.getElementById(`${side}-score`).classList.remove('pulse');
  void document.getElementById(`${side}-score`).offsetWidth;
  document.getElementById(`${side}-score`).classList.add('pulse');

  mcState.events.push({
    type: 'goal', side, minute: Math.floor(mcState.timeInSec / 60),
    scorer: scorer.trim() || null, assist: assist.trim() || null
  });

  let logText = `هدف ${team.name}`;
  if (scorer) logText += ` — ${scorer}`;
  if (assist) logText += ` (صناعة ${assist})`;
  mcLogEvent('⚽', logText);

  mcPlayGoalAnimation(team);
}

function mcPlayGoalAnimation(team) {
  const wrapper = document.getElementById('goal-anim');
  document.getElementById('anim-bar').style.background = team.color;
  const animImg = document.getElementById('anim-logo');
  animImg.src = team.logo;
  animImg.onerror = () => { animImg.style.display = 'none'; };

  wrapper.className = 'goal-anim-wrapper';
  void wrapper.offsetWidth;
  wrapper.classList.add('play');

  clearTimeout(mcAnimTimeout);
  mcAnimTimeout = setTimeout(() => { wrapper.className = 'goal-anim-wrapper'; }, 3200);
}

function mcEditScore(side, val) {
  if (mcState.scores[side] === 0) return;
  mcState.scores[side] += val;
  document.getElementById(`${side}-score`).innerText = mcState.scores[side];
  for (let i = mcState.events.length - 1; i >= 0; i--) {
    if (mcState.events[i].type === 'goal' && mcState.events[i].side === side) {
      mcState.events.splice(i, 1);
      break;
    }
  }
  mcLogEvent('❌', `إلغاء هدف ${mcTeam(side).name}`);
}

function mcAddCard(side, type, val) {
  const t = type === 'yellow' ? 'y' : 'r';
  mcState.cards[side][t] = Math.max(0, mcState.cards[side][t] + val);
  document.getElementById(`${side}-${t}c`).innerText = mcState.cards[side][t];
  if (val > 0) {
    mcState.events.push({ type, side, minute: Math.floor(mcState.timeInSec / 60) });
    const icon = type === 'yellow' ? '🟨' : '🟥';
    mcLogEvent(icon, `بطاقة ${mcTeam(side).name}`);
  }
}

function mcToggleTimer() {
  const clock = document.getElementById('match-timer');
  const btn = document.getElementById('btn-timer');
  if (mcRunning) {
    clearInterval(mcTimer);
    clock.classList.add('paused');
    btn.innerText = '▶ استئناف';
  } else {
    mcTimer = setInterval(() => {
      mcState.timeInSec++;
      mcUpdateClock();
    }, 1000);
    clock.classList.remove('paused');
    btn.innerText = '⏸ إيقاف';
  }
  mcRunning = !mcRunning;
}

function mcUpdateClock() {
  const m = Math.floor(mcState.timeInSec / 60).toString().padStart(2, '0');
  const s = (mcState.timeInSec % 60).toString().padStart(2, '0');
  document.getElementById('match-timer').innerText = `${m}:${s}`;
}

function mcNextPhase() {
  mcState.phaseIdx = (mcState.phaseIdx + 1) % 4;
  document.getElementById('match-phase').innerText = mcPhases[mcState.phaseIdx];

  if (mcState.phaseIdx === 1) {
    if (mcRunning) mcToggleTimer();
    mcLogEvent('⏱️', 'نهاية الشوط الأول');
  } else if (mcState.phaseIdx === 2) {
    mcState.timeInSec = 45 * 60;
    mcUpdateClock();
    mcLogEvent('▶', 'بداية الشوط الثاني');
  } else if (mcState.phaseIdx === 3) {
    if (mcRunning) mcToggleTimer();
    mcLogEvent('🏁', 'نهاية المباراة');
  }
}

function mcSaveMatch() {
  const home = mcTeam('home');
  const away = mcTeam('away');

  Store.saveMatch({
    date: new Date().toISOString(),
    home_id: home.id,
    away_id: away.id,
    home_score: mcState.scores.home,
    away_score: mcState.scores.away,
    events: mcState.events
  });

  alert('تم حفظ المباراة محلياً، وتحدّثت جداول الهدافين وصناع الأهداف 💾');
  if (window.refreshAllTables) window.refreshAllTables();
}

function mcResetMatch() {
  if (!confirm('هل أنت متأكد من تصفير المباراة الحالية؟')) return;
  clearInterval(mcTimer);
  mcRunning = false;
  mcState = { scores: { home: 0, away: 0 }, cards: { home: { y: 0, r: 0 }, away: { y: 0, r: 0 } }, timeInSec: 0, phaseIdx: 0, events: [] };

  document.getElementById('match-phase').innerText = mcPhases[0];
  document.getElementById('match-timer').classList.add('paused');
  document.getElementById('btn-timer').innerText = '▶ ابدأ / أوقف';
  mcUpdateClock();

  ['home', 'away'].forEach(side => {
    document.getElementById(`${side}-score`).innerText = '0';
    document.getElementById(`${side}-yc`).innerText = '0';
    document.getElementById(`${side}-rc`).innerText = '0';
  });

  document.getElementById('events-list').innerHTML =
    '<div class="event-item event-item-muted">بدأت المباراة</div>';
}

function mcClearAllHistory() {
  if (!confirm('هذا سيمسح كل المباريات المحفوظة على هذا الجهاز (الهدافين وصناع الأهداف). متابعة؟')) return;
  Store.clearHistory();
  if (window.refreshAllTables) window.refreshAllTables();
  alert('تم مسح كل بيانات المباريات المحفوظة.');
}

function initMatchCenter() {
  const hSel = document.getElementById('home-select');
  const aSel = document.getElementById('away-select');
  Store.base.teams.forEach((team, i) => {
    hSel.options.add(new Option(team.name, team.id));
    aSel.options.add(new Option(team.name, team.id));
  });
  hSel.selectedIndex = 0;
  aSel.selectedIndex = 1;

  hSel.addEventListener('change', mcUpdateTeams);
  aSel.addEventListener('change', mcUpdateTeams);

  mcUpdateTeams();
  mcUpdateClock();
}
window.initMatchCenter = initMatchCenter;
