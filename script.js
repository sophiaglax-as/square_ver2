const SERVICE_URL = 'https://script.google.com/macros/s/AKfycbxS4GIYSVX9c_CCiUBS9EPS7NS83p61CZDNrQ1e2Lz4273SxhDxcgL82VSaQCVTa_sh/exec';

const CATEGORIES = [
  '右キャッチ',
  '右パス',
  '左キャッチ',
  '左パス',
  '右グラボ',
  '左グラボ',
  'ステーションパス',
  'ステーションキャッチ'
];

let allPlayers = [];
let activePlayers = [];

let currentViewerId =
  localStorage.getItem('square_current_viewer') || '';

let selectedMistakePlayerId = '';
let selectedCategory = '';
let teamSuccessCount = 0;

const $ = id => document.getElementById(id);

init();

async function init() {
  setToday();
  bindEvents();
  renderSuccessCounter();

  try {
    await loadPlayers();
    renderAll();
  } catch (e) {
    showMsg(e.message || String(e), 'err');
  }
}

function bindEvents() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  $('btnSettings').onclick = openSettings;
  $('btnCloseSettings').onclick = closeSettings;

  $('btnAddPlayer').onclick = addPlayer;

  $('btnSendMistake').onclick = sendMistake;

  $('btnSuccessMinus').onclick = () => {
    teamSuccessCount = Math.max(0, teamSuccessCount - 1);
    renderSuccessCounter();
  };

  $('btnSuccessPlus').onclick = () => {
    teamSuccessCount++;
    renderSuccessCounter();
  };

  $('btnSaveSuccess').onclick = saveSuccess;

  $('btnRefreshReport').onclick = loadReport;
  $('btnSaveImage').onclick = saveReportImage;

  $('btnDeleteMistakes').onclick = deleteSelectedMistakes;
  $('btnDeleteSuccesses').onclick = deleteSelectedSuccesses;

  $('inputDate').onchange = () => {
    $('reportDate').value = $('inputDate').value;
  };

  $('reportDate').onchange = loadReport;
}

function setToday() {
  const d = new Date();
  const date =
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  $('inputDate').value = date;
  $('reportDate').value = date;
}

async function apiGet(action, params = {}) {
  const url = new URL(SERVICE_URL);

  url.searchParams.set('action', action);

  Object.entries(params).forEach(([k, v]) => {
    if (v !== '' && v !== undefined && v !== null) {
      url.searchParams.set(k, v);
    }
  });

  const r = await fetch(url.toString());

  if (!r.ok) {
    throw new Error(`通信に失敗しました (${r.status})`);
  }

  const j = await r.json();

  if (!j.ok) {
    throw new Error(j.error || 'APIエラー');
  }

  return j;
}

async function apiPost(action, data = {}) {
  const r = await fetch(SERVICE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      action,
      data
    })
  });

  if (!r.ok) {
    throw new Error(`通信に失敗しました (${r.status})`);
  }

  const j = await r.json();

  if (!j.ok) {
    throw new Error(j.error || 'APIエラー');
  }

  return j;
}

