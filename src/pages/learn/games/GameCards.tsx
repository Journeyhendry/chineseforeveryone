// Kartu pilihan game (dipakai di ringkasan unit dan layar pilih game). Ikon SVG kecil buatan sendiri.
import { GAME_KINDS, type GameKind } from '../../../games/kinds'
import { useT } from '../../../i18n/context'
import { learnHref } from '../../../lib/router'
import { useProgress } from '../hooks'
import { Stars } from '../parts'
import './game-cards.css'

export function GameIcon({ kind }: { kind: GameKind }) {
  const common = { width: 56, height: 56, viewBox: '0 0 56 56', 'aria-hidden': true, fill: 'none', stroke: 'var(--ink)', strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  switch (kind) {
    case 'kartu':
      return (
        <svg {...common}>
          <rect x="8" y="12" width="26" height="34" rx="6" fill="var(--surface-3)" transform="rotate(-10 21 29)" />
          <rect x="22" y="9" width="26" height="34" rx="6" fill="var(--yellow)" />
          <path d="M30 22h10M35 17v16M30 33l5-4 5 4" />
        </svg>
      )
    case 'jodohkan':
      return (
        <svg {...common}>
          <rect x="5" y="10" width="18" height="14" rx="4" fill="var(--yellow)" />
          <rect x="5" y="32" width="18" height="14" rx="4" fill="var(--tone-surface)" />
          <rect x="33" y="10" width="18" height="14" rx="4" fill="var(--tone-surface)" />
          <rect x="33" y="32" width="18" height="14" rx="4" fill="var(--yellow)" />
          <path d="M23 17l10 22M23 39l10-22" />
        </svg>
      )
    case 'nada':
      return (
        <svg {...common}>
          <circle cx="28" cy="28" r="22" fill="var(--tone-surface)" />
          <path d="M14 18h8" stroke="var(--tone-1)" strokeWidth="4" />
          <path d="M28 24l8-8" stroke="var(--tone-2)" strokeWidth="4" />
          <path d="M14 32q6 10 10 0" stroke="var(--tone-3)" strokeWidth="4" />
          <path d="M32 30l10 10" stroke="var(--tone-4)" strokeWidth="4" />
        </svg>
      )
    case 'susun':
      return (
        <svg {...common}>
          <rect x="5" y="30" width="14" height="14" rx="4" fill="var(--tone-surface)" />
          <rect x="21" y="30" width="14" height="14" rx="4" fill="var(--yellow)" />
          <rect x="37" y="30" width="14" height="14" rx="4" fill="var(--tone-surface)" />
          <rect x="23" y="6" width="14" height="14" rx="4" fill="var(--yellow)" transform="rotate(12 30 13)" />
          <path d="M28 22v4" />
        </svg>
      )
  }
}

/** Daftar 4 kartu game unit; `headingLevel` 2 di ringkasan unit, 2 juga di layar pilih game. */
export function GameCards({ unitId }: { unitId: string }) {
  const t = useT()
  const progress = useProgress()
  const scores = progress.games?.[unitId] ?? {}
  return (
    <ul className="game-cards">
      {GAME_KINDS.map((kind) => {
        const best = scores[kind]
        return (
          <li key={kind}>
            <a className={`game-card game-card-${kind}`} href={learnHref({ screen: 'game', unitId, game: kind })}>
              <span className="game-card-icon">
                <GameIcon kind={kind} />
              </span>
              <span className="game-card-text">
                <span className="game-card-name">{t(`game.${kind}.name`)}</span>
                <span className="game-card-desc">{t(`game.${kind}.desc`)}</span>
                <span className="game-card-best">
                  {best ? (
                    <>
                      {t('game.best')} <Stars stars={best.best} />
                    </>
                  ) : (
                    t('game.notPlayed')
                  )}
                </span>
              </span>
            </a>
          </li>
        )
      })}
    </ul>
  )
}
