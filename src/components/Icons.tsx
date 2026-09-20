const base = {
  width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
}

export const IconeHoje = () => (
  <svg {...base}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
)
export const IconeRitmo = () => (
  <svg {...base}><path d="M3 20V10M8.5 20V4M14 20v-7M19.5 20V8" /></svg>
)
export const IconeDiario = () => (
  <svg {...base}><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z" /><path d="M5 17a3 3 0 0 1 3-3h11" /><path d="M9 8h6" /></svg>
)
export const IconeConversa = () => (
  <svg {...base}><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12Z" /></svg>
)
export const IconeEnviar = () => (
  <svg {...base}><path d="M4 12h15M13 6l6 6-6 6" /></svg>
)
export const IconeMicrofone = () => (
  <svg {...base}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
)
export const IconeSom = () => (
  <svg {...base}><path d="M5 9h3l4-3v12l-4-3H5z" /><path d="M16 9a4 4 0 0 1 0 6" /></svg>
)
export const IconeAlerta = () => (
  <svg {...base}><path d="M12 4 2.5 20h19L12 4Z" /><path d="M12 10v4M12 17.5h.01" /></svg>
)
export const IconeAbrir = () => (
  <svg {...base}><path d="m9 6 6 6-6 6" /></svg>
)
export const Emblema = () => (
  <svg viewBox="0 0 32 32" width={26} height={26}>
    <defs>
      <radialGradient id="emblema" cx="50%" cy="45%">
        <stop offset="0%" stopColor="#ffd166" />
        <stop offset="58%" stopColor="#ff8a3d" />
        <stop offset="100%" stopColor="#9a3412" />
      </radialGradient>
    </defs>
    <path
      d="M16 3c7 0 12 4 12 10 0 5-3 7-3 11 0 3-2 5-5 5s-4-2-4-4c0-3-2-4-4-4-4 0-8-4-8-9C4 7 9 3 16 3z"
      fill="url(#emblema)"
    />
  </svg>
)