function showMsg(text, type = 'ok') {
  const el = $('msg');
  el.textContent = text;
  el.className = `msg show ${type}`;

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

function clearMsg() {
  const el = $('msg');
  el.textContent = '';
  el.className = 'msg';
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  $('panelViewer').classList.toggle('active', tab === 'viewer');
  $('panelInput').classList.toggle('active', tab === 'input');
  $('panelReport').classList.toggle('active', tab === 'report');

  if (tab === 'report') {
    loadReport();
  }
}

async function loadPlayers() {
  const j = await apiGet('getPlayers', {
    includeHidden: 'true'
  });

  allPlayers =
    Array.isArray(j.players)
      ? j.players
      : [];

  activePlayers =
    allPlayers.filter(
      p => p.status === 'active'
    );

  if (
    currentViewerId &&
    !activePlayers.some(
      p => p.playerId === currentViewerId
    )
  ) {
    currentViewerId = '';
  }

  saveViewer();
}

function saveViewer() {
  if (currentViewerId) {
    localStorage.setItem(
      'square_current_viewer',
      currentViewerId
    );
  } else {
    localStorage.removeItem(
      'square_current_viewer'
    );
  }
}

function renderAll() {
  renderViewer();
  renderMistakePlayers();
  renderCategories();
  renderInputSummary();
  renderSettingsPlayers();
}

function playerName(id) {
  const p =
    allPlayers.find(
      x => x.playerId === id
    );

  return p ? p.name : '';
}

function renderViewer() {
  const current =
    activePlayers.find(
      p => p.playerId === currentViewerId
    );

  $('currentViewer').textContent =
    current
      ? current.name
      : '未選択';

  $('inputViewer').textContent =
    current
      ? current.name
      : '未選択';

  if (!activePlayers.length) {
    $('viewerGrid').innerHTML =
      '<div class="empty">表示中の選手がいません。設定から選手を登録してください。</div>';

    return;
  }

  $('viewerGrid').innerHTML =
    activePlayers.map(p => `
      <button
        class="playerBtn ${p.playerId === currentViewerId ? 'selected' : ''}"
        data-viewer="${esc(p.playerId)}"
      >
        ${esc(p.name)}
        <span class="sub">${esc(p.position || '')}</span>
      </button>
    `).join('');

  $('viewerGrid')
    .querySelectorAll('[data-viewer]')
    .forEach(btn => {

      btn.onclick =
        async () => {

          clearMsg();

          currentViewerId =
            btn.dataset.viewer;

          saveViewer();
          renderViewer();

          try {
            await apiPost(
              'recordSessionViewer',
              {
                date: $('inputDate').value,
                playerId: currentViewerId
              }
            );

            showMsg(
              `「${playerName(currentViewerId)}」を今日の集計対象として記録しました。`,
              'ok'
            );

          } catch (e) {
            showMsg(
              e.message || String(e),
              'err'
            );
          }
        };
    });
}

function renderMistakePlayers() {
  if (!activePlayers.length) {
    $('mistakeGrid').innerHTML =
      '<div class="empty">表示中の選手がいません。</div>';

    return;
  }

  $('mistakeGrid').innerHTML =
    activePlayers.map(p => `
      <button
        class="playerBtn ${p.playerId === selectedMistakePlayerId ? 'selected' : ''}"
        data-mistake="${esc(p.playerId)}"
      >
        ${esc(p.name)}
        <span class="sub">${esc(p.position || '')}</span>
      </button>
    `).join('');

  $('mistakeGrid')
    .querySelectorAll('[data-mistake]')
    .forEach(btn => {

      btn.onclick =
        () => {
          selectedMistakePlayerId =
            btn.dataset.mistake;

          renderMistakePlayers();
          renderInputSummary();
        };
    });
}

function renderCategories() {
  $('categoryGrid').innerHTML =
    CATEGORIES.map(c => `
      <button
        class="catBtn ${c === selectedCategory ? 'selected' : ''}"
        data-category="${esc(c)}"
      >
        ${esc(c)}
      </button>
    `).join('');

  $('categoryGrid')
    .querySelectorAll('[data-category]')
    .forEach(btn => {

      btn.onclick =
        () => {
          selectedCategory =
            btn.dataset.category;

          renderCategories();
          renderInputSummary();
        };
    });
}

function renderInputSummary() {
  $('summaryPlayer').textContent =
    playerName(selectedMistakePlayerId) || '-';

  $('summaryCategory').textContent =
    selectedCategory || '-';
}

function renderSuccessCounter() {
  $('successValue').textContent =
    `${teamSuccessCount}回`;
}

async function sendMistake() {
  clearMsg();

  const date =
    $('inputDate').value;

  if (!date) {
    return showMsg(
      '日付を入力してください。',
      'err'
    );
  }

  if (!currentViewerId) {
    return showMsg(
      '先に「今見ている選手」を選択してください。',
      'err'
    );
  }

  if (!selectedMistakePlayerId) {
    return showMsg(
      'ミスした選手を選択してください。',
      'err'
    );
  }

  if (!selectedCategory) {
    return showMsg(
      'ミスカテゴリーを選択してください。',
      'err'
    );
  }

  const btn =
    $('btnSendMistake');

  btn.disabled = true;

  try {

    await apiPost(
      'addMistake',
      {
        date,
        viewerPlayerId: currentViewerId,
        playerId: selectedMistakePlayerId,
        category: selectedCategory
      }
    );

    showMsg(
      `登録しました：${playerName(selectedMistakePlayerId)} / ${selectedCategory}`,
      'ok'
    );

    selectedMistakePlayerId = '';
    selectedCategory = '';

    renderMistakePlayers();
    renderCategories();
    renderInputSummary();

  } catch (e) {

    showMsg(
      e.message || String(e),
      'err'
    );

  } finally {

    btn.disabled = false;

  }
}

async function saveSuccess() {
  clearMsg();

  const date =
    $('inputDate').value;

  if (!date) {
    return showMsg(
      '日付を入力してください。',
      'err'
    );
  }

  if (teamSuccessCount <= 0) {
    return showMsg(
      '1回以上の連続成功回数を入力してください。',
      'err'
    );
  }

  const btn =
    $('btnSaveSuccess');

  btn.disabled = true;

  try {

    await apiPost(
      'addTeamSuccess',
      {
        date,
        successCount: teamSuccessCount
      }
    );

    showMsg(
      `チーム連続成功「${teamSuccessCount}回」を記録しました。`,
      'ok'
    );

    teamSuccessCount = 0;

    renderSuccessCounter();

  } catch (e) {

    showMsg(
      e.message || String(e),
      'err'
    );

  } finally {

    btn.disabled = false;

  }
}

async function loadReport() {
  clearMsg();

  const date =
    $('reportDate').value;

  if (!date) {
    return;
  }

  $('reportImageDate').textContent =
    date.replaceAll('-', '/');

  try {

    const [
      summaryResult,
      successResult,
      rawMistakeResult,
      rawSuccessResult
    ] =
      await Promise.all([
        apiGet(
          'getMistakeSummary',
          { date }
        ),
        apiGet(
          'getTeamSuccesses',
          { date }
        ),
        apiGet(
          'getMistakesForDate',
          { date }
        ),
        apiGet(
          'getTeamSuccessesForDate',
          { date }
        )
      ]);

    renderMistakeSummary(
      summaryResult.summary || []
    );

    renderSuccessTop(
      successResult.rows || []
    );

    renderRawMistakes(
      rawMistakeResult.rows || []
    );

    renderRawSuccesses(
      rawSuccessResult.rows || []
    );

  } catch (e) {

    showMsg(
      e.message || String(e),
      'err'
    );

  }
}

function renderMistakeSummary(summary) {
  const table =
    $('mistakeSummaryTable');

  if (!summary.length) {
    table.innerHTML =
      '<tbody><tr><td class="empty">この日の集計対象者がいません。</td></tr></tbody>';

    return;
  }

  const categories =
    CATEGORIES.filter(c =>
      summary.some(
        row =>
          (row.categories?.[c] || 0) > 0
      )
    );

  table.innerHTML = `
    <thead>
      <tr>
        <th class="left">選手</th>
        ${categories.map(c =>
          `<th>${esc(c)}</th>`
        ).join('')}
        <th>合計</th>
      </tr>
    </thead>

    <tbody>
      ${summary.map(row => `
        <tr>
          <td class="left">${esc(row.name)}</td>

          ${categories.map(c =>
            `<td>${row.categories?.[c] || 0}</td>`
          ).join('')}

          <td><strong>${row.total || 0}</strong></td>
        </tr>
      `).join('')}
    </tbody>
  `;
}

function renderSuccessTop(rows) {
  const el =
    $('successTopList');

  if (!rows.length) {
    el.innerHTML =
      '<div class="empty">この日の連続成功記録はありません。</div>';

    return;
  }

  el.innerHTML =
    rows.slice(0, 10)
      .map((row, index) => `
        <div class="topItem">
          <span class="topRank">
            トップ${index + 1}
          </span>
          <span class="topValue">
            ${row.successCount}回
          </span>
        </div>
      `)
      .join('');
}

function renderRawMistakes(rows) {
  const el =
    $('rawMistakeList');

  if (!rows.length) {
    el.innerHTML =
      '<div class="empty">この日のミス入力はありません。</div>';

    return;
  }

  el.innerHTML =
    rows.map(row => `
      <label class="rawItem">
        <input
          type="checkbox"
          data-mistake-id="${esc(row.recordId)}"
        >

        <div class="rawMain">
          <strong>
            ${esc(row.playerName)} / ${esc(row.category)}
          </strong>

          <div class="rawMeta">
            見ていた人：${esc(row.viewerName)}
            ・${esc(formatTime(row.timestamp))}
          </div>
        </div>

        <span>選択</span>
      </label>
    `).join('');
}

function renderRawSuccesses(rows) {
  const el =
    $('rawSuccessList');

  if (!rows.length) {
    el.innerHTML =
      '<div class="empty">この日の連続成功記録はありません。</div>';

    return;
  }

  el.innerHTML =
    rows.map(row => `
      <label class="rawItem">
        <input
          type="checkbox"
          data-success-id="${esc(row.recordId)}"
        >

        <div class="rawMain">
          <strong>
            ${row.successCount}回
          </strong>

          <div class="rawMeta">
            ${esc(formatTime(row.timestamp))}
          </div>
        </div>

        <span>選択</span>
      </label>
    `).join('');
}

async function deleteSelectedMistakes() {
  const ids =
    [
      ...document.querySelectorAll(
        '[data-mistake-id]:checked'
      )
    ]
      .map(x => x.dataset.mistakeId)
      .filter(Boolean);

  if (!ids.length) {
    return showMsg(
      '削除するミス入力を選択してください。',
      'err'
    );
  }

  if (
    !confirm(
      `${ids.length}件のミス入力を削除します。よろしいですか？`
    )
  ) {
    return;
  }

  try {

    await apiPost(
      'deleteMistakesById',
      { recordIds: ids }
    );

    showMsg(
      `${ids.length}件のミス入力を削除しました。`,
      'ok'
    );

    await loadReport();

  } catch (e) {

    showMsg(
      e.message || String(e),
      'err'
    );

  }
}

async function deleteSelectedSuccesses() {
  const ids =
    [
      ...document.querySelectorAll(
        '[data-success-id]:checked'
      )
    ]
      .map(x => x.dataset.successId)
      .filter(Boolean);

  if (!ids.length) {
    return showMsg(
      '削除する連続成功記録を選択してください。',
      'err'
    );
  }

  if (
    !confirm(
      `${ids.length}件の連続成功記録を削除します。よろしいですか？`
    )
  ) {
    return;
  }

  try {

    await apiPost(
      'deleteTeamSuccessesById',
      { recordIds: ids }
    );

    showMsg(
      `${ids.length}件の連続成功記録を削除しました。`,
      'ok'
    );

    await loadReport();

  } catch (e) {

    showMsg(
      e.message || String(e),
      'err'
    );

  }
}

async function saveReportImage() {
  clearMsg();

  try {

    const canvas =
      await html2canvas(
        $('reportCanvas'),
        {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true
        }
      );

    canvas.toBlob(
      async blob => {

        if (!blob) {
          return showMsg(
            '画像の作成に失敗しました。',
            'err'
          );
        }

        const filename =
          `square_${$('reportDate').value}.png`;

        const file =
          new File(
            [blob],
            filename,
            { type: 'image/png' }
          );

        if (
          navigator.share &&
          navigator.canShare &&
          navigator.canShare({
            files: [file]
          })
        ) {

          try {
            await navigator.share({
              title: 'スクエア集計',
              files: [file]
            });

            return;

          } catch (e) {
            // 共有を閉じた場合は下のダウンロードへ
          }
        }

        const url =
          URL.createObjectURL(blob);

        const a =
          document.createElement('a');

        a.href = url;
        a.download = filename;

        document.body.appendChild(a);
        a.click();
        a.remove();

        setTimeout(
          () => URL.revokeObjectURL(url),
          1000
        );
      },
      'image/png'
    );

  } catch (e) {

    showMsg(
      '画像の作成に失敗しました。',
      'err'
    );

  }
}

function formatTime(value) {
  if (!value) {
    return '-';
  }

  const d =
    new Date(value);

  if (isNaN(d.getTime())) {
    return String(value);
  }

  return d.toLocaleTimeString(
    'ja-JP',
    {
      hour: '2-digit',
      minute: '2-digit'
    }
  );
}

function openSettings() {
  renderSettingsPlayers();

  $('settingsModal')
    .classList
    .remove('hiddenEl');
}

function closeSettings() {
  $('settingsModal')
    .classList
    .add('hiddenEl');
}

function renderSettingsPlayers() {
  const el =
    $('settingsPlayers');

  if (!allPlayers.length) {
    el.innerHTML =
      '<div class="empty">選手が登録されていません。</div>';

    return;
  }

  el.innerHTML =
    allPlayers.map(p => {

      const isActive =
        p.status === 'active';

      return `
        <div class="settingCard">
          <div class="settingHead">
            <div>
              <strong>${esc(p.name)}</strong>
              <div class="sub">
                ${esc(p.position || '-')}
              </div>
            </div>

            <span class="badge ${isActive ? 'active' : 'hidden'}">
              ${isActive ? '表示中' : '非表示'}
            </span>
          </div>

          <button
            class="smallBtn ${isActive ? 'danger' : 'secondary'}"
            style="margin-top:9px"
            data-toggle-player="${esc(p.playerId)}"
            data-next-status="${isActive ? 'hidden' : 'active'}"
          >
            ${isActive ? '非表示にする' : '表示状態に戻す'}
          </button>
        </div>
      `;
    }).join('');

  el
    .querySelectorAll('[data-toggle-player]')
    .forEach(btn => {

      btn.onclick =
        async () => {

          try {

            await apiPost(
              'updatePlayerStatus',
              {
                playerId:
                  btn.dataset.togglePlayer,

                status:
                  btn.dataset.nextStatus
              }
            );

            await loadPlayers();

            renderAll();

            showMsg(
              '選手の表示状態を更新しました。',
              'ok'
            );

          } catch (e) {

            showMsg(
              e.message || String(e),
              'err'
            );

          }
        };
    });
}

async function addPlayer() {
  clearMsg();

  const name =
    $('newPlayerName')
      .value
      .trim();

  const position =
    $('newPlayerPosition')
      .value;

  if (!name) {
    return showMsg(
      '選手名を入力してください。',
      'err'
    );
  }

  if (!position) {
    return showMsg(
      'ポジションを選択してください。',
      'err'
    );
  }

  const btn =
    $('btnAddPlayer');

  btn.disabled = true;

  try {

    await apiPost(
      'addPlayer',
      {
        name,
        position
      }
    );

    $('newPlayerName').value = '';
    $('newPlayerPosition').value = '';

    await loadPlayers();

    renderAll();

    showMsg(
      '選手を登録しました。',
      'ok'
    );

  } catch (e) {

    showMsg(
      e.message || String(e),
      'err'
    );

  } finally {

    btn.disabled = false;

  }
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
