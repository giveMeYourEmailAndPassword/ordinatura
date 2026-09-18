import * as XLSX from 'xlsx';
import './style.css';

const STORAGE_KEY = 'kgma-staff-allocations-v1';
const FUNDING = { budget: 'Бюджет', contract: 'Контракт', cis: 'СНГ' };
const state = {
  rows: loadRows(),
  search: '',
  funding: 'all',
  department: 'all',
  editingId: null,
};

function loadRows() {
  try {
    const rows=JSON.parse(localStorage.getItem(STORAGE_KEY)) || [], seen=new Set();
    return rows.filter(row=>{const key=[row.name,row.department,row.specialty,row.funding].map(clean).join('|').toLowerCase();if(seen.has(key))return false;seen.add(key);return true;});
  } catch { return []; }
}
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
    return found && (state.department === 'all' || row.department === state.department);
  });
}
function filteredRows() {
  return scopeRows().filter(row => state.funding === 'all' || row.funding === state.funding);
}
function uniquePeople(rows) {
  return new Set(rows.map(row => row.name.toLowerCase()).filter(Boolean)).size;
}
function totals(rows = scopeRows()) {
  const budget = uniquePeople(rows.filter(row => row.funding === 'budget'));
  const contract = uniquePeople(rows.filter(row => row.funding === 'contract' || row.funding === 'cis'));
  return {
    people: uniquePeople(rows),
    budget,
    contract,
    budgetRate: budget / 4,
    contractRate: contract / 4,
  };
}

