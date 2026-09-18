import * as XLSX from 'xlsx'

export const STORAGE_KEY = 'kgma-staff-allocations-v1'
export const PPS_STORAGE_KEY = 'kgma-pps-allocations-v1'
export const SPECIALTY_STORAGE_KEY = 'kgma-specialty-report-v1'
export const FUNDING = { budget: 'Бюджет', contract: 'Контракт', cis: 'СНГ' }

export function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export function numeric(value) {
  if (typeof value === 'number') return value
  const parsed = Number(String(value ?? '').replace(',', '.').replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

export function fmtRate(value) {
  return numeric(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 })
}

export function uid() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`
}

function loadJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || []
  } catch {
    return []
  }
}

export function loadRows() {
  const seen = new Set()
  return loadJson(STORAGE_KEY).filter((row) => {
    const key = [row.name, row.department, row.specialty, row.funding, row.studyYear || 'Не определён']
      .map(clean)
      .join('|')
      .toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export const loadPpsRows = () => loadJson(PPS_STORAGE_KEY)
export const loadSpecialtyRows = () => loadJson(SPECIALTY_STORAGE_KEY)
export const saveRows = (rows) => localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
export const savePpsRows = (rows) => localStorage.setItem(PPS_STORAGE_KEY, JSON.stringify(rows))
export const saveSpecialtyRows = (rows) => localStorage.setItem(SPECIALTY_STORAGE_KEY, JSON.stringify(rows))

export function uniquePeople(rows) {
  return new Set(rows.map((row) => `${row.name.toLowerCase()}|${row.studyYear || 'Не определён'}`)).size
}

export function totals(rows) {
  const budget = uniquePeople(rows.filter((row) => row.funding === 'budget'))
  const contract = uniquePeople(rows.filter((row) => row.funding === 'contract'))
  return { people: uniquePeople(rows), budget, contract, budgetRate: budget / 4, contractRate: contract / 4 }
}

export function ppsTotals(rows) {
  return rows.reduce(
    (total, row) => ({
      people: total.people + 1,
      budget: total.budget + numeric(row.budgetRate),
      contract: total.contract + numeric(row.contractRate),
      all: total.all + numeric(row.totalRate),
    }),
    { people: 0, budget: 0, contract: 0, all: 0 },
  )
}

export function ppsGroups(rows) {
  const groups = new Map()
  for (const row of rows) {
    const current = groups.get(row.position) || { position: row.position, people: 0, budget: 0, contract: 0, total: 0 }
    current.people += 1
    current.budget += numeric(row.budgetRate)
    current.contract += numeric(row.contractRate)
    current.total += numeric(row.totalRate)
    groups.set(row.position, current)
  }
  return [...groups.values()].sort((a, b) => a.position.localeCompare(b.position, 'ru'))
}

export function parseSpecialtySheet(sheet) {
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
  if (!matrix.slice(0, 4).flat().some((cell) => /прием документов фпмо/i.test(clean(cell)))) return []
  const internshipTotal = matrix.findIndex((row) => row.some((cell) => /^итого интернатура:?$/i.test(clean(cell))))
  if (internshipTotal < 0) return []
  const output = []
  let faculty = ''
  for (let i = internshipTotal + 1; i < matrix.length; i += 1) {
    const row = matrix[i]
    const specialty = clean(row[1])
    if (/^всего:$/i.test(specialty)) break
    if (!specialty || /^итого/i.test(specialty)) continue
    const values = row.slice(2, 12).map(numeric)
    const numbered = /^\d+$/.test(clean(row[0]))
    if (!numbered && values.every((value) => value === 0)) {
      faculty = specialty
      continue
    }
    const passedTotal = clean(row[6]) ? values[4] : values.slice(0, 4).reduce((sum, value) => sum + value, 0)
    const appliedTotal = clean(row[11]) ? values[9] : values.slice(5, 9).reduce((sum, value) => sum + value, 0)
    output.push({
      faculty,
      specialty,
      passedBudget: values[0],
      passedContract: values[1],
      passedCis: values[2],
      passedForeign: values[3],
      passedTotal,
      appliedBudget: values[5],
      appliedContract: values[6],
      appliedCis: values[7],
      appliedForeign: values[8],
      appliedTotal,
    })
  }
  return output
}

export function parsePpsSheet(sheet) {
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
  const ordRow = matrix.findIndex((row) => row.some((cell) => /^ординатура$/i.test(clean(cell))))
  if (ordRow < 0) return []
  const ordCol = matrix[ordRow].findIndex((cell) => /^ординатура$/i.test(clean(cell)))
  const internshipCol = matrix[ordRow].findIndex((cell) => /^интернатура$/i.test(clean(cell)))
  const headerIndex = matrix.findIndex(
    (row, index) => Math.abs(index - ordRow) <= 3
      && row.some((cell) => /(?:ф\.и\.о|фамилия.*сотрудник)/i.test(clean(cell)))
      && row.some((cell) => /должност/i.test(clean(cell))),
  )
  if (headerIndex < 0) return []
  const header = matrix[headerIndex].map(clean)
  const nameCol = header.findIndex((value) => /(?:ф\.и\.о|фамилия.*сотрудник)/i.test(value))
  const positionCol = header.findIndex((value) => /должност/i.test(value))
  const rateHeaderIndex = matrix.findIndex(
    (row, index) => index >= ordRow && index <= ordRow + 3 && /^бюджет$/i.test(clean(row[ordCol])),
  )
  if (nameCol < 0 || positionCol < 0 || rateHeaderIndex < 0) return []
  const paidEnd = internshipCol > ordCol ? internshipCol : ordCol + 2
  const output = []
  for (let i = Math.max(headerIndex, rateHeaderIndex) + 1; i < matrix.length; i += 1) {
    const row = matrix[i]
    if (row.some((cell) => /^итого$/i.test(clean(cell)))) break
    const name = clean(row[nameCol])
    const position = clean(row[positionCol])
    if (!name || !position) continue
    const budgetRate = numeric(row[ordCol])
    let contractRate = 0
    for (let col = ordCol + 1; col < paidEnd; col += 1) contractRate += numeric(row[col])
    const totalRate = budgetRate + contractRate
    if (totalRate <= 0) continue
    output.push({ id: uid(), name, position, budgetRate, contractRate, totalRate })
  }
  return output
}

export function parseStudentSheet(sheet, fileName, sheetName) {
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
  const headerIndex = matrix.findIndex((row) => row.some((cell) => /^(фио|фамилия,? имя)/i.test(clean(cell))))
  if (headerIndex < 0) return []
  const headers = matrix[headerIndex].map((value) => clean(value).toLowerCase())
  const find = (patterns, start = 0) => headers.findIndex((header, index) => index >= start && patterns.some((pattern) => pattern.test(header)))
  const nameCol = find([/^фио$/, /^фамилия/])
  const positionCol = find([/должност/])
  const departmentCol = find([/кафедр/])
  const phoneCol = find([/телефон/])
  const specialtyHeaderCol = find([/специальност/])
  const specialtyCol = specialtyHeaderCol >= 0 ? specialtyHeaderCol : nameCol - 1
  const budgetCol = find([/^б$/, /^бюджет$/])
  const contractCol = find([/^к$/, /^контракт$/])
  const cisCol = find([/снг/])
  const sourceLabel = [fileName, sheetName, ...matrix.slice(0, 5).flat()].map(clean).join(' ')
  const studyYear = /(?:^|\D)2\s*[-–—]?\s*(?:год|гол|курс)/i.test(sourceLabel)
    ? '2 год'
    : /(?:^|\D)1\s*[-–—]?\s*(?:год|гол|курс)/i.test(sourceLabel) ? '1 год' : 'Не определён'
  const output = []
  let accepting = true
  for (let i = headerIndex + 1; i < matrix.length; i += 1) {
    const row = matrix[i]
    const name = clean(row[nameCol])
    const department = clean(row[departmentCol])
    const specialty = clean(row[specialtyCol])
    const validName = name && name.length >= 5 && /\s/.test(name) && !/^\d+(?:[.,]\d+)?$/.test(name)
    if (row.some((cell) => /^уш[её]л$/i.test(clean(cell)))) accepting = false
    if (!accepting || !validName || !department || !specialty || /^итого$/i.test(name) || /^ставки$/i.test(name)) continue
    let funding = 'contract'
    if (budgetCol >= 0 && numeric(row[budgetCol])) funding = 'budget'
    else if (cisCol >= 0 && numeric(row[cisCol])) funding = 'cis'
    else if (contractCol >= 0 && numeric(row[contractCol])) funding = 'contract'
    output.push({
      id: uid(),
      name,
      position: clean(row[positionCol]),
      degree: '',
      department,
      program: 'Общее',
      studyYear,
      funding,
      rate: 0,
      phone: clean(row[phoneCol]),
      employment: 'Основное место',
      workplace: '',
      specialty,
    })
  }
  return output
}

async function workbookFromFile(file) {
  return XLSX.read(await file.arrayBuffer(), { type: 'array' })
}

export async function importStudentFiles(files) {
  const imported = []
  for (const file of files) {
    const workbook = await workbookFromFile(file)
    for (const sheetName of workbook.SheetNames) {
      imported.push(...parseStudentSheet(workbook.Sheets[sheetName], file.name, sheetName))
    }
  }
  return imported
}

export async function importPpsWorkbook(file) {
  const workbook = await workbookFromFile(file)
  const rows = []
  for (const sheetName of workbook.SheetNames) rows.push(...parsePpsSheet(workbook.Sheets[sheetName]))
  return rows
}

export async function importSpecialtyWorkbook(file) {
  const workbook = await workbookFromFile(file)
  for (const sheetName of workbook.SheetNames) {
    const rows = parseSpecialtySheet(workbook.Sheets[sheetName])
    if (rows.length) return rows
  }
  return []
}

export function mergeStudentRows(existingRows, importedRows) {
  const keyOf = (row) => [row.name, row.department, row.specialty, row.funding, row.studyYear || 'Не определён']
    .map(clean).join('|').toLowerCase()
  const identityOf = (row) => [row.name, row.department, row.specialty, row.funding]
    .map(clean).join('|').toLowerCase()
  const incomingIdentities = new Set(importedRows.map(identityOf))
  const merged = new Map()
  for (const row of existingRows) {
    if ((!row.studyYear || row.studyYear === 'Не определён') && incomingIdentities.has(identityOf(row))) continue
    merged.set(keyOf(row), row)
  }
  let added = 0
  let updated = 0
  for (const row of importedRows) {
    const key = keyOf(row)
    if (merged.has(key)) updated += 1
    else added += 1
    merged.set(key, row)
  }
  return { rows: [...merged.values()], added, updated }
}

export function exportExcel({ rows, specialtyRows, department, year }) {
  if (!rows.length && !specialtyRows.length) return false
  const workbook = XLSX.utils.book_new()
  if (rows.length) {
    const summaryTotals = totals(rows)
    const ordered = [...rows].sort((a, b) => a.department.localeCompare(b.department, 'ru') || a.name.localeCompare(b.name, 'ru'))
    const data = ordered.map((row, index) => ({
      '№': index + 1,
      'Фамилия, имя': row.name,
      'Год обучения': row.studyYear || 'Не определён',
      'Кафедра': row.department,
      'Специальность': row.specialty,
      'Источник': FUNDING[row.funding] || '',
      'Телефон': row.phone,
    }))
    const summary = [
      ['РАСЧЕТ ШТАТНЫХ СТАВОК · 2026–2027 УЧЕБНЫЙ ГОД'],
      ['Фильтр кафедры', department === 'all' ? 'Все кафедры' : department],
      ['Фильтр года', year === 'all' ? 'Все годы' : year],
      ['Общий итог', summaryTotals.people],
      ['Бюджет', summaryTotals.budget],
      ['Контракт', summaryTotals.contract],
      [],
      ['Источник', 'Количество человек', 'Формула', 'Итоговая ставка'],
      ['Бюджет', summaryTotals.budget, `${summaryTotals.budget} / 4`, { t: 'n', f: 'B9/4', v: summaryTotals.budgetRate }],
      ['Контракт', summaryTotals.contract, `${summaryTotals.contract} / 4`, { t: 'n', f: 'B10/4', v: summaryTotals.contractRate }],
    ]
    const listSheet = XLSX.utils.json_to_sheet(data)
    const summarySheet = XLSX.utils.aoa_to_sheet(summary)
    listSheet['!cols'] = [{ wch: 5 }, { wch: 38 }, { wch: 15 }, { wch: 34 }, { wch: 30 }, { wch: 18 }, { wch: 16 }]
    listSheet['!autofilter'] = { ref: `A1:G${data.length + 1}` }
    XLSX.utils.book_append_sheet(workbook, listSheet, 'Список')
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Расчет ставок')
  }

  let specialtyData
  if (specialtyRows.length) {
    specialtyData = specialtyRows.map((row) => ({
      'Факультет': row.faculty,
      'Специальность': row.specialty,
      'Прошли — бюджет': row.passedBudget,
      'Прошли — контракт': row.passedContract,
      'Прошли — СНГ': row.passedCis,
      'Прошли — ИГ': row.passedForeign,
      'Прошли — всего': row.passedTotal,
      'Подали — бюджет': row.appliedBudget,
      'Подали — контракт': row.appliedContract,
      'Подали — СНГ': row.appliedCis,
      'Подали — ИГ': row.appliedForeign,
      'Подали — всего': row.appliedTotal,
    }))
  } else {
    const groups = new Map()
    for (const row of rows) {
      const key = `${row.department}|${row.specialty}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(row)
    }
    specialtyData = [...groups.values()].map((groupRows) => {
      const budget = uniquePeople(groupRows.filter((row) => row.funding === 'budget'))
      const contract = uniquePeople(groupRows.filter((row) => row.funding === 'contract'))
      const cis = uniquePeople(groupRows.filter((row) => row.funding === 'cis'))
      return {
        'Кафедра': groupRows[0].department,
        'Специальность': groupRows[0].specialty,
        'Бюджет': budget,
        'Контракт': contract,
        'СНГ': cis,
        'Всего ординаторов': uniquePeople(groupRows),
        'Ставка — бюджет': budget / 4,
        'Ставка — контракт': contract / 4,
        'Всего ставок': (budget + contract) / 4,
      }
    }).sort((a, b) => a['Специальность'].localeCompare(b['Специальность'], 'ru'))
  }
  const specialtiesSheet = XLSX.utils.json_to_sheet(specialtyData)
  specialtiesSheet['!cols'] = [{ wch: 28 }, { wch: 42 }, ...Array.from({ length: 10 }, () => ({ wch: 20 }))]
  specialtiesSheet['!autofilter'] = { ref: `A1:${specialtyRows.length ? 'L' : 'I'}${specialtyData.length + 1}` }
  XLSX.utils.book_append_sheet(workbook, specialtiesSheet, 'По специальности')
  XLSX.writeFile(workbook, `Штатное_расписание_2026-2027_${new Date().toISOString().slice(0, 10)}.xlsx`)
  return true
}
