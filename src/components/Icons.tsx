const base = {
  width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
}

export const IconToday = () => (
  <svg {...base}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
)
export const IconRhythm = () => (
  <svg {...base}><path d="M3 20V10M8.5 20V4M14 20v-7M19.5 20V8" /></svg>
)
export const IconWork = () => (
  <svg {...base}><rect x="3.5" y="7" width="17" height="12.5" rx="2.5" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /><path d="M3.5 12.5h17" /></svg>
)
export const IconJournal = () => (
  <svg {...base}><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z" /><path d="M5 17a3 3 0 0 1 3-3h11" /><path d="M9 8h6" /></svg>
)
export const IconChat = () => (
  <svg {...base}><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12Z" /></svg>
)
export const IconSend = () => (
  <svg {...base}><path d="M4 12h15M13 6l6 6-6 6" /></svg>
)
export const IconMicrophone = () => (
  <svg {...base}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
)
export const IconSound = () => (
  <svg {...base}><path d="M5 9h3l4-3v12l-4-3H5z" /><path d="M16 9a4 4 0 0 1 0 6" /></svg>
)
export const IconMuted = () => (
  <svg {...base}><path d="M5 9h3l4-3v12l-4-3H5z" /><path d="M16 10.5l4 3M20 10.5l-4 3" /></svg>
)
export const IconStop = () => (
  <svg {...base}><rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor" stroke="none" /></svg>
)
export const IconAlert = () => (
  <svg {...base}><path d="M12 4 2.5 20h19L12 4Z" /><path d="M12 10v4M12 17.5h.01" /></svg>
)
export const IconOpen = () => (
  <svg {...base}><path d="m9 6 6 6-6 6" /></svg>
)
export const IconSettings = () => (
  <svg {...base}><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" /></svg>
)
export const IconFolder = () => (
  <svg {...base}><path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></svg>
)
export const IconKey = () => (
  <svg {...base}><circle cx="8" cy="12" r="3.6" /><path d="M11.6 12H21M18 12v3M15 12v2.2" /></svg>
)
export const Badge = () => (
  <img src="/brand.png" alt="" width={26} height={26} style={{ objectFit: 'contain' }} />
)
