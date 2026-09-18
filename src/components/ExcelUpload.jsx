import { useEffect, useId, useMemo } from 'react'
import { normalizeProps, useMachine } from '@zag-js/react'
import * as fileUpload from '@zag-js/file-upload'

const EXCEL_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]

export function ExcelUpload({ children, onFiles, multiple = false, primary = false }) {
  const id = useId()
  const service = useMachine(fileUpload.machine, {
    id,
    accept: EXCEL_TYPES,
    maxFiles: multiple ? 20 : 1,
    translations: { dropzone: 'Перетащите Excel или выберите файл' },
  })
  const api = fileUpload.connect(service, normalizeProps)
  const signature = useMemo(
    () => api.acceptedFiles.map((file) => `${file.name}:${file.size}:${file.lastModified}`).join('|'),
    [api.acceptedFiles],
  )

  useEffect(() => {
    if (!api.acceptedFiles.length) return undefined
    let active = true
    Promise.resolve(onFiles([...api.acceptedFiles])).finally(() => {
      if (active) api.clearFiles()
    })
    return () => { active = false }
  }, [signature]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div {...api.getRootProps()} className="inline-flex">
      <input {...api.getHiddenInputProps()} />
      <button
        {...api.getTriggerProps()}
        type="button"
        className={primary
          ? 'rounded-xl border border-amber-500 bg-amber-400 px-4 py-2.5 text-sm font-extrabold text-emerald-950 shadow-sm transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/40'
          : 'rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-800/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-800/10'}
      >
        {children}
      </button>
    </div>
  )
}
