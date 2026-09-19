import { useId, useMemo, useState } from 'react'
import { normalizeProps, useMachine } from '@zag-js/react'
import * as tabs from '@zag-js/tabs'
import {
  FUNDING,
  PPS_STORAGE_KEY,
  SPECIALTY_STORAGE_KEY,
  STORAGE_KEY,
  exportExcel,
  fmtRate,
  importPpsWorkbook,
  importSpecialtyWorkbook,
  importStudentFiles,
  loadPpsRows,
  loadRows,
  loadSpecialtyRows,
  mergeStudentRows,
  ppsGroups,
  ppsTotals,
  savePpsRows,
  saveRows,
  saveSpecialtyRows,
  totals,
} from './lib/domain'
import { ConfirmDialog, PersonDialog } from './components/Dialogs'
import { ExcelUpload } from './components/ExcelUpload'
import { ToastRegion, toaster } from './components/ToastRegion'
import { ZagSelect } from './components/ZagSelect'
import { SearchSelect } from './components/SearchSelect'

const buttonClass = 'rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-800/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-800/10'
const dangerButtonClass = `${buttonClass} text-red-700 hover:border-red-300 hover:bg-red-50`
const tableHeadClass = 'sticky top-0 z-10 border-b border-stone-200 bg-stone-50 px-3 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-500'
const tableCellClass = 'border-b border-stone-100 px-3 py-3 text-xs text-slate-700'

function notify(title, type = 'success', description) {
  toaster.create({ title, description, type, closable: true })
}

const statLabelClass = 'text-[11px] font-extrabold uppercase tracking-wide text-slate-500'
const statValueClass = 'mt-2.5 text-4xl font-extrabold leading-none tabular-nums text-emerald-950'
const statHintClass = 'mt-1.5 text-[11px] text-slate-400'

function Stat({ label, value, hint }) {
  return (
    <div>
      <div className={statLabelClass}>{label}</div>
      <div className={statValueClass}>{value}</div>
      <div className={statHintClass}>{hint}</div>
    </div>
  )
}

function Card({ label, value, hint, accent, children }) {
  return (
    <article className={`rounded-2xl border border-stone-200 bg-white p-5 shadow-sm ${accent === 'budget' ? 'border-t-[3px] border-t-emerald-600' : accent === 'contract' ? 'border-t-[3px] border-t-amber-400' : ''}`}>
      {children || <Stat label={label} value={value} hint={hint} />}
    </article>
  )
}

function RateCard({ label, count, rate, accent }) {
  return (
    <Card accent={accent}>
      <div className="grid grid-cols-2">
        <Stat label={label} value={count} hint="человек" />
        <div className="border-l border-stone-200 pl-5">
          <Stat label="Ставка" value={fmtRate(rate)} hint={`${count} ÷ 4`} />
        </div>
      </div>
    </Card>
  )
}

function EmptyState({ title, children }) {
  return <div className="px-5 py-16 text-center text-sm text-slate-500"><strong className="mb-1 block text-slate-700">{title}</strong>{children}</div>
}

function TableFrame({ children, className = '' }) {
  return <div className={`overflow-auto rounded-b-2xl border border-stone-200 bg-white ${className}`}>{children}</div>
}

