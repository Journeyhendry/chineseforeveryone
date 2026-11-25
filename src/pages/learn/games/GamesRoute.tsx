// Layar game unit (dimuat malas dari LearnPage): pilih game + menjalankan satu game sampai layar selesai.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { StarIcon } from '../../../components/icons'
import type { GameKind } from '../../../games/kinds'
import { useT } from '../../../i18n/context'
import { stopAudio } from '../../../lib/audio'
import type { LessonUnitInfo, UnitData } from '../../../lib/lessons'
import { recordGameResult } from '../../../lib/progress'
import { learnHref, type LearnRoute } from '../../../lib/router'
import { useSettings } from '../../../lib/settings-context'
import { updateProgress, useDocumentTitle, useFocusOnChange } from '../hooks'
import { BackLink } from '../parts'
import { FlashcardsGame } from './FlashcardsGame'
import { GameCards } from './GameCards'
import { MatchGame } from './MatchGame'
import { SentenceGame } from './SentenceGame'
import { ToneGame } from './ToneGame'
import type { GameProps, GameResult } from './types'
import '../quiz.css'
import './games.css'

export default function GamesRoute({ route, info, data }: { route: LearnRoute; info: LessonUnitInfo; data: UnitData }) {
  if (route.screen === 'game') return <GameRunner key={route.game} kind={route.game} info={info} data={data} />
  return <GamePicker info={info} />
}

function useUnitName(info: LessonUnitInfo) {
  const t = useT()
  const { settings } = useSettings()
  return `${t('learn.unitNo', { n: info.order })} · ${info.title[settings.lang]}`
}

function GamePicker({ info }: { info: LessonUnitInfo }) {
  const t = useT()
  const unitName = useUnitName(info)
  const h1 = useRef<HTMLHeadingElement>(null)
  useDocumentTitle(`${t('game.picker.title')} · ${unitName}`)
  useFocusOnChange(h1, `games:${info.id}`)
  return (
    <div className="learn-games">
      <BackLink href={learnHref({ screen: 'unit', unitId: info.id })}>{t('game.backToUnit')}</BackLink>
      <header className="page-header">
        <span className="eyebrow">{unitName}</span>
        <h1 ref={h1} tabIndex={-1}>
          {t('game.picker.title')}
        </h1>
        <p className="muted">{t('game.picker.intro')}</p>
      </header>
      <GameCards unitId={info.id} />
    </div>
  )
}

const GAMES: Record<GameKind, (p: GameProps) => ReactNode> = {
  kartu: FlashcardsGame,
  jodohkan: MatchGame,
  nada: ToneGame,
  susun: SentenceGame,
}

function GameRunner({ kind, info, data }: { kind: GameKind; info: LessonUnitInfo; data: UnitData }) {
  const t = useT()
  const unitName = useUnitName(info)
  const [play, setPlay] = useState(0)
  const [result, setResult] = useState<{ play: number; r: GameResult; newBest: boolean } | null>(null)
  const done = result?.play === play ? result : null
  useDocumentTitle(`${t(`game.${kind}.name`)} · ${unitName}`)

  // Suara berhenti saat game diganti / ditutup.
  useEffect(() => () => stopAudio(), [])

  const finish = useCallback(
    (r: GameResult) => {
      stopAudio()
      let newBest = false
      updateProgress((p) => {
        const old = p.games?.[info.id]?.[kind]
        newBest = !!old && r.stars > old.best
        return recordGameResult(p, info.id, kind, r.stars)
      })
      setResult({ play, r, newBest })
    },
    [info.id, kind, play],
  )

  const again = () => {
    stopAudio()
    setResult(null)
    setPlay((n) => n + 1)
  }

  const Game = GAMES[kind]
  return (
    <div className="learn-game">
      {done ? (
        <GameFinish kind={kind} info={info} result={done.r} newBest={done.newBest} onAgain={again} />
      ) : (
        <Game key={play} play={play} info={info} data={data} unitName={unitName} onFinish={finish} />
      )}
    </div>
  )
}

function GameFinish({ kind, info, result, newBest, onAgain }: { kind: GameKind; info: LessonUnitInfo; result: GameResult; newBest: boolean; onAgain: () => void }) {
  const t = useT()
  const h1 = useRef<HTMLHeadingElement>(null)
  useFocusOnChange(h1, 'finish', true)
  return (
    <section className="card result-card game-finish" aria-labelledby="game-finish-title">
      <span className="eyebrow">{t(`game.${kind}.name`)}</span>
      <h1 id="game-finish-title" ref={h1} tabIndex={-1} className="result-title">
        {t('game.done')}
      </h1>
      <div className="result-stars">
        {[1, 2, 3].map((n) => (
          <span key={n} className={`result-star${n <= result.stars ? ' is-on' : ''}`} style={{ animationDelay: `${n * 120}ms` }}>
            <StarIcon filled={n <= result.stars} />
          </span>
        ))}
        <span className="sr-only">{t('learn.stars', { n: result.stars })}</span>
      </div>
      <p className="result-score">{result.score}</p>
      {result.detail ? <p className="result-message">{result.detail}</p> : null}
      {newBest ? <p className="game-new-best">{t('game.newBest')}</p> : null}
      <p className="muted game-rule">{result.rule}</p>
      <div className="row-actions result-actions">
        <button type="button" className="btn btn-big" onClick={onAgain}>
          {t('game.again')}
        </button>
        <a className="btn btn-purple" href={learnHref({ screen: 'games', unitId: info.id })}>
          {t('game.other')}
        </a>
        <a className="btn btn-white" href={learnHref({ screen: 'unit', unitId: info.id })}>
          {t('game.backToUnit')}
        </a>
      </div>
      <p className="muted game-rule">{t('game.noEffect')}</p>
    </section>
  )
}
