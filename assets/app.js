// ============================================================
// تبويبات الموقع + عرض الترتيب / الهدافين / صناع الأهداف
// ============================================================

const TABS = ['standings', 'scorers', 'assists', 'match-center'];

function badgeHtml(team) {
  return `
    <span class="badge-wrap">
      <img src="${team.logo}" alt="${team.name}" class="badge-img"
           onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
      <span class="badge-fallback" style="background:${team.color}">${team.letter}</span>
    </span>`;
}

/* ---------------- الترتيب ---------------- */
function renderStandings() {
  const rows = Store.computeStandings();
  const tbody = document.getElementById('standingsBody');
  const total = rows.length;

  tbody.innerHTML = rows.map((row, i) => {
    const pos = i + 1;
    const gd = row.gf - row.ga;
    const gdClass = gd > 0 ? 'gd-positive' : gd < 0 ? 'gd-negative' : '';
    const gdText = gd > 0 ? `+${gd}` : `${gd}`;
    const zc = pos === 1 ? 'zone-champion' : pos > total - 2 ? 'zone-relegation' : '';

    return `
      <tr class="${zc} stagger-row" style="--i:${i}">
        <td class="pos-cell">${zc ? '<span class="zone-bar"></span>' : ''}${pos}</td>
        <td class="team-cell">
          <div class="team-flex">
            ${badgeHtml(row.team)}
            <span>${row.team.name}</span>
          </div>
        </td>
        <td>${row.played}</td>
        <td>${row.won}</td>
        <td>${row.drawn}</td>
        <td>${row.lost}</td>
        <td>${row.gf}</td>
        <td>${row.ga}</td>
        <td class="${gdClass}">${gdText}</td>
        <td class="points-cell">${row.points}</td>
      </tr>`;
  }).join('');

  const statusEl = document.getElementById('seasonStatus');
  if (!Store.base.season_started) {
    statusEl.innerHTML = `<strong>الموسم ${Store.base.season}</strong> لم ينطلق بعد رسمياً حسب مصدر الدوري.`;
  } else {
    statusEl.innerHTML = `<strong>الموسم ${Store.base.season}</strong> — الترتيب رسمي من مصدر الدوري الحقيقي (${Store.base.source || 'jfa.jo'}).`;
  }
}

/* ---------------- الهدافين / صناع الأهداف ---------------- */
function renderContributionTable(list, tbodyId, emptyMsg, unitLabel) {
  const tbody = document.getElementById(tbodyId);
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">${emptyMsg}</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((row, i) => {
    const team = Store.teamById(row.team_id);
    return `
      <tr class="stagger-row" style="--i:${i}">
        <td class="pos-cell">${i + 1}</td>
        <td class="team-cell">
          <div class="team-flex">
            ${team ? badgeHtml(team) : ''}
            <span>${row.player}</span>
          </div>
        </td>
        <td class="team-name-cell">${team ? team.name : '—'}</td>
        <td class="points-cell">${row.count} <span class="unit">${unitLabel}</span></td>
      </tr>`;
  }).join('');
}

function renderScorersAndAssists() {
  const { scorers, assists } = Store.computeGoalContributions();
  renderContributionTable(scorers, 'scorersBody', 'ما فيه أهداف مسجّلة بعد — سجّل مباراة من مركز المباراة.', 'هدف');
  renderContributionTable(assists, 'assistsBody', 'ما فيه صناعات أهداف مسجّلة بعد.', 'صناعة');
}

/* ---------------- إعادة الحساب بعد كل مباراة ---------------- */
function refreshAllTables() {
  renderStandings();
  renderScorersAndAssists();
}
window.refreshAllTables = refreshAllTables;

/* ---------------- التبويبات ---------------- */
function initTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  const indicator = document.getElementById('tabIndicator');
  const panels = document.querySelectorAll('.tab-panel');

  function moveIndicator(btn) {
    indicator.style.width = btn.offsetWidth + 'px';
    indicator.style.left = btn.offsetLeft + 'px';
  }

  function activate(tabId) {
    buttons.forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    panels.forEach(p => {
      if (p.id === 'panel-' + tabId) {
        p.classList.remove('hidden');
        requestAnimationFrame(() => p.classList.add('panel-in'));
      } else {
        p.classList.remove('panel-in');
        p.classList.add('hidden');
      }
    });
    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (activeBtn) moveIndicator(activeBtn);
    localStorage.setItem('jo_active_tab', tabId);
  }

  buttons.forEach(btn => {
    btn.addEventListener('click', () => activate(btn.dataset.tab));
  });

  window.addEventListener('resize', () => {
    const activeBtn = document.querySelector('.tab-btn.active');
    if (activeBtn) moveIndicator(activeBtn);
  });

  const saved = localStorage.getItem('jo_active_tab');
  activate(TABS.includes(saved) ? saved : 'standings');
}

/* ---------------- بدء التشغيل ---------------- */
async function init() {
  try {
    await Store.load();
    refreshAllTables();
    if (window.initMatchCenter) window.initMatchCenter();
    initTabs();
  } catch (err) {
    console.error(err);
    document.getElementById('standingsBody').innerHTML =
      `<tr><td colspan="10" class="empty-state">تعذر تحميل بيانات الدوري حالياً.</td></tr>`;
  }
}

document.addEventListener('DOMContentLoaded', init);
