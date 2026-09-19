import { useId, useMemo, useState } from 'react'
import { Portal, normalizeProps, useMachine } from '@zag-js/react'
import * as combobox from '@zag-js/combobox'
import { Chevron } from './Chevron'

const fold = (value) => String(value ?? '').toLowerCase().replace(/ё/g, 'е')

function Match({ text, query }) {
  const at = query ? fold(text).indexOf(fold(query)) : -1
  if (at < 0) return text
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded bg-amber-200/80 px-0.5 text-emerald-950">{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  )
}

export function SearchSelect({
  ariaLabel,
  title,
  value,
  onChange,
  options,
  resetValue,
  resetLabel = 'Показать все',
  placeholder = 'Ничего не выбрано',
  searchPlaceholder = 'Найти…',
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = options.find((option) => option.value === value)
  const selectedLabel = selected?.label ?? ''
  const needle = query.trim()
  const filtered = useMemo(() => {
    const folded = fold(needle)
    return folded ? options.filter((option) => fold(option.label).includes(folded)) : options
  }, [options, needle])
  const collection = useMemo(
    () => combobox.collection({ items: filtered, itemToString: (item) => item.label, itemToValue: (item) => item.value }),
    [filtered],
  )
  const service = useMachine(combobox.machine, {
    id,
    collection,
    value: [value],
    // закрытое поле показывает текущий выбор, открытое — поисковый запрос
    inputValue: open ? query : selectedLabel,
    open,
    openOnClick: true,
    inputBehavior: 'autohighlight',
    allowCustomValue: false,
    closeOnSelect: true,
    positioning: { placement: 'bottom-start' },
    onInputValueChange: ({ inputValue }) => setQuery(inputValue),
    onOpenChange: ({ open: next }) => { setOpen(next); setQuery('') },
    onValueChange: ({ value: next }) => onChange(next[0] ?? resetValue ?? value),
  })
  const api = combobox.connect(service, normalizeProps)

  return (
    <div {...api.getRootProps()}>
      <div {...api.getControlProps()} className="relative min-w-44">
        <input
          {...api.getInputProps()}
          aria-label={ariaLabel}
          // список открывается на фокус, поэтому поиск всегда начинается с пустого поля
          onFocus={() => { setQuery(''); api.setOpen(true) }}
          placeholder={open ? searchPlaceholder : (selectedLabel ? undefined : placeholder)}
          className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-3 pr-18 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-emerald-800/40 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-800/10"
        />
        {value !== resetValue && (
          <button {...api.getClearTriggerProps()} type="button" aria-label="Сбросить выбор" className="absolute inset-y-0 right-10 grid w-6 place-items-center text-base text-slate-400 transition hover:text-slate-700">×</button>
        )}
        <button {...api.getTriggerProps()} type="button" className="absolute inset-y-0 right-1.5 grid w-8 place-items-center">
          <Chevron open={api.open} />
        </button>
      </div>

      <Portal>
        <div {...api.getPositionerProps()}>
          <div {...api.getContentProps()} className="z-[80] w-[min(30rem,calc(100vw-3rem))] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl outline-none">
            <div className="flex items-center justify-between gap-3 border-b border-stone-100 bg-stone-50 px-4 py-2.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{title}</span>
              <span className="text-[11px] font-bold tabular-nums text-slate-400">{needle ? `${filtered.length} из ${options.length}` : options.length}</span>
            </div>
            <ul {...api.getListProps()} className="max-h-[21rem] overflow-auto p-1.5">
              {filtered.map((item) => (
                <li
                  key={item.value}
                  {...api.getItemProps({ item })}
                  className="flex cursor-pointer items-center justify-between gap-4 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none data-[highlighted]:bg-emerald-50 data-[state=checked]:font-bold data-[state=checked]:text-emerald-900"
                >
                  <span {...api.getItemTextProps({ item })}>
                    <Match text={item.label} query={needle} />
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {item.hint && <span className="text-[11px] tabular-nums text-slate-400">{item.hint}</span>}
                    <span {...api.getItemIndicatorProps({ item })} aria-hidden className="text-emerald-700">✓</span>
                  </span>
                </li>
              ))}
              {filtered.length === 0 && <li><p className="px-4 py-8 text-center text-sm text-slate-500">Ничего не найдено{needle ? ` по «${needle}»` : ''}</p></li>}
            </ul>
            <div className="flex items-center justify-between gap-3 border-t border-stone-100 px-4 py-2 text-[11px] text-slate-400">
              <span>↑ ↓ выбрать · Enter подтвердить · Esc закрыть</span>
              {resetValue !== undefined && value !== resetValue && (
                <button type="button" onClick={() => { api.setValue([resetValue]); setQuery('') }} className="font-extrabold text-emerald-800 hover:underline">{resetLabel}</button>
              )}
            </div>
          </div>
        </div>
      </Portal>
    </div>
  )
}
