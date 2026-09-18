import * as XLSX from 'xlsx';
import './style.css';

const STORAGE_KEY = 'kgma-staff-allocations-v1';
const PPS_STORAGE_KEY = 'kgma-pps-allocations-v1';
const SPECIALTY_STORAGE_KEY = 'kgma-specialty-report-v1';
const FUNDING = { budget: 'Бюджет', contract: 'Контракт', cis: 'СНГ' };
const state = {
  rows: loadRows(),
  search: '',
  funding: 'all',
  department: 'all',
  year: 'all',
  stage: 'students',
  ppsRows: loadPpsRows(),
  specialtyRows: loadSpecialtyRows(),
  editingId: null,
};

function loadRows() {
  try {
    const rows=JSON.parse(localStorage.getItem(STORAGE_KEY)) || [], seen=new Set();
    return rows.filter(row=>{const key=[row.name,row.department,row.specialty,row.funding,row.studyYear||'Не определён'].map(clean).join('|').toLowerCase();if(seen.has(key))return false;seen.add(key);return true;});
  } catch { return []; }
}
function loadPpsRows() {
  try { return JSON.parse(localStorage.getItem(PPS_STORAGE_KEY)) || []; }
  catch { return []; }
}
function loadSpecialtyRows() {
  try { return JSON.parse(localStorage.getItem(SPECIALTY_STORAGE_KEY)) || []; }
  catch { return []; }
}
function savePpsRows() { localStorage.setItem(PPS_STORAGE_KEY, JSON.stringify(state.ppsRows)); }
function saveSpecialtyRows() { localStorage.setItem(SPECIALTY_STORAGE_KEY, JSON.stringify(state.specialtyRows)); }
function saveRows() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.rows)); }
function uid() { return crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`; }
function clean(value) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
function numeric(value) {
  if (typeof value === 'number') return value;
  const parsed = Number(String(value ?? '').replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}
function fmtRate(value) { return numeric(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 }); }
function esc(value) { return clean(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function showToast(text) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = text;
  document.body.append(el); setTimeout(() => el.remove(), 2800);
}

function scopeRows() {
  const q = state.search.toLowerCase();
  return state.rows.filter(row => {
    const found = !q || [row.name,row.department,row.position,row.specialty,row.phone].join(' ').toLowerCase().includes(q);
    return found && (state.department === 'all' || row.department === state.department) && (state.year === 'all' || (row.studyYear||'Не определён') === state.year);
  });
}
function filteredRows() {
  return scopeRows().filter(row => state.funding === 'all' || row.funding === state.funding);
}
function uniquePeople(rows) {
  return new Set(rows.map(row => `${row.name.toLowerCase()}|${row.studyYear||'Не определён'}`).filter(Boolean)).size;
}
function totals(rows = scopeRows()) {
  const budget = uniquePeople(rows.filter(row => row.funding === 'budget'));
  const contract = uniquePeople(rows.filter(row => row.funding === 'contract'));
  return {
    people: uniquePeople(rows),
    budget,
    contract,
    budgetRate: budget / 4,
    contractRate: contract / 4,
  };
}

function ppsTotals() {
  return state.ppsRows.reduce((total,row)=>({people:total.people+1,budget:total.budget+numeric(row.budgetRate),contract:total.contract+numeric(row.contractRate),all:total.all+numeric(row.totalRate)}),{people:0,budget:0,contract:0,all:0});
}
function ppsGroups() {
  const groups=new Map();
  for(const row of state.ppsRows){const current=groups.get(row.position)||{position:row.position,people:0,budget:0,contract:0,total:0};current.people++;current.budget+=numeric(row.budgetRate);current.contract+=numeric(row.contractRate);current.total+=numeric(row.totalRate);groups.set(row.position,current);}
  return [...groups.values()].sort((a,b)=>a.position.localeCompare(b.position,'ru'));
}
function specialtySection() {
  const rows=state.specialtyRows;
  return `<section class="specialty-section"><div class="section-head"><div><h2 class="section-title">По специальности</h2><p class="subtitle">Приём документов: прошли первый тур и подали документы</p></div><div class="actions"><label class="btn" for="specialtyFileInput">${rows.length?'Заменить отчёт':'Импортировать отчёт'}</label><input class="file-input" id="specialtyFileInput" type="file" accept=".xlsx,.xls">${rows.length?'<button class="btn danger" id="clearSpecialtyBtn">Очистить отчёт</button>':''}</div></div>
  <div class="table-wrap specialty-table">${rows.length?`<table><thead><tr><th>Факультет</th><th>Специальность</th><th>Прошли: бюджет</th><th>Прошли: контракт</th><th>Прошли: СНГ</th><th>Прошли: ИГ</th><th>Прошли: всего</th><th>Подали: бюджет</th><th>Подали: контракт</th><th>Подали: СНГ</th><th>Подали: ИГ</th><th>Подали: всего</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.faculty)}</td><td class="person">${esc(r.specialty)}</td><td class="number">${r.passedBudget}</td><td class="number">${r.passedContract}</td><td class="number">${r.passedCis}</td><td class="number">${r.passedForeign}</td><td class="number">${r.passedTotal}</td><td class="number">${r.appliedBudget}</td><td class="number">${r.appliedContract}</td><td class="number">${r.appliedCis}</td><td class="number">${r.appliedForeign}</td><td class="number">${r.appliedTotal}</td></tr>`).join('')}</tbody></table>`:`<div class="empty"><strong>Отчёт по специальностям не загружен</strong>Загрузите Excel «Отчёт по специальностям ПРИЕМ».</div>`}</div></section>`;
}

