import { useId, useMemo } from 'react'
import { Portal, normalizeProps, useMachine } from '@zag-js/react'
import * as select from '@zag-js/select'

export function ZagSelect({ label, ariaLabel, value, onChange, options, name, compact = false }) {
  const id = useId()
  const collection = useMemo(() => select.collection({ items: options }), [options])
  const service = useMachine(select.machine, {
    id,
    collection,
    value: [value],
    positioning: { sameWidth: true, placement: 'bottom-start' },
    onValueChange: ({ value: next }) => onChange(next[0]),
  })
  const api = select.connect(service, normalizeProps)

  return (
    <div {...api.getRootProps()} className={compact ? 'min-w-40' : 'grid gap-1.5'}>
      {label && <label {...api.getLabelProps()} className="text-[11px] font-extrabold uppercase tracking-wide text-slate-600">{label}</label>}
      <div {...api.getControlProps()}>
        <button
          {...api.getTriggerProps()}
          aria-label={ariaLabel}
          type="button"
          className="flex w-full min-w-40 items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-left text-sm text-slate-700 outline-none transition hover:border-emerald-800/40 focus-visible:ring-4 focus-visible:ring-emerald-800/10"
        >
          <span {...api.getValueTextProps()}>{api.valueAsString}</span>
          <span aria-hidden className={`text-xs text-slate-400 transition ${api.open ? 'rotate-180' : ''}`}>⌄</span>
        </button>
      </div>
      <select {...api.getHiddenSelectProps()} name={name} />
      <Portal>
        <div {...api.getPositionerProps()} className="z-[80]">
          <div
            {...api.getContentProps()}
            className="max-h-72 overflow-auto rounded-xl border border-stone-200 bg-white p-1.5 shadow-2xl outline-none"
          >
            {options.map((item) => (
              <div
                key={item.value}
                {...api.getItemProps({ item })}
                className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-700 outline-none data-[highlighted]:bg-emerald-50 data-[state=checked]:font-bold data-[state=checked]:text-emerald-900"
              >
                <span {...api.getItemTextProps({ item })}>{item.label}</span>
                <span {...api.getItemIndicatorProps({ item })} aria-hidden>✓</span>
              </div>
            ))}
          </div>
        </div>
      </Portal>
    </div>
  )
}