function render() {
  const rows = filteredRows();
  const t = totals();
  const departments = [...new Set(state.rows.map(r => r.department).filter(Boolean))].sort((a,b) => a.localeCompare(b,'ru'));
  document.querySelector('#app').innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand"><div class="mark">К</div><div><strong>Кадры ФПМО</strong><small>Штатное распределение</small></div></div>
        <div class="nav-label">Рабочее пространство</div>
        <div class="nav"><button class="active">▦ &nbsp; Распределение ставок</button><button id="navImport">⇧ &nbsp; Импорт из Excel</button></div>
        <div class="sidebar-note">Данные сохраняются только на этом компьютере в браузере. Экспортируйте Excel для резервной копии.</div>
      </aside>
      <main class="main">
        <header class="topbar"><div><h1>Распределение ставок</h1><p class="subtitle">2026–2027 учебный год · ППС и УВП по ФПМО</p></div>
          <div class="actions"><label class="btn" for="fileInput">Импорт Excel</label><input class="file-input" id="fileInput" type="file" accept=".xlsx,.xls" multiple><button class="btn" id="exportBtn">Выгрузить Excel</button><button class="btn primary" id="addBtn">+ Добавить человека</button></div>
        </header>
        <section class="cards staffing-cards">
          <div class="card total-card"><div class="label">Общий итог</div><div class="value">${t.people}</div><div class="hint">человек в выбранном списке</div></div>
          <div class="card rate-card budget-card"><div><div class="label">Бюджет</div><div class="count">${t.budget} человек</div></div><div class="rate"><span>Ставка</span><strong>${fmtRate(t.budgetRate)}</strong><small>${t.budget} ÷ 4</small></div></div>
          <div class="card rate-card contract-card"><div><div class="label">Контракт + СНГ</div><div class="count">${t.contract} человек</div></div><div class="rate"><span>Ставка</span><strong>${fmtRate(t.contractRate)}</strong><small>${t.contract} ÷ 4</small></div></div>
        </section>
        <section class="toolbar"><div class="search"><input id="search" placeholder="Поиск по ФИО, кафедре, специальности…" value="${esc(state.search)}"></div>
          <select id="departmentFilter"><option value="all">Все кафедры</option>${departments.map(d=>`<option ${state.department===d?'selected':''}>${esc(d)}</option>`).join('')}</select>
          <select id="fundingFilter"><option value="all">Все источники</option>${Object.entries(FUNDING).map(([k,v])=>`<option value="${k}" ${state.funding===k?'selected':''}>${v}</option>`).join('')}</select>
        </section>
        <div class="table-wrap">${rows.length ? `<table><thead><tr><th>№</th><th>ФИО</th><th>Специальность</th><th>Кафедра</th><th>Источник</th><th>Телефон</th><th></th></tr></thead><tbody>${rows.map((r,i)=>rowHtml(r,i)).join('')}</tbody></table>` : `<div class="empty"><strong>Записей пока нет</strong>Добавьте человека вручную или загрузите исходную таблицу Excel.</div>`}</div>
    </div>`;
  bind();
}

function rowHtml(row, index) {
  return `<tr><td class="muted">${index+1}</td><td><div class="person">${esc(row.name)}</div>${row.degree ? `<div class="muted">${esc(row.degree)}</div>`:''}</td><td>${esc(row.specialty || row.position || '—')}</td><td>${esc(row.department || '—')}</td><td><span class="badge ${row.funding}">${FUNDING[row.funding] || 'Не указан'}</span></td><td>${esc(row.phone || '—')}</td><td><div class="row-actions"><button class="icon-btn edit" data-id="${row.id}" title="Изменить">✎</button><button class="icon-btn delete" data-id="${row.id}" title="Удалить">×</button></div></td></tr>`;
}
function bind() {
  document.querySelector('#addBtn').onclick = () => openForm();
  document.querySelector('#navImport').onclick = () => document.querySelector('#fileInput').click();
  document.querySelector('#fileInput').onchange = importFiles;
  document.querySelector('#exportBtn').onclick = exportExcel;
  document.querySelector('#search').oninput = e => { state.search = e.target.value; render(); document.querySelector('#search').focus(); };
  document.querySelector('#fundingFilter').onchange = e => { state.funding=e.target.value; render(); };
  document.querySelector('#departmentFilter').onchange = e => { state.department=e.target.value; render(); };
  document.querySelectorAll('.edit').forEach(b => b.onclick = () => openForm(state.rows.find(r=>r.id===b.dataset.id)));
  document.querySelectorAll('.delete').forEach(b => b.onclick = () => { if(confirm('Удалить эту запись?')) { state.rows=state.rows.filter(r=>r.id!==b.dataset.id); saveRows(); render(); } });
}

function openForm(row = {}) {
  const modal = document.createElement('div'); modal.className='modal-backdrop';
  modal.innerHTML=`<div class="modal"><div class="modal-head"><h2>${row.id?'Редактировать запись':'Новая ставка'}</h2><button class="close">×</button></div><form class="form" id="personForm">
    <div class="import-note">Одна строка — один человек. Ставки бюджета и контракта рассчитываются автоматически по количеству записей.</div>
    <div class="grid">
      ${field('name','Фамилия, имя, отчество',row.name,'text',true,'full')}
      ${field('position','Должность',row.position,'text',false)}${field('degree','Степень / категория',row.degree,'text',false)}
      ${field('department','Кафедра',row.department,'text',false)}${field('specialty','Специальность',row.specialty,'text',false)}
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

async function importFiles(event) {
  const files=[...event.target.files]; if(!files.length)return;
  let imported=[];
  for(const file of files) {
    const workbook=XLSX.read(await file.arrayBuffer(),{type:'array'});
    for(const sheetName of workbook.SheetNames) imported.push(...parseSheet(workbook.Sheets[sheetName]));
  }
  const existing=new Set();
  imported=imported.filter(r=>{const key=`${r.name}|${r.program}|${r.funding}|${r.rate}`.toLowerCase(); if(existing.has(key))return false; existing.add(key); return true;});
  state.rows=imported;
  state.search=''; state.department='all'; state.funding='all';
  saveRows(); render(); showToast(`Список заменен. Загружено действующих записей — ${imported.length}`); event.target.value='';
}
function parseSheet(sheet) {
  const matrix=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false});
  let headerIndex=matrix.findIndex(row=>row.some(cell=>/^(фио|фамилия,? имя)/i.test(clean(cell))));
  if(headerIndex<0)return [];
  const headers=matrix[headerIndex].map(v=>clean(v).toLowerCase());
  const find=(patterns,start=0)=>headers.findIndex((h,i)=>i>=start&&patterns.some(p=>p.test(h)));
  const nameCol=find([/^фио$/,/^фамилия/]); const positionCol=find([/должност/]); const deptCol=find([/кафедр/]); const phoneCol=find([/телефон/]); const specialtyHeaderCol=find([/специальност/]);
  const specialtyCol=specialtyHeaderCol>=0?specialtyHeaderCol:nameCol-1;
  const bCol=find([/^б$/,/^бюджет$/]); const kCol=find([/^к$/,/^контракт$/]); const cisCol=find([/снг/]);
  const program='Общее';
  const output=[];
  let accepting=true;
  for(let i=headerIndex+1;i<matrix.length;i++) {
    const row=matrix[i], name=clean(row[nameCol]);
    const department=clean(row[deptCol]), specialty=clean(row[specialtyCol]);
    const validName=name && name.length>=5 && /\s/.test(name) && !/^\d+(?:[.,]\d+)?$/.test(name);
    if(row.some(cell=>/^уш[её]л$/i.test(clean(cell))))accepting=false;
    if(!accepting || !validName || !department || !specialty || /^итого$/i.test(name) || /^ставки$/i.test(name))continue;
    let funding='contract'; if(bCol>=0&&numeric(row[bCol]))funding='budget'; else if(cisCol>=0&&numeric(row[cisCol]))funding='cis'; else if(kCol>=0&&numeric(row[kCol]))funding='contract';
    output.push({id:uid(),name,position:clean(row[positionCol]),degree:'',department,program:program||'Другое',funding,rate:0,phone:clean(row[phoneCol]),employment:'Основное место',workplace:'',specialty});
  }
  return output;
}
function exportExcel() {
  const selected=scopeRows();
  if(!selected.length){showToast('Нет данных для выгрузки');return;}
  const t=totals(selected);
  const ordered=[...selected].sort((a,b)=>a.department.localeCompare(b.department,'ru')||a.name.localeCompare(b.name,'ru'));
  const data=ordered.map((r,i)=>({'№':i+1,'Фамилия, имя':r.name,'Кафедра':r.department,'Специальность':r.specialty,'Источник':FUNDING[r.funding]||'','Телефон':r.phone}));
  const summary=[
    ['РАСЧЕТ ШТАТНЫХ СТАВОК · 2026–2027 УЧЕБНЫЙ ГОД'],
    ['Фильтр кафедры',state.department==='all'?'Все кафедры':state.department],
    ['Раздел','Распределение ставок'],
    [],
    ['Общий итог',t.people],
    ['Бюджет',t.budget],
    ['Контракт + СНГ',t.contract],
    [],
    ['Источник','Количество человек','Формула','Итоговая ставка'],
    ['Бюджет',t.budget,`${t.budget} / 4`,{t:'n',f:'B10/4',v:t.budgetRate}],
    ['Контракт + СНГ',t.contract,`${t.contract} / 4`,{t:'n',f:'B11/4',v:t.contractRate}],
  ];
  const wb=XLSX.utils.book_new(), ws=XLSX.utils.json_to_sheet(data), sum=XLSX.utils.aoa_to_sheet(summary);
  ws['!cols']=[{wch:5},{wch:38},{wch:34},{wch:30},{wch:18},{wch:16}]; ws['!autofilter']={ref:`A1:F${data.length+1}`};
  sum['!cols']=[{wch:25},{wch:24},{wch:18},{wch:20}];
  XLSX.utils.book_append_sheet(wb,ws,'Список'); XLSX.utils.book_append_sheet(wb,sum,'Расчет ставок');
  XLSX.writeFile(wb,`Штатное_расписание_2026-2027_${new Date().toISOString().slice(0,10)}.xlsx`); showToast('Штатное расписание сформировано');
}

render();
