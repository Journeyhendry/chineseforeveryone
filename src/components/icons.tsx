import type { ReactNode } from 'react'

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

export const MapIcon = () => (
  <Icon>
    <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
    <path d="M9 4v14M15 6v14" />
  </Icon>
)

export const RepeatIcon = () => (
  <Icon>
    <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
    <path d="M3 21v-5h5" />
  </Icon>
)

export const BookIcon = () => (
  <Icon>
    <path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3Z" />
    <path d="M4 17a3 3 0 0 1 3-3h11" />
  </Icon>
)

export const ChartIcon = () => (
  <Icon>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Icon>
)

export const GearIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
  </Icon>
)

export const SpeakerIcon = () => (
  <Icon>
    <path d="M4 9v6h4l5 4V5L8 9Z" />
    <path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" />
  </Icon>
)

export const SpeakerSlowIcon = () => (
  <Icon>
    <path d="M4 9v6h4l5 4V5L8 9Z" />
  </Icon>
)

export const LockIcon = () => (
  <Icon>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Icon>
)

export const CloseIcon = () => (
  <Icon>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
)

export const PlayIcon = () => (
  <Icon>
    <path d="M7 4v16l13-8Z" />
  </Icon>
)

export const PauseIcon = () => (
  <Icon>
    <path d="M8 5v14M16 5v14" />
  </Icon>
)

export const ArrowRightIcon = () => (
  <Icon>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
)

export const ArrowLeftIcon = () => (
  <Icon>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Icon>
)

export const CheckIcon = () => (
  <Icon>
    <path d="m5 12 5 5 9-10" />
  </Icon>
)

/** Bintang; `filled` diisi kuning. */
export const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg aria-hidden="true" focusable="false" width="22" height="22" viewBox="0 0 24 24" className={filled ? 'star is-filled' : 'star'}>
    <path
      d="m12 2.5 2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.2l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8Z"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
  </svg>
)

/** Ikon api untuk hari berturut-turut (dekoratif; beri teks di sebelahnya). */
export const FlameIcon = () => (
  <svg
    aria-hidden="true"
    focusable="false"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="var(--orange)"
    stroke="var(--ink)"
    strokeWidth="2"
    strokeLinejoin="round"
  >
    <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9Z" />
  </svg>
)