function SpecialtySection({ rows, onImport, onClear }) {
  return (
    <section className="mt-7">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-emerald-950">По специальности</h2>
          <p className="text-sm text-slate-500">Приём документов: прошли первый тур и подали документы</p>
        </div>
        <div className="flex gap-2">
          <ExcelUpload onFiles={onImport}>{rows.length ? 'Заменить отчёт' : 'Импортировать отчёт'}</ExcelUpload>
          {rows.length > 0 && <button type="button" className={dangerButtonClass} onClick={onClear}>Очистить отчёт</button>}
        </div>
      </div>
      <TableFrame className="max-h-[560px] rounded-2xl">
        {rows.length ? (
          <table className="min-w-[1580px] w-full border-collapse">
            <thead><tr>{['Факультет', 'Специальность', 'Прошли: бюджет', 'Прошли: контракт', 'Прошли: СНГ', 'Прошли: ИГ', 'Прошли: всего', 'Подали: бюджет', 'Подали: контракт', 'Подали: СНГ', 'Подали: ИГ', 'Подали: всего'].map((heading) => <th key={heading} className={tableHeadClass}>{heading}</th>)}</tr></thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.faculty}-${row.specialty}-${index}`} className="hover:bg-stone-50">
                  <td className={tableCellClass}>{row.faculty}</td>
                  <td className={`${tableCellClass} font-bold text-slate-900`}>{row.specialty}</td>
                  {[row.passedBudget, row.passedContract, row.passedCis, row.passedForeign, row.passedTotal, row.appliedBudget, row.appliedContract, row.appliedCis, row.appliedForeign, row.appliedTotal].map((value, valueIndex) => <td key={valueIndex} className={`${tableCellClass} font-bold tabular-nums`}>{value}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState title="Отчёт по специальностям не загружен">Загрузите Excel «Отчёт по специальностям ПРИЕМ».</EmptyState>}
      </TableFrame>
    </section>
  )
}

function StudentsView({ rows, specialtyRows, setRows, setSpecialtyRows, onEdit, confirmAction }) {
  const [search, setSearch] = useState('')
  const [funding, setFunding] = useState('all')
  const [department, setDepartment] = useState('all')
  const [year, setYear] = useState('all')

  const departmentOptions = useMemo(() => {
    const grouped = new Map()
    for (const row of rows) {
      if (!row.department) continue
      grouped.set(row.department, [...(grouped.get(row.department) ?? []), row])
    }
    const hint = (list) => {
      const scoped = totals(list)
      return `${scoped.people} чел. · ${fmtRate(scoped.budgetRate + scoped.contractRate)} ст.`
    }
    return [
      { label: 'Все кафедры', value: 'all', hint: hint(rows) },
      ...[...grouped.keys()].sort((a, b) => a.localeCompare(b, 'ru')).map((value) => ({ label: value, value, hint: hint(grouped.get(value)) })),
    ]
  }, [rows])
  const years = useMemo(() => [...new Set(rows.map((row) => row.studyYear || 'Не определён'))].sort((a, b) => a.localeCompare(b, 'ru')), [rows])
  const yearOptions = useMemo(() => [{ label: 'Все годы', value: 'all' }, ...years.map((value) => ({ label: value, value }))], [years])
  const fundingOptions = useMemo(() => [{ label: 'Все источники', value: 'all' }, ...Object.entries(FUNDING).map(([value, label]) => ({ label, value }))], [])
  const scopedRows = useMemo(() => {
    const query = search.toLowerCase()
    return rows.filter((row) => {
      const found = !query || [row.name, row.department, row.position, row.specialty, row.phone].join(' ').toLowerCase().includes(query)
      return found && (department === 'all' || row.department === department) && (year === 'all' || (row.studyYear || 'Не определён') === year)
    })
  }, [rows, search, department, year])
  const visibleRows = useMemo(() => scopedRows.filter((row) => funding === 'all' || row.funding === funding), [scopedRows, funding])
  const summary = useMemo(() => totals(scopedRows), [scopedRows])

  const importStudents = async (files) => {
    try {
      const imported = await importStudentFiles(files)
      const result = mergeStudentRows(rows, imported)
      setRows(result.rows)
      saveRows(result.rows)
      setSearch(''); setFunding('all'); setDepartment('all'); setYear('all')
      notify(rows.length ? `Добавлено: ${result.added}. Обновлено: ${result.updated}` : `Загружено действующих записей — ${result.rows.length}`)
    } catch (error) {
      notify('Не удалось прочитать Excel', 'error', error.message)
    }
  }

  const importSpecialties = async ([file]) => {
    if (!file) return
    try {
      const imported = await importSpecialtyWorkbook(file)
      if (!imported.length) {
        notify('Раздел ординатуры по специальностям не найден', 'warning')
        return
      }
      setSpecialtyRows(imported)
      saveSpecialtyRows(imported)
      notify(`По специальностям: загружено ${imported.length} строк`)
    } catch (error) {
      notify('Не удалось прочитать отчёт', 'error', error.message)
    }
  }

  const exportCurrent = () => {
    if (!exportExcel({ rows: scopedRows, specialtyRows, department, year })) {
      notify('Нет данных для выгрузки', 'warning')
      return
    }
    notify('Штатное расписание сформировано')
  }

  return (
    <>
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="font-serif text-4xl text-emerald-950">Формирование количества ординаторов</h1><p className="mt-1 text-sm text-slate-500">Этап 1 · подсчёт контингента и расчёт ставок</p></div>
        <div className="flex flex-wrap gap-2">
          <ExcelUpload onFiles={importStudents} multiple>{rows.length ? 'Импортировать к имеющимся Excel' : 'Импорт Excel'}</ExcelUpload>
          <button type="button" className={buttonClass} onClick={exportCurrent}>Выгрузить Excel</button>
          {rows.length > 0 && <button type="button" className={dangerButtonClass} onClick={() => confirmAction({ title: 'Очистить все данные?', description: 'Будут удалены ординаторы и отчёт по специальностям. Это действие нельзя отменить.', onConfirm: () => { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(SPECIALTY_STORAGE_KEY); setRows([]); setSpecialtyRows([]); notify('Все данные очищены') } })}>Очистить всё</button>}
          <button type="button" className="rounded-xl border border-amber-500 bg-amber-400 px-4 py-2.5 text-sm font-extrabold text-emerald-950 shadow-sm hover:bg-amber-300" onClick={() => onEdit(null)}>+ Добавить человека</button>
        </div>
      </header>

      <section className="mb-5 grid gap-3 lg:grid-cols-[.72fr_1.35fr_1.35fr]">
        <Card label="Общий итог" value={summary.people} hint="ординаторов" />
        <RateCard label="Бюджет" count={summary.budget} rate={summary.budgetRate} accent="budget" />
        <RateCard label="Контракт" count={summary.contract} rate={summary.contractRate} accent="contract" />
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-t-2xl border border-b-0 border-stone-200 bg-white p-3">
        <label className="relative min-w-64 flex-1">
          <svg aria-hidden viewBox="0 0 20 20" fill="none" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"><circle cx="8" cy="8" r="5.25" stroke="currentColor" strokeWidth="2" /><path d="M11.71 11.71 15.75 15.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по ФИО, кафедре, специальности…" className="w-full rounded-xl border border-stone-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-800/10" />
        </label>
        <SearchSelect ariaLabel="Фильтр по кафедре" title="Кафедры" searchPlaceholder="Введите название" resetValue="all" resetLabel="Все кафедры" value={department} onChange={setDepartment} options={departmentOptions} />
        <ZagSelect compact ariaLabel="Фильтр по году" value={year} onChange={setYear} options={yearOptions} />
        <ZagSelect compact ariaLabel="Фильтр по источнику финансирования" value={funding} onChange={setFunding} options={fundingOptions} />
      </section>
      <TableFrame>
        {visibleRows.length ? (
          <table className="min-w-[min(1080px,100%)] w-full border-collapse">
            <thead><tr>{['№', 'ФИО', 'Год', 'Специальность', 'Кафедра', 'Источник', 'Телефон', ''].map((heading, index) => <th key={`${heading}-${index}`} className={heading === 'Источник' || heading === 'Телефон' ? `${tableHeadClass} pl-12` : tableHeadClass}>{heading}</th>)}</tr></thead>
            <tbody>{visibleRows.map((row, index) => (
              <tr key={row.id} className="hover:bg-stone-50">
                <td className={`${tableCellClass} text-slate-400`}>{index + 1}</td>
                <td className={tableCellClass}><div className="font-bold text-slate-900">{row.name}</div>{row.degree && <div className="text-slate-400">{row.degree}</div>}</td>
                <td className={`${tableCellClass} min-w-28 whitespace-nowrap`}>{row.studyYear || 'Не определён'}</td>
                <td className={tableCellClass}>{row.specialty || row.position || '—'}</td>
                <td className={tableCellClass}>{row.department || '—'}</td>
                <td className={`${tableCellClass} pl-12`}><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold ${row.funding === 'budget' ? 'bg-emerald-50 text-emerald-800' : row.funding === 'cis' ? 'bg-violet-50 text-violet-800' : 'bg-amber-50 text-amber-800'}`}>{FUNDING[row.funding] || 'Не указан'}</span></td>
                <td className={`${tableCellClass} w-[1%] pl-12`}><span className="block max-w-18 truncate" title={row.phone || undefined}>{row.phone || '—'}</span></td>
                <td className={`${tableCellClass} w-[1%]`}><div className="flex gap-1"><button type="button" className="grid size-8 place-items-center rounded-lg text-slate-500 transition hover:bg-stone-100" onClick={() => onEdit(row)} aria-label={`Изменить ${row.name}`}><svg aria-hidden viewBox="0 0 20 20" fill="none" className="size-4"><path d="M12.37 3.37 14.63 5.63 6.85 13.41 3.46 14.54 4.59 11.15z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M4.59 11.15 6.85 13.41" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></button><button type="button" className="grid size-8 place-items-center rounded-lg text-slate-500 transition hover:bg-red-50 hover:text-red-700" onClick={() => confirmAction({ title: 'Удалить запись?', description: row.name, onConfirm: () => { const next = rows.filter((item) => item.id !== row.id); setRows(next); saveRows(next); notify('Запись удалена') } })} aria-label={`Удалить ${row.name}`}><svg aria-hidden viewBox="0 0 20 20" fill="none" className="size-4"><path d="M4.75 4.75 15.25 15.25M15.25 4.75 4.75 15.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></button></div></td>
              </tr>
            ))}</tbody>
          </table>
        ) : <EmptyState title="Записей пока нет">Загрузите Excel со списком ординаторов.</EmptyState>}
      </TableFrame>

      <SpecialtySection rows={specialtyRows} onImport={importSpecialties} onClear={() => confirmAction({ title: 'Очистить отчёт?', description: 'Импортированный отчёт по специальностям будет удалён.', onConfirm: () => { localStorage.removeItem(SPECIALTY_STORAGE_KEY); setSpecialtyRows([]); notify('Отчёт по специальностям очищен') } })} />
    </>
  )
}