function studentsView() {
  const rows=filteredRows(),t=totals();
  const departments=[...new Set(state.rows.map(r=>r.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
  const years=[...new Set(state.rows.map(r=>r.studyYear||'Не определён'))].sort((a,b)=>a.localeCompare(b,'ru'));
  const importLabel=state.rows.length?'Импортировать к имеющимся Excel':'Импорт Excel';
  return `<header class="topbar"><div><h1>Формирование количества ординаторов</h1><p class="subtitle">Этап 1 · подсчёт контингента и расчёт ставок</p></div>
    <div class="actions"><label class="btn" for="fileInput">${importLabel}</label><input class="file-input" id="fileInput" type="file" accept=".xlsx,.xls" multiple><button class="btn" id="exportBtn">Выгрузить Excel</button>${state.rows.length?'<button class="btn danger" id="clearBtn">Очистить всё</button>':''}<button class="btn primary" id="addBtn">+ Добавить человека</button></div></header>
    <section class="cards staffing-cards"><div class="card total-card"><div class="label">Общий итог</div><div class="value">${t.people}</div><div class="hint">ординаторов в выбранном списке</div></div>
    <div class="card rate-card budget-card"><div><div class="label">Бюджет</div><div class="count">${t.budget} человек</div></div><div class="rate"><span>Ставка</span><strong>${fmtRate(t.budgetRate)}</strong><small>${t.budget} ÷ 4</small></div></div>
    <div class="card rate-card contract-card"><div><div class="label">Контракт</div><div class="count">${t.contract} человек</div></div><div class="rate"><span>Ставка</span><strong>${fmtRate(t.contractRate)}</strong><small>${t.contract} ÷ 4</small></div></div></section>
    <section class="toolbar"><div class="search"><input id="search" placeholder="Поиск по ФИО, кафедре, специальности…" value="${esc(state.search)}"></div>
    <select id="departmentFilter"><option value="all">Все кафедры</option>${departments.map(d=>`<option ${state.department===d?'selected':''}>${esc(d)}</option>`).join('')}</select>
    <select id="yearFilter"><option value="all">Все годы</option>${years.map(y=>`<option ${state.year===y?'selected':''}>${esc(y)}</option>`).join('')}</select>
    <select id="fundingFilter"><option value="all">Все источники</option>${Object.entries(FUNDING).map(([k,v])=>`<option value="${k}" ${state.funding===k?'selected':''}>${v}</option>`).join('')}</select></section>
    <div class="table-wrap">${rows.length?`<table><thead><tr><th>№</th><th>ФИО</th><th>Год</th><th>Специальность</th><th>Кафедра</th><th>Источник</th><th>Телефон</th><th></th></tr></thead><tbody>${rows.map((r,i)=>rowHtml(r,i)).join('')}</tbody></table>`:`<div class="empty"><strong>Записей пока нет</strong>Загрузите Excel со списком ординаторов.</div>`}</div>${specialtySection()}`;
}
function ppsView() {
  const t=ppsTotals(),groups=ppsGroups();
  return `<header class="topbar"><div><h1>Формирование ППС</h1><p class="subtitle">Этап 2 · только ставки ординатуры, без интернатуры</p></div>
    <div class="actions"><label class="btn primary" for="ppsFileInput">${state.ppsRows.length?'Заменить Excel ППС':'Импортировать Excel ППС'}</label><input class="file-input" id="ppsFileInput" type="file" accept=".xlsx,.xls">${state.ppsRows.length?'<button class="btn danger" id="clearPpsBtn">Очистить ППС</button>':''}</div></header>
    <section class="cards pps-cards"><div class="card"><div class="label">Кафедры ППС</div><div class="value">${t.people}</div><div class="hint">со ставкой ординатуры</div></div>
    <div class="card budget-card"><div class="label">Бюджет ординатуры</div><div class="value">${fmtRate(t.budget)}</div><div class="hint">ставок</div></div>
    <div class="card contract-card"><div class="label">Контракт / ИГ ординатуры</div><div class="value">${fmtRate(t.contract)}</div><div class="hint">ставок</div></div>
    <div class="card"><div class="label">Всего по ординатуре</div><div class="value">${fmtRate(t.all)}</div><div class="hint">бюджет + контракт / ИГ</div></div></section>
    <h2 class="section-title">Ставки по должностям</h2><div class="table-wrap summary-table">${groups.length?`<table><thead><tr><th>Должность</th><th>Сотрудников</th><th>Бюджет</th><th>Контракт / ИГ</th><th>Всего ставок</th></tr></thead><tbody>${groups.map(g=>`<tr><td class="person">${esc(g.position)}</td><td>${g.people}</td><td class="number">${fmtRate(g.budget)}</td><td class="number">${fmtRate(g.contract)}</td><td class="number">${fmtRate(g.total)}</td></tr>`).join('')}</tbody></table>`:`<div class="empty"><strong>Данные ППС не загружены</strong>Импортируйте штатное расписание кафедры.</div>`}</div>
    ${state.ppsRows.length?`<h2 class="section-title">Сотрудники ППС</h2><div class="table-wrap"><table><thead><tr><th>№</th><th>ФИО</th><th>Должность</th><th>Бюджет ординатуры</th><th>Контракт / ИГ ординатуры</th><th>Всего</th></tr></thead><tbody>${state.ppsRows.map((r,i)=>`<tr><td class="muted">${i+1}</td><td class="person">${esc(r.name)}</td><td>${esc(r.position)}</td><td class="number">${fmtRate(r.budgetRate)}</td><td class="number">${fmtRate(r.contractRate)}</td><td class="number">${fmtRate(r.totalRate)}</td></tr>`).join('')}</tbody></table></div>`:''}`;
}
function render() {
  document.querySelector('#app').innerHTML=`<div class="shell"><aside class="sidebar"><div class="brand"><div class="mark">К</div><div><strong>Кадры ФПМО</strong><small>Штатное распределение</small></div></div><div class="nav-label">Этапы работы</div>
  <div class="nav"><button class="${state.stage==='students'?'active':''}" data-stage="students">1 &nbsp; Формирование кол-ва ординаторов</button><button class="${state.stage==='pps'?'active':''}" data-stage="pps">2 &nbsp; Формирование ППС</button></div>
  <div class="sidebar-note">Сначала рассчитайте количество ординаторов, затем сформируйте распределение ППС.</div></aside><main class="main">${state.stage==='students'?studentsView():ppsView()}</main></div>`;
  bind();
}

function rowHtml(row, index) {
  return `<tr><td class="muted">${index+1}</td><td><div class="person">${esc(row.name)}</div>${row.degree ? `<div class="muted">${esc(row.degree)}</div>`:''}</td><td>${esc(row.studyYear||'Не определён')}</td><td>${esc(row.specialty || row.position || '—')}</td><td>${esc(row.department || '—')}</td><td><span class="badge ${row.funding}">${FUNDING[row.funding] || 'Не указан'}</span></td><td>${esc(row.phone || '—')}</td><td><div class="row-actions"><button class="icon-btn edit" data-id="${row.id}" title="Изменить">✎</button><button class="icon-btn delete" data-id="${row.id}" title="Удалить">×</button></div></td></tr>`;
}
function bind() {
  document.querySelectorAll('[data-stage]').forEach(button=>button.onclick=()=>{state.stage=button.dataset.stage;render();});
  if(state.stage==='pps'){
    document.querySelector('#ppsFileInput').onchange=importPpsFile;
    if(document.querySelector('#clearPpsBtn'))document.querySelector('#clearPpsBtn').onclick=clearPps;
    return;
  }
  document.querySelector('#addBtn').onclick=()=>openForm();
  document.querySelector('#fileInput').onchange=importFiles;
  document.querySelector('#exportBtn').onclick=exportExcel;
  document.querySelector('#specialtyFileInput').onchange=importSpecialtyFile;
  if(document.querySelector('#clearSpecialtyBtn'))document.querySelector('#clearSpecialtyBtn').onclick=clearSpecialty;
  if(document.querySelector('#clearBtn'))document.querySelector('#clearBtn').onclick=clearAll;
  document.querySelector('#search').oninput=e=>{state.search=e.target.value;render();document.querySelector('#search').focus();};
  document.querySelector('#fundingFilter').onchange=e=>{state.funding=e.target.value;render();};
  document.querySelector('#departmentFilter').onchange=e=>{state.department=e.target.value;render();};
  document.querySelector('#yearFilter').onchange=e=>{state.year=e.target.value;render();};
  document.querySelectorAll('.edit').forEach(b=>b.onclick=()=>openForm(state.rows.find(r=>r.id===b.dataset.id)));
  document.querySelectorAll('.delete').forEach(b=>b.onclick=()=>{if(confirm('Удалить эту запись?')){state.rows=state.rows.filter(r=>r.id!==b.dataset.id);saveRows();render();}});
}
function clearPps() {
  if(!confirm('Очистить импортированные данные ППС? Это действие нельзя отменить.'))return;
  localStorage.removeItem(PPS_STORAGE_KEY);state.ppsRows=[];render();showToast('Данные ППС очищены');
}
function clearSpecialty() {
  if(!confirm('Очистить импортированный отчёт по специальностям?'))return;
  localStorage.removeItem(SPECIALTY_STORAGE_KEY);state.specialtyRows=[];render();showToast('Отчёт по специальностям очищен');
}
function clearAll() {
  if(!confirm('Очистить все импортированные данные и внесённые изменения? Это действие нельзя отменить.'))return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SPECIALTY_STORAGE_KEY);
  state.rows=[];state.specialtyRows=[];state.search='';state.department='all';state.funding='all';state.year='all';
  render(); showToast('Все данные очищены');
}

function openForm(row = {}) {
  const modal = document.createElement('div'); modal.className='modal-backdrop';
  modal.innerHTML=`<div class="modal"><div class="modal-head"><h2>${row.id?'Редактировать запись':'Новая ставка'}</h2><button class="close">×</button></div><form class="form" id="personForm">
    <div class="import-note">Одна строка — один человек. Ставки бюджета и контракта рассчитываются автоматически по количеству записей.</div>
    <div class="grid">
      ${field('name','Фамилия, имя, отчество',row.name,'text',true,'full')}
      ${field('position','Должность',row.position,'text',false)}${field('degree','Степень / категория',row.degree,'text',false)}
      ${field('department','Кафедра',row.department,'text',false)}${field('specialty','Специальность',row.specialty,'text',false)}
      ${selectField('studyYear','Год обучения',row.studyYear||'Не определён',[['1 год','1 год'],['2 год','2 год'],['Не определён','Не определён']])}
      ${selectField('funding','Источник финансирования',row.funding || 'budget',Object.entries(FUNDING).map(([k,v])=>[v,k]))}${field('rate','Ставка',row.rate ?? 1,'number',true)}
      ${field('phone','Телефон',row.phone,'tel',false)}${selectField('employment','Тип занятости',row.employment || 'Основное место',[['Основное место','Основное место'],['Внешний совместитель','Внешний совместитель'],['Внутренний совместитель','Внутренний совместитель']])}
      ${field('workplace','Место работы совместителя',row.workplace,'text',false,'full')}
    </div><div class="form-actions"><button type="button" class="btn cancel">Отмена</button><button class="btn primary" type="submit">Сохранить</button></div>
  </form></div>`;
  document.body.append(modal);
  const close=()=>modal.remove(); modal.querySelector('.close').onclick=close; modal.querySelector('.cancel').onclick=close; modal.onclick=e=>{if(e.target===modal)close()};
  modal.querySelector('form').onsubmit=e=>{e.preventDefault(); const data=Object.fromEntries(new FormData(e.target)); const saved={...row,...data,program:'Общее',id:row.id||uid(),rate:numeric(data.rate)}; if(row.id) state.rows=state.rows.map(r=>r.id===row.id?saved:r); else state.rows.push(saved); saveRows(); close(); render(); showToast('Запись сохранена');};
  setTimeout(()=>modal.querySelector('[name=name]').focus(),0);
}
function field(name,label,value='',type='text',required=false,cls='') { return `<div class="field ${cls}"><label>${label}</label><input name="${name}" type="${type}" value="${esc(value)}" ${required?'required':''} ${type==='number'?'min="0" max="5" step="0.05"':''}></div>`; }
function selectField(name,label,value,options) { return `<div class="field"><label>${label}</label><select name="${name}">${options.map(([text,val])=>`<option value="${esc(val)}" ${value===val?'selected':''}>${esc(text)}</option>`).join('')}</select></div>`; }

async function importPpsFile(event) {
  const file=event.target.files[0];if(!file)return;
  const workbook=XLSX.read(await file.arrayBuffer(),{type:'array'});
  const rows=[];
  for(const sheetName of workbook.SheetNames)rows.push(...parsePpsSheet(workbook.Sheets[sheetName]));
  state.ppsRows=rows;savePpsRows();render();
  showToast(`ППС: загружено ${rows.length} сотрудников, ${fmtRate(ppsTotals().all)} ставок ординатуры`);
  event.target.value='';
}
async function importSpecialtyFile(event) {
  const file=event.target.files[0];if(!file)return;
  const workbook=XLSX.read(await file.arrayBuffer(),{type:'array'});
  let rows=[];
  for(const sheetName of workbook.SheetNames){rows=parseSpecialtySheet(workbook.Sheets[sheetName]);if(rows.length)break;}
  if(!rows.length){showToast('Раздел ординатуры по специальностям не найден');event.target.value='';return;}
  state.specialtyRows=rows;saveSpecialtyRows();render();showToast(`По специальностям: загружено ${rows.length} строк`);
  event.target.value='';
}
function parseSpecialtySheet(sheet) {
  const matrix=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false});
  if(!matrix.slice(0,4).flat().some(cell=>/прием документов фпмо/i.test(clean(cell))))return [];
  const internshipTotal=matrix.findIndex(row=>row.some(cell=>/^итого интернатура:?$/i.test(clean(cell))));
  if(internshipTotal<0)return [];
  const output=[];let faculty='';
  for(let i=internshipTotal+1;i<matrix.length;i++){
    const row=matrix[i],specialty=clean(row[1]);
    if(/^всего:$/i.test(specialty))break;
    if(!specialty||/^итого/i.test(specialty))continue;
    const values=row.slice(2,12).map(numeric);
    const numbered=/^\d+$/.test(clean(row[0]));
    if(!numbered&&values.every(value=>value===0)){faculty=specialty;continue;}
    const passedTotal=clean(row[6])?values[4]:values.slice(0,4).reduce((sum,value)=>sum+value,0);
    const appliedTotal=clean(row[11])?values[9]:values.slice(5,9).reduce((sum,value)=>sum+value,0);
    output.push({faculty,specialty,passedBudget:values[0],passedContract:values[1],passedCis:values[2],passedForeign:values[3],passedTotal,appliedBudget:values[5],appliedContract:values[6],appliedCis:values[7],appliedForeign:values[8],appliedTotal});
  }
  return output;
}
function parsePpsSheet(sheet) {
  const matrix=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false});
  const ordRow=matrix.findIndex(row=>row.some(cell=>/^ординатура$/i.test(clean(cell))));
  if(ordRow<0)return [];
  const ordCol=matrix[ordRow].findIndex(cell=>/^ординатура$/i.test(clean(cell)));
  const internshipCol=matrix[ordRow].findIndex(cell=>/^интернатура$/i.test(clean(cell)));
  const headerIndex=matrix.findIndex((row,index)=>Math.abs(index-ordRow)<=3&&row.some(cell=>/(?:ф\.и\.о|фамилия.*сотрудник)/i.test(clean(cell)))&&row.some(cell=>/должност/i.test(clean(cell))));
  if(headerIndex<0)return [];
  const header=matrix[headerIndex].map(clean);
  const nameCol=header.findIndex(value=>/(?:ф\.и\.о|фамилия.*сотрудник)/i.test(value));
  const positionCol=header.findIndex(value=>/должност/i.test(value));
  const rateHeaderIndex=matrix.findIndex((row,index)=>index>=ordRow&&index<=ordRow+3&&/^бюджет$/i.test(clean(row[ordCol])));
  if(nameCol<0||positionCol<0||rateHeaderIndex<0)return [];
  const paidEnd=internshipCol>ordCol?internshipCol:ordCol+2;
  const output=[];
  for(let i=Math.max(headerIndex,rateHeaderIndex)+1;i<matrix.length;i++){
    const row=matrix[i];if(row.some(cell=>/^итого$/i.test(clean(cell))))break;
    const name=clean(row[nameCol]),position=clean(row[positionCol]);
    if(!name||!position)continue;
    const budgetRate=numeric(row[ordCol]);
    let contractRate=0;for(let col=ordCol+1;col<paidEnd;col++)contractRate+=numeric(row[col]);
    const totalRate=budgetRate+contractRate;
    if(totalRate<=0)continue;
    output.push({id:uid(),name,position,budgetRate,contractRate,totalRate});
  }
  return output;
}
async function importFiles(event) {
  const files=[...event.target.files]; if(!files.length)return;
  const hadRows=state.rows.length>0;
  let imported=[];
  for(const file of files) {
    const workbook=XLSX.read(await file.arrayBuffer(),{type:'array'});
    for(const sheetName of workbook.SheetNames) imported.push(...parseSheet(workbook.Sheets[sheetName],file.name,sheetName));
  }
  const keyOf=row=>[row.name,row.department,row.specialty,row.funding,row.studyYear||'Не определён'].map(clean).join('|').toLowerCase();
  const identityOf=row=>[row.name,row.department,row.specialty,row.funding].map(clean).join('|').toLowerCase();
  const incomingIdentities=new Set(imported.map(identityOf));
  const merged=new Map();
  if(hadRows) for(const row of state.rows) {
    if((!row.studyYear || row.studyYear==='Не определён') && incomingIdentities.has(identityOf(row)))continue;
    merged.set(keyOf(row),row);
  }
  let added=0,updated=0;
  for(const row of imported){const key=keyOf(row);if(merged.has(key))updated++;else added++;merged.set(key,row);}
  state.rows=[...merged.values()];
  state.search=''; state.department='all'; state.funding='all'; state.year='all';
  saveRows(); render(); showToast(hadRows?`Добавлено: ${added}. Обновлено: ${updated}. Общий итог: ${totals(state.rows).people}`:`Загружено действующих записей — ${state.rows.length}`); event.target.value='';
}
function parseSheet(sheet,fileName,sheetName) {
  const matrix=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false});
  let headerIndex=matrix.findIndex(row=>row.some(cell=>/^(фио|фамилия,? имя)/i.test(clean(cell))));
  if(headerIndex<0)return [];
  const headers=matrix[headerIndex].map(v=>clean(v).toLowerCase());
  const find=(patterns,start=0)=>headers.findIndex((h,i)=>i>=start&&patterns.some(p=>p.test(h)));
  const nameCol=find([/^фио$/,/^фамилия/]); const positionCol=find([/должност/]); const deptCol=find([/кафедр/]); const phoneCol=find([/телефон/]); const specialtyHeaderCol=find([/специальност/]);
  const specialtyCol=specialtyHeaderCol>=0?specialtyHeaderCol:nameCol-1;
  const bCol=find([/^б$/,/^бюджет$/]); const kCol=find([/^к$/,/^контракт$/]); const cisCol=find([/снг/]);
  const program='Общее';
  const sourceLabel=[fileName,sheetName,...matrix.slice(0,5).flat()].map(clean).join(' ');
  const studyYear=/(?:^|\D)2\s*[-–—]?\s*(?:год|гол|курс)/i.test(sourceLabel)?'2 год':/(?:^|\D)1\s*[-–—]?\s*(?:год|гол|курс)/i.test(sourceLabel)?'1 год':'Не определён';
  const output=[];
  let accepting=true;
  for(let i=headerIndex+1;i<matrix.length;i++) {
    const row=matrix[i], name=clean(row[nameCol]);
    const department=clean(row[deptCol]), specialty=clean(row[specialtyCol]);
    const validName=name && name.length>=5 && /\s/.test(name) && !/^\d+(?:[.,]\d+)?$/.test(name);
    if(row.some(cell=>/^уш[её]л$/i.test(clean(cell))))accepting=false;
    if(!accepting || !validName || !department || !specialty || /^итого$/i.test(name) || /^ставки$/i.test(name))continue;
    let funding='contract'; if(bCol>=0&&numeric(row[bCol]))funding='budget'; else if(cisCol>=0&&numeric(row[cisCol]))funding='cis'; else if(kCol>=0&&numeric(row[kCol]))funding='contract';
    output.push({id:uid(),name,position:clean(row[positionCol]),degree:'',department,program,studyYear,funding,rate:0,phone:clean(row[phoneCol]),employment:'Основное место',workplace:'',specialty});
  }
  return output;
}
function exportExcel() {
  const selected=scopeRows();
  if(!selected.length&&!state.specialtyRows.length){showToast('Нет данных для выгрузки');return;}
  const wb=XLSX.utils.book_new();
  if(selected.length){
    const t=totals(selected);
    const ordered=[...selected].sort((a,b)=>a.department.localeCompare(b.department,'ru')||a.name.localeCompare(b.name,'ru'));
    const data=ordered.map((r,i)=>({'№':i+1,'Фамилия, имя':r.name,'Год обучения':r.studyYear||'Не определён','Кафедра':r.department,'Специальность':r.specialty,'Источник':FUNDING[r.funding]||'','Телефон':r.phone}));
    const summary=[
      ['РАСЧЕТ ШТАТНЫХ СТАВОК · 2026–2027 УЧЕБНЫЙ ГОД'],
      ['Фильтр кафедры',state.department==='all'?'Все кафедры':state.department],
      ['Фильтр года',state.year==='all'?'Все годы':state.year],
      ['Общий итог',t.people],
      ['Бюджет',t.budget],
      ['Контракт',t.contract],
      [],
      ['Источник','Количество человек','Формула','Итоговая ставка'],
      ['Бюджет',t.budget,`${t.budget} / 4`,{t:'n',f:'B9/4',v:t.budgetRate}],
      ['Контракт',t.contract,`${t.contract} / 4`,{t:'n',f:'B10/4',v:t.contractRate}],
    ];
    const ws=XLSX.utils.json_to_sheet(data),sum=XLSX.utils.aoa_to_sheet(summary);
    ws['!cols']=[{wch:5},{wch:38},{wch:15},{wch:34},{wch:30},{wch:18},{wch:16}];ws['!autofilter']={ref:`A1:G${data.length+1}`};
    XLSX.utils.book_append_sheet(wb,ws,'Список');XLSX.utils.book_append_sheet(wb,sum,'Расчет ставок');
  }
  let specialtyData;
  if(state.specialtyRows.length){
    specialtyData=state.specialtyRows.map(r=>({'Факультет':r.faculty,'Специальность':r.specialty,'Прошли — бюджет':r.passedBudget,'Прошли — контракт':r.passedContract,'Прошли — СНГ':r.passedCis,'Прошли — ИГ':r.passedForeign,'Прошли — всего':r.passedTotal,'Подали — бюджет':r.appliedBudget,'Подали — контракт':r.appliedContract,'Подали — СНГ':r.appliedCis,'Подали — ИГ':r.appliedForeign,'Подали — всего':r.appliedTotal}));
  }else{
    const groups=new Map();
    for(const row of selected){const key=`${row.department}|${row.specialty}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
    specialtyData=[...groups.values()].map(rows=>{
      const budget=uniquePeople(rows.filter(r=>r.funding==='budget'));
      const contract=uniquePeople(rows.filter(r=>r.funding==='contract'));
      const cis=uniquePeople(rows.filter(r=>r.funding==='cis'));
      return {'Кафедра':rows[0].department,'Специальность':rows[0].specialty,'Бюджет':budget,'Контракт':contract,'СНГ':cis,'Всего ординаторов':uniquePeople(rows),'Ставка — бюджет':budget/4,'Ставка — контракт':contract/4,'Всего ставок':(budget+contract)/4};
    }).sort((a,b)=>a['Специальность'].localeCompare(b['Специальность'],'ru'));
  }
  const specialties=XLSX.utils.json_to_sheet(specialtyData);
  specialties['!cols']=[{wch:28},{wch:42},...Array.from({length:10},()=>({wch:20}))];specialties['!autofilter']={ref:`A1:${state.specialtyRows.length?'L':'I'}${specialtyData.length+1}`};
  XLSX.utils.book_append_sheet(wb,specialties,'По специальности');
  XLSX.writeFile(wb,`Штатное_расписание_2026-2027_${new Date().toISOString().slice(0,10)}.xlsx`);showToast('Штатное расписание сформировано');
}

render();
