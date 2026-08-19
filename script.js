const SERVICE_URL = 'https://script.google.com/macros/s/AKfycbxX6c1WAWvY7dKWVtqfkKFdjxmN4iwSGUV8pqDXzr2DbALsD7jOx5QhZ2pnyDBHHvY/exec';

const CATEGORIES = [
  '右キャッチ','右パス','左キャッチ','左パス',
  '右グラボ','左グラボ','ステーションパス','ステーションキャッチ'
];

let allPlayers = [];
let activePlayers = [];
let assignedPlayers = [];
let selectedAssignmentIds = new Set();
let selectedMistakePlayerId = '';
let selectedCategory = '';
let teamSuccessCount = 0;

const $ = id => document.getElementById(id);

init();

async function init(){
  setToday();
  bindEvents();
  renderCategories();

  try{
    await loadPlayers();
    await loadAssignments();
    renderAll();
  }catch(e){
    showMsg(e.message || String(e),'err');
  }
}

function bindEvents(){
  document.querySelectorAll('.tab').forEach(btn=>{
    btn.onclick=()=>switchTab(btn.dataset.tab);
  });

  $('btnSettings').onclick=openSettings;
  $('btnCloseSettings').onclick=closeSettings;
  $('btnAddPlayer').onclick=addPlayer;

  $('btnSaveAssignments').onclick=saveAssignments;
  $('btnSendMistake').onclick=sendMistake;

  $('btnSuccessMinus').onclick=()=>{
    teamSuccessCount=Math.max(0,teamSuccessCount-1);
    renderSuccessCounter();
  };

  $('btnSuccessPlus').onclick=()=>{
    teamSuccessCount++;
    renderSuccessCounter();
  };

  $('btnSaveSuccess').onclick=saveSuccess;

  $('btnRefreshReport').onclick=loadReport;
  $('btnSaveImage').onclick=saveReportImage;
  $('btnDeleteMistakes').onclick=deleteSelectedMistakes;
  $('btnDeleteSuccesses').onclick=deleteSelectedSuccesses;

  $('inputDate').onchange=async()=>{
    $('reportDate').value=$('inputDate').value;
    await loadAssignments();
    renderAll();
  };

  $('reportDate').onchange=loadReport;
}

function setToday(){
  const d=new Date();
  const date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  $('inputDate').value=date;
  $('reportDate').value=date;
}