function PpsView({ rows, setRows, confirmAction }) {
  const summary = useMemo(() => ppsTotals(rows), [rows])
  const groups = useMemo(() => ppsGroups(rows), [rows])
  const importPps = async ([file]) => {
    if (!file) return
    try {
      const imported = await importPpsWorkbook(file)
      setRows(imported)
      savePpsRows(imported)
      notify(`ППС: загружено ${imported.length} сотрудников, ${fmtRate(ppsTotals(imported).all)} ставок ординатуры`)
    } catch (error) {
      notify('Не удалось прочитать штатное расписание', 'error', error.message)
    }
  }

  return (
    <>
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="font-serif text-4xl text-emerald-950">Формирование ППС</h1><p className="mt-1 text-sm text-slate-500">Этап 2 · только ставки ординатуры, без интернатуры</p></div>
        <div className="flex gap-2">
          <ExcelUpload onFiles={importPps} primary>{rows.length ? 'Заменить Excel ППС' : 'Импортировать Excel ППС'}</ExcelUpload>
          {rows.length > 0 && <button type="button" className={dangerButtonClass} onClick={() => confirmAction({ title: 'Очистить данные ППС?', description: 'Импортированные сотрудники и ставки ППС будут удалены.', onConfirm: () => { localStorage.removeItem(PPS_STORAGE_KEY); setRows([]); notify('Данные ППС очищены') } })}>Очистить ППС</button>}
        </div>
      </header>
      <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card label="Сотрудников ППС" value={summary.people} hint="со ставкой ординатуры" />
        <Card label="Бюджет ординатуры" value={fmtRate(summary.budget)} hint="ставок" accent="budget" />
        <Card label="Контракт / ИГ ординатуры" value={fmtRate(summary.contract)} hint="ставок" accent="contract" />
        <Card label="Всего по ординатуре" value={fmtRate(summary.all)} hint="бюджет + контракт / ИГ" />
      </section>
      <h2 className="mb-3 mt-7 text-lg font-extrabold text-emerald-950">Ставки по должностям</h2>
      <TableFrame className="rounded-2xl">
        {groups.length ? (
          <table className="min-w-[760px] w-full border-collapse"><thead><tr>{['Должность', 'Сотрудников', 'Бюджет', 'Контракт / ИГ', 'Всего ставок'].map((heading) => <th key={heading} className={tableHeadClass}>{heading}</th>)}</tr></thead><tbody>{groups.map((group) => <tr key={group.position} className="hover:bg-stone-50"><td className={`${tableCellClass} font-bold text-slate-900`}>{group.position}</td><td className={tableCellClass}>{group.people}</td><td className={`${tableCellClass} font-bold tabular-nums`}>{fmtRate(group.budget)}</td><td className={`${tableCellClass} font-bold tabular-nums`}>{fmtRate(group.contract)}</td><td className={`${tableCellClass} font-bold tabular-nums`}>{fmtRate(group.total)}</td></tr>)}</tbody></table>
        ) : <EmptyState title="Данные ППС не загружены">Импортируйте штатное расписание кафедры.</EmptyState>}
      </TableFrame>
      {rows.length > 0 && (
        <><h2 className="mb-3 mt-7 text-lg font-extrabold text-emerald-950">Сотрудники ППС</h2><TableFrame className="rounded-2xl"><table className="min-w-[900px] w-full border-collapse"><thead><tr>{['№', 'ФИО', 'Должность', 'Бюджет ординатуры', 'Контракт / ИГ ординатуры', 'Всего'].map((heading) => <th key={heading} className={tableHeadClass}>{heading}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id} className="hover:bg-stone-50"><td className={`${tableCellClass} text-slate-400`}>{index + 1}</td><td className={`${tableCellClass} font-bold text-slate-900`}>{row.name}</td><td className={tableCellClass}>{row.position}</td><td className={`${tableCellClass} font-bold tabular-nums`}>{fmtRate(row.budgetRate)}</td><td className={`${tableCellClass} font-bold tabular-nums`}>{fmtRate(row.contractRate)}</td><td className={`${tableCellClass} font-bold tabular-nums`}>{fmtRate(row.totalRate)}</td></tr>)}</tbody></table></TableFrame></>
      )}
    </>
  )
}

