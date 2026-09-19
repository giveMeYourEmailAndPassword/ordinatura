import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  const inputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = options.find((option) => option.value === value)
  const selectedLabel = selected?.label ?? placeholder
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
    inputValue: query,
    open,
    inputBehavior: 'autohighlight',
    selectionBehavior: 'clear',
    allowCustomValue: false,
    closeOnSelect: true,
    positioning: { placement: 'bottom-start' },
    onInputValueChange: ({ inputValue }) => setQuery(inputValue),
    onOpenChange: ({ open: next }) => { setOpen(next); setQuery('') },
    onValueChange: ({ value: next }) => onChange(next[0] ?? resetValue ?? value),
  })
  const api = combobox.connect(service, normalizeProps)
  const inputProps = api.getInputProps()

  // поиск живёт внутри списка: при открытии сразу ставим в него курсор
  useLayoutEffect(() => { if (open) inputRef.current?.focus() }, [open])

  return (
    <div {...api.getRootProps()}>
      <button
        {...api.getTriggerProps()}
        type="button"
        aria-label={ariaLabel}
        title={selectedLabel}
        className="flex w-60 items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-left text-sm text-slate-700 outline-none transition hover:border-emerald-800/40 focus-visible:ring-4 focus-visible:ring-emerald-800/10"
      >
        <span className="truncate">{selectedLabel}</span>
        <Chevron open={api.open} />
      </button>

      <Portal>
        <div {...api.getPositionerProps()}>
          <div {...api.getContentProps()} className="z-[80] w-[min(30rem,calc(100vw-3rem))] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl outline-none">
            <div className="border-b border-stone-100 bg-stone-50 p-2.5">
              <div className="relative">
                <input
                  {...inputProps}
                  ref={inputRef}
                  aria-label={ariaLabel}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-xl border border-stone-200 bg-white py-2 pl-3 pr-9 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-800/10"
                />
                {needle && (
                  <button type="button" aria-label="Очистить поиск" onClick={() => api.setInputValue('')} className="absolute inset-y-0 right-1 grid w-6 place-items-center text-base text-slate-400 transition hover:text-slate-700">×</button>
                )}
              </div>
            </div>

            <ul {...api.getListProps()} aria-label={title} className="max-h-[21rem] overflow-auto p-1.5">
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
              <span className="tabular-nums">{needle ? `Найдено: ${filtered.length} из ${options.length}` : `Всего: ${options.length}`} · ↑ ↓ · Enter · Esc</span>
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
