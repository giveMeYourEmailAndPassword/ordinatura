import { useEffect, useId, useState } from 'react'
import { Portal, normalizeProps, useMachine } from '@zag-js/react'
import * as dialog from '@zag-js/dialog'
import { FUNDING, numeric, uid } from '../lib/domain'
import { ZagSelect } from './ZagSelect'

const yearOptions = ['1 год', '2 год', 'Не определён'].map((value) => ({ label: value, value }))
const fundingOptions = Object.entries(FUNDING).map(([value, label]) => ({ label, value }))
const employmentOptions = ['Основное место', 'Внешний совместитель', 'Внутренний совместитель']
  .map((value) => ({ label: value, value }))

const emptyPerson = {
  name: '', position: '', degree: '', department: '', specialty: '', studyYear: 'Не определён',
  funding: 'budget', rate: 1, phone: '', employment: 'Основное место', workplace: '',
}

function Field({ label, name, value, onChange, type = 'text', required = false, full = false }) {
  return (
    <label className={`grid gap-1.5 ${full ? 'md:col-span-2' : ''}`}>
      <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-600">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        min={type === 'number' ? 0 : undefined}
        max={type === 'number' ? 5 : undefined}
        step={type === 'number' ? 0.05 : undefined}
        className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-800/10"
      />
    </label>
  )
}

export function PersonDialog({ open, row, onOpenChange, onSave }) {
  const id = useId()
  const [form, setForm] = useState(emptyPerson)
  const service = useMachine(dialog.machine, {
    id,
    open,
    onOpenChange: ({ open: next }) => onOpenChange(next),
    role: 'dialog',
  })
  const api = dialog.connect(service, normalizeProps)

  useEffect(() => {
    if (open) setForm({ ...emptyPerson, ...row })
  }, [open, row])

  const set = (name) => (value) => setForm((current) => ({ ...current, [name]: value }))
  const submit = (event) => {
    event.preventDefault()
    onSave({ ...form, id: row?.id || uid(), program: 'Общее', rate: numeric(form.rate) })
    onOpenChange(false)
  }

  if (!open) return null
  return (
    <Portal>
      <div {...api.getBackdropProps()} className="fixed inset-0 z-50 bg-emerald-950/50 backdrop-blur-[2px]" />
      <div {...api.getPositionerProps()} className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-5">
        <div {...api.getContentProps()} className="my-auto w-full max-w-3xl rounded-3xl border border-white/40 bg-stone-50 shadow-2xl outline-none">
          <header className="flex items-center justify-between border-b border-stone-200 px-6 py-5">
            <h2 {...api.getTitleProps()} className="font-serif text-2xl text-emerald-950">{row?.id ? 'Редактировать запись' : 'Новая ставка'}</h2>
            <button {...api.getCloseTriggerProps()} type="button" className="rounded-lg p-2 text-2xl leading-none text-slate-500 hover:bg-stone-200">×</button>
          </header>
          <form onSubmit={submit} className="p-6">
            <p {...api.getDescriptionProps()} className="mb-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Одна строка — один человек. Ставки бюджета и контракта рассчитываются по количеству записей.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Фамилия, имя, отчество" name="name" value={form.name} onChange={set('name')} required full />
              <Field label="Должность" name="position" value={form.position} onChange={set('position')} />
              <Field label="Степень / категория" name="degree" value={form.degree} onChange={set('degree')} />
              <Field label="Кафедра" name="department" value={form.department} onChange={set('department')} />
              <Field label="Специальность" name="specialty" value={form.specialty} onChange={set('specialty')} />
              <ZagSelect label="Год обучения" name="studyYear" value={form.studyYear} onChange={set('studyYear')} options={yearOptions} />
              <ZagSelect label="Источник финансирования" name="funding" value={form.funding} onChange={set('funding')} options={fundingOptions} />
              <Field label="Ставка" name="rate" type="number" value={form.rate} onChange={set('rate')} required />
              <Field label="Телефон" name="phone" type="tel" value={form.phone} onChange={set('phone')} />
              <ZagSelect label="Тип занятости" name="employment" value={form.employment} onChange={set('employment')} options={employmentOptions} />
              <Field label="Место работы совместителя" name="workplace" value={form.workplace} onChange={set('workplace')} full />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button {...api.getCloseTriggerProps()} type="button" className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">Отмена</button>
              <button type="submit" className="rounded-xl border border-amber-500 bg-amber-400 px-5 py-2.5 text-sm font-extrabold text-emerald-950 hover:bg-amber-300">Сохранить</button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  )
}

export function ConfirmDialog({ open, title, description, confirmLabel = 'Подтвердить', danger = true, onOpenChange, onConfirm }) {
  const id = useId()
  const service = useMachine(dialog.machine, {
    id,
    open,
    role: 'alertdialog',
    onOpenChange: ({ open: next }) => onOpenChange(next),
  })
  const api = dialog.connect(service, normalizeProps)
  if (!open) return null

  return (
    <Portal>
      <div {...api.getBackdropProps()} className="fixed inset-0 z-50 bg-emerald-950/50 backdrop-blur-[2px]" />
      <div {...api.getPositionerProps()} className="fixed inset-0 z-[60] grid place-items-center p-5">
        <div {...api.getContentProps()} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl outline-none">
          <h2 {...api.getTitleProps()} className="font-serif text-2xl text-emerald-950">{title}</h2>
          <p {...api.getDescriptionProps()} className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
          <div className="mt-6 flex justify-end gap-3">
            <button {...api.getCloseTriggerProps()} type="button" className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-bold text-slate-700">Отмена</button>
            <button
              type="button"
              onClick={() => { onConfirm(); onOpenChange(false) }}
              className={danger
                ? 'rounded-xl bg-red-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-red-700'
                : 'rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-800'}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
