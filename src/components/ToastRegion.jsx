import { useEffect, useId, useState } from 'react'
import { normalizeProps, useMachine } from '@zag-js/react'
import * as toast from '@zag-js/toast'

export const toaster = toast.createStore({
  placement: 'bottom-end',
  overlap: false,
  gap: 12,
  duration: 3200,
})

function ToastItem({ item, parent }) {
  const service = useMachine(toast.machine, { ...item, parent })
  const api = toast.connect(service, normalizeProps)
  const tone = api.type === 'error'
    ? 'border-red-200 bg-red-50 text-red-950'
    : api.type === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-950'
      : 'border-emerald-800 bg-emerald-950 text-white'

  return (
    <div
      {...api.getRootProps()}
      className={`pointer-events-auto grid min-w-80 max-w-md grid-cols-[1fr_auto] gap-4 rounded-2xl border px-4 py-3 shadow-2xl ${tone}`}
    >
      <div>
        {api.title && <div {...api.getTitleProps()} className="text-sm font-extrabold">{api.title}</div>}
        {api.description && <div {...api.getDescriptionProps()} className="mt-1 text-xs opacity-75">{api.description}</div>}
      </div>
      {api.closable && (
        <button {...api.getCloseTriggerProps()} type="button" className="self-start rounded p-1 text-lg leading-none opacity-60 hover:opacity-100" aria-label="Закрыть">×</button>
      )}
    </div>
  )
}

export function ToastRegion() {
  const id = useId()
  const service = useMachine(toast.group.machine, { id, store: toaster })
  const api = toast.group.connect(service, normalizeProps)
  const [items, setItems] = useState(() => api.getToasts())

  useEffect(() => api.subscribe(setItems), [service]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div {...api.getGroupProps({ label: 'Уведомления' })} className="pointer-events-none fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
      {items.map((item) => <ToastItem key={item.id} item={item} parent={service} />)}
    </div>
  )
}
