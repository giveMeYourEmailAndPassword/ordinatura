export function Chevron({ open = false, className = 'size-4' }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={`${className} shrink-0 origin-center text-slate-400 transition-transform duration-200 ease-out ${open ? 'rotate-180' : ''}`}
    >
      <path d="M4.75 7.5 10 12.5l5.25-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
