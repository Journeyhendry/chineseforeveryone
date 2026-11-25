import { useRef, type ReactNode } from 'react'
import type { GameKind } from '../../../games/kinds'
import { useT } from '../../../i18n/context'
import { learnHref } from '../../../lib/router'
import { useFocusOnChange } from '../hooks'
import { LessonBar } from '../parts'

/** Bar atas (keluar ke unit, konteks, hitungan) + judul + petunjuk satu kalimat. */
export function GameHeader(props: {
  kind: GameKind
  unitId: string
  unitName: string
  play: number
  count: string
  value: number
  max: number
  hint: ReactNode
  /** Kunci fokus tambahan (mis. fase game); judul difokus saat berganti. */
  focusKey?: string
}) {
  const t = useT()
  const h1 = useRef<HTMLHeadingElement>(null)
  useFocusOnChange(h1, `game:${props.kind}:${props.play}:${props.focusKey ?? ''}`, props.play > 0 || !!props.focusKey)
  return (
    <>
      <LessonBar
        exitHref={learnHref({ screen: 'unit', unitId: props.unitId })}
        exitLabel={t('learn.exitToUnit')}
        context={`${props.unitName} · ${t(`game.${props.kind}.name`)}`}
        count={props.count}
        value={props.value}
        max={props.max}
        barLabel={t('game.progress')}
      />
      <header className="game-head">
        <h1 ref={h1} tabIndex={-1} className="game-title">
          {t(`game.${props.kind}.name`)}
        </h1>
        <p className="game-hint">{props.hint}</p>
      </header>
    </>
  )
}

/** Pesan bila game tidak bisa dimainkan di unit ini. */
export function GameUnavailable({ message, unitId }: { message: string; unitId: string }) {
  const t = useT()
  return (
    <div className="card game-unavailable" role="status">
      <p>{message}</p>
      <div className="row-actions">
        <a className="btn btn-purple" href={learnHref({ screen: 'games', unitId })}>
          {t('game.other')}
        </a>
        <a className="btn btn-white" href={learnHref({ screen: 'unit', unitId })}>
          {t('game.backToUnit')}
        </a>
      </div>
    </div>
  )
}