function switchTab(tab){
  document.querySelectorAll('.tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.tab===tab));
  $('panelAssignment').classList.toggle('active',tab==='assignment');
  $('panelInput').classList.toggle('active',tab==='input');
  $('panelReport').classList.toggle('active',tab==='report');

  if(tab==='report') loadReport();
}

async function apiGet(action,params={}){
  const url=new URL(SERVICE_URL);
  url.searchParams.set('action',action);

  Object.entries(params).forEach(([k,v])=>{
    if(v!==''&&v!==undefined&&v!==null)url.searchParams.set(k,v);
  });

  const r=await fetch(url.toString());
  const j=await r.json();

  if(!j.ok)throw new Error(j.error||'APIエラー');

  return j;
}

async function apiPost(action,data={}){
  const r=await fetch(SERVICE_URL,{
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify({action,data})
  });

  const j=await r.json();

  if(!j.ok)throw new Error(j.error||'APIエラー');

  return j;
}

function showMsg(text,type='ok'){
  const el=$('msg');
  el.textContent=text;
  el.className=`msg show ${type}`;
  window.scrollTo({top:0,behavior:'smooth'});
}

async function loadPlayers(){
  const j=await apiGet('getPlayers',{includeHidden:'true'});
  allPlayers=Array.isArray(j.players)?j.players:[];
  activePlayers=allPlayers.filter(p=>p.status==='active');
}

async function loadAssignments(){
  const date=$('inputDate').value;
  const j=await apiGet('getAssignmentsForDate',{date});
  assignedPlayers=Array.isArray(j.players)?j.players:[];
  selectedAssignmentIds=new Set(assignedPlayers.map(p=>p.playerId));

  if(selectedMistakePlayerId&&!assignedPlayers.some(p=>p.playerId===selectedMistakePlayerId)){
    selectedMistakePlayerId='';
  }
}

function renderAll(){
  renderAssignments();
  renderMistakePlayers();
  renderCategories();
  renderInputSummary();
  renderSettingsPlayers();
  renderSuccessCounter();
}

function renderAssignments(){
  const names=assignedPlayers.map(p=>p.name);
  $('assignedSummary').textContent=names.length?names.join('・'):'未登録';
  $('inputAssignedSummary').textContent=names.length?names.join('・'):'未登録';

  if(!activePlayers.length){
    $('assignmentGrid').innerHTML='<div class="empty">設定から選手を登録してください。</div>';
    return;
  }

  $('assignmentGrid').innerHTML=activePlayers.map(p=>`
    <button class="playerBtn ${selectedAssignmentIds.has(p.playerId)?'selected':''}" data-assignment="${esc(p.playerId)}">
      ${esc(p.name)}<span class="sub">${esc(p.position||'')}</span>
    </button>
  `).join('');

  $('assignmentGrid').querySelectorAll('[data-assignment]').forEach(btn=>{
    btn.onclick=()=>{
      const id=btn.dataset.assignment;
      if(selectedAssignmentIds.has(id))selectedAssignmentIds.delete(id);
      else selectedAssignmentIds.add(id);
      renderAssignments();
    };
  });
}

async function saveAssignments(){
  const date=$('inputDate').value;

  try{
    await apiPost('setAssignmentsForDate',{
      date,
      playerIds:[...selectedAssignmentIds]
    });

    await loadAssignments();
    renderAll();

    showMsg('今日の担当を保存しました。','ok');
  }catch(e){
    showMsg(e.message||String(e),'err');
  }
}

function renderMistakePlayers(){
  if(!assignedPlayers.length){
    $('mistakeGrid').innerHTML='<div class="empty">今日の担当がまだ登録されていません。</div>';
    return;
  }

  $('mistakeGrid').innerHTML=assignedPlayers.map(p=>`
    <button class="playerBtn ${p.playerId===selectedMistakePlayerId?'selected':''}" data-mistake="${esc(p.playerId)}">
      ${esc(p.name)}<span class="sub">${esc(p.position||'')}</span>
    </button>
  `).join('');

  $('mistakeGrid').querySelectorAll('[data-mistake]').forEach(btn=>{
    btn.onclick=()=>{
      selectedMistakePlayerId=btn.dataset.mistake;
      renderMistakePlayers();
      renderInputSummary();
    };
  });
}

function renderCategories(){
  $('categoryGrid').innerHTML=CATEGORIES.map(c=>`
    <button class="catBtn ${c===selectedCategory?'selected':''}" data-category="${esc(c)}">${esc(c)}</button>
  `).join('');

  $('categoryGrid').querySelectorAll('[data-category]').forEach(btn=>{
    btn.onclick=()=>{
      selectedCategory=btn.dataset.category;
      renderCategories();
      renderInputSummary();
    };
  });
}

function renderInputSummary(){
  $('summaryPlayer').textContent=playerName(selectedMistakePlayerId)||'-';
  $('summaryCategory').textContent=selectedCategory||'-';
}

function renderSuccessCounter(){
  $('successValue').textContent=`${teamSuccessCount}回`;
}

function playerName(id){
  return allPlayers.find(p=>p.playerId===id)?.name||'';
}

async function sendMistake(){
  const date=$('inputDate').value;

  if(!assignedPlayers.length)return showMsg('先に今日の担当を登録してください。','err');
  if(!selectedMistakePlayerId)return showMsg('ミスした選手を選択してください。','err');
  if(!selectedCategory)return showMsg('ミスカテゴリーを選択してください。','err');

  try{
    await apiPost('addMistake',{
      date,
      playerId:selectedMistakePlayerId,
      category:selectedCategory
    });

    showMsg(`登録しました：${playerName(selectedMistakePlayerId)} / ${selectedCategory}`,'ok');

    selectedMistakePlayerId='';
    selectedCategory='';

    renderMistakePlayers();
    renderCategories();
    renderInputSummary();
  }catch(e){
    showMsg(e.message||String(e),'err');
  }
}

async function saveSuccess(){
  if(teamSuccessCount<=0)return showMsg('1回以上にしてください。','err');

  try{
    await apiPost('addTeamSuccess',{
      date:$('inputDate').value,
      successCount:teamSuccessCount
    });

    showMsg(`チーム連続成功 ${teamSuccessCount}回 を記録しました。`,'ok');
    teamSuccessCount=0;
    renderSuccessCounter();
  }catch(e){
    showMsg(e.message||String(e),'err');
  }
}

async function loadReport(){
  const date=$('reportDate').value;
  $('reportImageDate').textContent=date.replaceAll('-','/');

  try{
    const [m,s,rm,rs]=await Promise.all([
      apiGet('getMistakeSummary',{date}),
      apiGet('getTeamSuccesses',{date}),
      apiGet('getMistakesForDate',{date}),
      apiGet('getTeamSuccessesForDate',{date})
    ]);

    renderMistakeSummary(m.summary||[]);
    renderSuccessTop(s.rows||[]);
    renderRawMistakes(rm.rows||[]);
    renderRawSuccesses(rs.rows||[]);
  }catch(e){
    showMsg(e.message||String(e),'err');
  }
}

function renderMistakeSummary(summary){
  const table=$('mistakeSummaryTable');

  if(!summary.length){
    table.innerHTML='<tbody><tr><td class="empty">この日の担当者が登録されていません。</td></tr></tbody>';
    return;
  }

  const cats=CATEGORIES.filter(c=>summary.some(row=>(row.categories?.[c]||0)>0));

  table.innerHTML=`
    <thead><tr><th class="left">選手</th>${cats.map(c=>`<th>${esc(c)}</th>`).join('')}<th>合計</th></tr></thead>
    <tbody>${summary.map(row=>`
      <tr>
        <td class="left">${esc(row.name)}</td>
        ${cats.map(c=>`<td>${row.categories?.[c]||0}</td>`).join('')}
        <td><strong>${row.total||0}</strong></td>
      </tr>
    `).join('')}</tbody>`;
}

function renderSuccessTop(rows){
  const el=$('successTopList');

  if(!rows.length){
    el.innerHTML='<div class="empty">記録なし</div>';
    return;
  }

  el.innerHTML=rows.slice(0,10).map((r,i)=>`
    <div class="topItem"><span>トップ${i+1}</span><span class="topValue">${r.successCount}回</span></div>
  `).join('');
}

function renderRawMistakes(rows){
  const el=$('rawMistakeList');
  el.innerHTML=rows.length?rows.map(r=>`
    <label class="rawItem">
      <input type="checkbox" data-mistake-id="${esc(r.recordId)}">
      <div><strong>${esc(r.playerName)} / ${esc(r.category)}</strong><div class="sub">${esc(formatTime(r.timestamp))}</div></div>
    </label>
  `).join(''):'<div class="empty">ミス入力なし</div>';
}

function renderRawSuccesses(rows){
  const el=$('rawSuccessList');
  el.innerHTML=rows.length?rows.map(r=>`
    <label class="rawItem">
      <input type="checkbox" data-success-id="${esc(r.recordId)}">
      <div><strong>${r.successCount}回</strong><div class="sub">${esc(formatTime(r.timestamp))}</div></div>
    </label>
  `).join(''):'<div class="empty">連続成功記録なし</div>';
}

async function deleteSelectedMistakes(){
  const ids=[...document.querySelectorAll('[data-mistake-id]:checked')].map(x=>x.dataset.mistakeId);
  if(!ids.length)return showMsg('削除するミス入力を選択してください。','err');
  if(!confirm(`${ids.length}件削除しますか？`))return;

  await apiPost('deleteMistakesById',{recordIds:ids});
  await loadReport();
}

async function deleteSelectedSuccesses(){
  const ids=[...document.querySelectorAll('[data-success-id]:checked')].map(x=>x.dataset.successId);
  if(!ids.length)return showMsg('削除する連続成功記録を選択してください。','err');
  if(!confirm(`${ids.length}件削除しますか？`))return;

  await apiPost('deleteTeamSuccessesById',{recordIds:ids});
  await loadReport();
}

async function saveReportImage(){
  const canvas=await html2canvas($('reportCanvas'),{backgroundColor:'#fff',scale:2,useCORS:true});

  canvas.toBlob(async blob=>{
    const filename=`square_${$('reportDate').value}.png`;
    const file=new File([blob],filename,{type:'image/png'});

    if(navigator.share&&navigator.canShare?.({files:[file]})){
      try{
        await navigator.share({title:'スクエア集計',files:[file]});
        return;
      }catch(e){}
    }

    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=filename;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  },'image/png');
}

function openSettings(){
  renderSettingsPlayers();
  $('settingsModal').classList.remove('hiddenEl');
}

function closeSettings(){
  $('settingsModal').classList.add('hiddenEl');
}

function renderSettingsPlayers(){
  const el=$('settingsPlayers');

  if(!allPlayers.length){
    el.innerHTML='<div class="empty">選手が登録されていません。</div>';
    return;
  }

  el.innerHTML=allPlayers.map(p=>{
    const on=p.status==='active';
    return `
      <div class="settingCard">
        <strong>${esc(p.name)}</strong> <span class="sub">${esc(p.position||'')}</span>
        <span class="badge ${on?'active':'hidden'}">${on?'表示中':'非表示'}</span>
        <button class="smallBtn ${on?'danger':'secondary'}" style="margin-top:8px" data-toggle="${esc(p.playerId)}" data-next="${on?'hidden':'active'}">
          ${on?'非表示にする':'表示状態に戻す'}
        </button>
      </div>`;
  }).join('');

  el.querySelectorAll('[data-toggle]').forEach(btn=>{
    btn.onclick=async()=>{
      try{
        await apiPost('updatePlayerStatus',{playerId:btn.dataset.toggle,status:btn.dataset.next});
        await loadPlayers();
        await loadAssignments();
        renderAll();
      }catch(e){
        showMsg(e.message||String(e),'err');
      }
    };
  });
}

async function addPlayer(){
  const name=$('newPlayerName').value.trim();
  const position=$('newPlayerPosition').value;

  if(!name||!position)return showMsg('選手名とポジションを入力してください。','err');

  try{
    await apiPost('addPlayer',{name,position});
    $('newPlayerName').value='';
    $('newPlayerPosition').value='';

    await loadPlayers();
    await loadAssignments();
    renderAll();

    showMsg('選手を登録しました。','ok');
  }catch(e){
    showMsg(e.message||String(e),'err');
  }
}

function formatTime(v){
  const d=new Date(v);
  return isNaN(d.getTime())?String(v||''):d.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
}

function esc(v){
  return String(v??'')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#39;");
}