export default function App() {
  const tabsId = useId()
  const [stage, setStage] = useState('students')
  const [rows, setRows] = useState(loadRows)
  const [ppsRows, setPpsRows] = useState(loadPpsRows)
  const [specialtyRows, setSpecialtyRows] = useState(loadSpecialtyRows)
  const [editingRow, setEditingRow] = useState(null)
  const [personOpen, setPersonOpen] = useState(false)
  const [confirm, setConfirm] = useState({ open: false, title: '', description: '', onConfirm: () => {} })
  const tabService = useMachine(tabs.machine, { id: tabsId, value: stage, onValueChange: ({ value }) => setStage(value) })
  const tabApi = tabs.connect(tabService, normalizeProps)

  const editPerson = (row) => { setEditingRow(row); setPersonOpen(true) }
  const savePerson = (person) => {
    const next = person.id && rows.some((row) => row.id === person.id)
      ? rows.map((row) => row.id === person.id ? person : row)
      : [...rows, person]
    setRows(next)
    saveRows(next)
    notify('Запись сохранена')
  }
  const confirmAction = (details) => setConfirm({ ...details, open: true })

  return (
    <div {...tabApi.getRootProps()} className="min-h-screen bg-stone-100 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-emerald-950 px-5 py-7 text-white">
        <div className="mb-9 flex items-center gap-3 px-2"><div className="grid size-11 place-items-center rounded-xl bg-amber-400 font-serif text-xl text-emerald-950">К</div><div><strong className="block">Кадры ФПМО</strong></div></div>
        <div className="mb-2 px-2 text-[10px] uppercase tracking-[.16em] text-white/40">Этапы работы</div>
        <div {...tabApi.getListProps()} className="grid gap-2">
          {[['students', '1', 'Формирование кол-ва ординаторов'], ['pps', '2', 'Формирование ППС']].map(([value, number, label]) => (
            <button key={value} {...tabApi.getTriggerProps({ value })} type="button" className="rounded-xl px-3 py-3 text-left text-sm font-semibold text-white/70 transition data-[selected]:bg-white/10 data-[selected]:text-white"><span className="mr-2">{number}</span>{label}</button>
          ))}
        </div>
        <div className="mt-auto rounded-xl bg-white/[.07] p-4 text-xs leading-5 text-white/55">Сначала рассчитайте количество ординаторов, затем сформируйте распределение ППС.</div>
      </aside>
      <main className="ml-60 min-h-screen w-[calc(100%-15rem)] px-6 py-8 xl:px-10">
        {stage === 'students' ? (
          <div {...tabApi.getContentProps({ value: 'students' })}><StudentsView rows={rows} specialtyRows={specialtyRows} setRows={setRows} setSpecialtyRows={setSpecialtyRows} onEdit={editPerson} confirmAction={confirmAction} /></div>
        ) : (
          <div {...tabApi.getContentProps({ value: 'pps' })}><PpsView rows={ppsRows} setRows={setPpsRows} confirmAction={confirmAction} /></div>
        )}
      </main>
      <PersonDialog open={personOpen} row={editingRow} onOpenChange={(open) => { setPersonOpen(open); if (!open) setEditingRow(null) }} onSave={savePerson} />
      <ConfirmDialog open={confirm.open} title={confirm.title} description={confirm.description} onConfirm={confirm.onConfirm} onOpenChange={(open) => setConfirm((current) => ({ ...current, open }))} />
      <ToastRegion />
    </div>
  )
}
