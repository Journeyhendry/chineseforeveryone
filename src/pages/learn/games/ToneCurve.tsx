import type { PlainTone } from '../../../games/tone'

const CURVES: Record<PlainTone, string> = {
  1: 'M4 6h32',
  2: 'M4 20 36 4',
  3: 'M4 8q14 22 32-4',
  4: 'M4 4l32 16',
}

/** Garis nada (dekoratif; tanda & angka nada ditulis di sebelahnya). */
export function ToneCurve({ tone }: { tone: PlainTone }) {
  return (
    <svg className="tone-curve" aria-hidden="true" width="48" height="28" viewBox="0 0 40 24" fill="none" stroke={`var(--tone-${tone})`} strokeWidth="3.4" strokeLinecap="round">
      <path d={CURVES[tone]} />
    </svg>
  )
}
