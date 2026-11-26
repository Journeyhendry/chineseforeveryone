import { useCallback, useEffect, useRef, useState } from 'react'
import type { PlayPreset, SceneIndex, SceneIndexBubble, SceneIndexEntry } from '../../art/scenes/types'
import { SpeakerIcon, SpeakerSlowIcon } from '../../components/icons'
import { useT } from '../../i18n/context'
import { audioToken, SLOW_RATE, speak, stopAudio, type Voice } from '../../lib/audio'
import type { Speaker, WordDialog, WordSentence } from '../../lib/lessons'
import { playLines, type PlayerLine } from '../../lib/line-player'
import { layoutBubbleText, sanitizeSvg, splitHighlight } from '../../lib/scene-svg'
import { useSettings } from '../../lib/settings-context'
import { useAudio, useReducedMotion } from './hooks'
import { TonePinyin } from './parts'
import { tatoebaUrl } from './text'
import './scene.css'

const sceneUrl = (file: string) => `${import.meta.env.BASE_URL}art/scenes/${file}`

/** How long each action preset plays (ms); must cover the longest animation in scene.css. */
const PLAY_MS: Record<PlayPreset, number> = {
  wave: 2000,
  bow: 2400,
  nod: 1700,
  'shake-head': 1700,
  point: 1700,
  'count-up': 2800,
  'move-to': 1900,
  'pop-bubble': 1800,
  'swap-pair': 2700,
  jump: 1500,
  shrug: 1700,
  beckon: 1900,
  panels: 2700,
  origin: 3200,
  clock: 2600,
}

let indexPromise: Promise<SceneIndex | null> | null = null

function loadIndex(): Promise<SceneIndex | null> {
  indexPromise ??= fetch(sceneUrl('index.json'))
    .then((r) => (r.ok ? (r.json() as Promise<SceneIndex>) : null))
    .catch(() => null)
    .then((idx) => {
      if (!idx) indexPromise = null
      return idx
    })
  return indexPromise
}

type Loaded = { wordId: string; entry: SceneIndexEntry; svg: string }

/** One line of the word's sentence / dialog, as shown under the picture and played. */
interface ShownLine {
  who: string | null
  hanzi: string
  pinyin: string
  id: string
  en: string
  outsideWords: string[]
}

function shownLines(sentence: WordSentence, dialog: WordDialog | null): ShownLine[] {
  if (dialog) return dialog.lines
  return [{ who: sentence.speaker, hanzi: sentence.hanzi, pinyin: sentence.pinyin, id: sentence.id, en: sentence.en, outsideWords: sentence.outsideWords }]
}

/** Old scenes (until task 6c 2b redraws them) have text balloons without line numbers: they are hidden. */
const isLegacy = (bubbles: SceneIndexBubble[]) => bubbles.length > 0 && bubbles.every((b) => b.line === undefined)

function Highlighted({ text, word }: { text: string; word: string }) {
  return (
    <>
      {splitHighlight(text, word).map((p, j) =>
        p.hl ? (
          <mark key={j} className="scene-hl">
            {p.text}
          </mark>
        ) : (
          <span key={j}>{p.text}</span>
        ),
      )}
    </>
  )
}

export interface WordSceneProps {
  wordId: string
  hanzi: string
  sentence: WordSentence | null
  dialog: WordDialog | null
  speakers: Record<string, Speaker>
}

/**
 * Sentence card of a word (task 6c): the scene SVG (fetched only for the word on screen) with the
 * sentence / dialog in its balloons, the lines as text below, and a player that shows and sounds the
 * lines one by one on click / Enter / Space on the picture or the Play / Slow buttons. Words without a
 * scene get the text and the buttons only. Renders nothing for a word without a sentence.
 */
export function WordScene({ wordId, hanzi, sentence, dialog, speakers }: WordSceneProps) {
  const t = useT()
  const { settings } = useSettings()
  const lang = settings.lang
  const { sourceFor } = useAudio()
  const reduced = useReducedMotion()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [current, setCurrent] = useState<number | null>(null)
  const [played, setPlayed] = useState(false)
  const stage = useRef<HTMLButtonElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const stopper = useRef<(() => void) | null>(null)

  useEffect(() => {
    let alive = true
    loadIndex()
      .then(async (idx) => {
        const entry = idx?.scenes[wordId]
        if (!entry) return null
        const r = await fetch(sceneUrl(entry.file))
        if (!r.ok) return null
        const svg = sanitizeSvg(await r.text())
        return svg ? { wordId, entry, svg } : null
      })
      .catch(() => null)
      .then((res) => {
        if (alive) setLoaded(res)
      })
    return () => {
      alive = false
    }
  }, [wordId])

  // leaving the word (or the page) stops the sentence
  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
      if (stopper.current) {
        stopper.current()
        stopper.current = null
        stopAudio()
      }
    },
    [],
  )

  const scene = loaded && loaded.wordId === wordId ? loaded : null
  const lines = sentence ? shownLines(sentence, dialog) : []
  const lineBubbles = scene && !isLegacy(scene.entry.bubbles) ? scene.entry.bubbles : []
  const animate = !reduced && current !== null

  // speaking character + SVG balloons follow the line now playing (the SVG is not React-rendered)
  useEffect(() => {
    const svg = stage.current?.querySelector('.scene-svg')
    if (!svg) return
    for (const el of svg.querySelectorAll('.is-talking, .is-hidden, .is-pop')) el.classList.remove('is-talking', 'is-hidden', 'is-pop')
    if (!animate || current === null) return
    for (const el of svg.querySelectorAll<SVGGElement>('.bubble[class*="line-"]')) {
      const m = /\bline-(\d+)\b/.exec(el.getAttribute('class') ?? '')
      const n = m ? Number(m[1]) : -1
      if (n > current) el.classList.add('is-hidden')
      else if (n === current) el.classList.add('is-pop')
    }
    for (const b of scene?.entry.bubbles ?? []) if (b.line === current && b.char) svg.querySelector(`.c-${b.char}`)?.classList.add('is-talking')
  }, [animate, current, scene])

  const voiceOf = useCallback((who: string | null): Voice => (who && speakers[who]?.gender === 'male' ? 'male' : 'female'), [speakers])

  if (!sentence) return null

  const start = (slow: boolean) => {
    stopper.current?.()
    setPlayed(true)
    const el = stage.current
    if (el && scene && !reduced) {
      window.clearTimeout(timer.current)
      el.classList.remove('is-playing')
      // restart the CSS animations cleanly instead of stacking them
      void el.offsetWidth
      el.classList.add('is-playing')
      timer.current = window.setTimeout(() => el.classList.remove('is-playing'), PLAY_MS[scene.entry.play] ?? 2000)
    }
    const list: PlayerLine[] = lines.map((l) => ({ text: l.hanzi, voice: voiceOf(l.who) }))
    stopper.current = playLines(
      list,
      {
        rate: slow ? SLOW_RATE : settings.voiceSpeed,
        onLine: (l) => {
          setCurrent(l)
          if (l === null) stopper.current = null
        },
      },
      {
        speak,
        token: audioToken,
        setTimeout: (fn, ms) => window.setTimeout(fn, ms),
        clearTimeout: (id) => window.clearTimeout(id),
      },
    )
  }

  const title = dialog ? t('learn.scene.titleDialog') : t('learn.scene.title')
  const allText = lines.map((l) => l.hanzi).join(' ')
  const source = sourceFor(lines[0].hanzi, voiceOf(lines[0].who))
  const legacy = scene ? isLegacy(scene.entry.bubbles) : false
  const stageCls = ['scene-stage', animate ? 'is-seq' : '', legacy ? 'is-legacy' : ''].filter(Boolean).join(' ')

  return (
    <section className="card scene-card" aria-labelledby={`scene-title-${wordId}`}>
      <h2 id={`scene-title-${wordId}`} className="card-title scene-title">
        {title}
      </h2>
      <div className="scene-body">
        {scene ? (
          <div className="scene-figure">
            <button
              ref={stage}
              type="button"
              className={stageCls}
              data-play={scene.entry.play}
              aria-label={t('learn.scene.label', { alt: scene.entry.alt[lang] })}
              onClick={() => start(false)}
            >
              <span className="scene-svg" aria-hidden="true" dangerouslySetInnerHTML={{ __html: scene.svg }} />
              <span className="scene-texts" aria-hidden="true">
                {lineBubbles.map((b, i) => {
                  const lay = layoutBubbleText(b.text, b.w, b.h, b.highlight ? hanzi : '')
                  const state = animate && b.line !== undefined ? (b.line > (current as number) ? 'is-hidden' : b.line === current ? 'is-pop' : '') : ''
                  return (
                    <span
                      key={i}
                      className={`scene-bubble in-panel-${b.panel} ${state}`}
                      lang="zh-CN"
                      style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%`, fontSize: `${lay.font}cqw` }}
                    >
                      {lay.lines.map((ln, j) => (
                        <span key={j} className="scene-bubble-line">
                          <Highlighted text={ln} word={b.highlight ? hanzi : ''} />
                        </span>
                      ))}
                    </span>
                  )
                })}
              </span>
            </button>
            <p className="scene-hint">{t('learn.scene.hint')}</p>
          </div>
        ) : null}

        <div className="scene-text">
          <div className="audio-buttons scene-controls">
            <div className="audio-row">
              <button type="button" className="btn btn-yellow" aria-label={t('learn.scene.playLabel', { text: allText })} onClick={() => start(false)}>
                <SpeakerIcon />
                <span>{played ? t('learn.scene.replay') : t('learn.scene.play')}</span>
              </button>
              <button type="button" className="btn btn-white" aria-label={t('learn.scene.slowLabel', { text: allText })} onClick={() => start(true)}>
                <SpeakerSlowIcon />
                <span>{t('learn.scene.slow')}</span>
              </button>
            </div>
            {source === 'device' ? <span className="audio-note">{t('learn.audio.device')}</span> : null}
          </div>

          {dialog ? (
            <p className="scene-reason">
              <span className="dialog-key">{t('learn.scene.why')}</span> {dialog.reason[lang]}
            </p>
          ) : null}

          <ol className={`sent-lines ${dialog ? 'is-dialog' : ''}`}>
            {lines.map((l, i) => {
              const name = l.who ? (speakers[l.who]?.name[lang] ?? l.who) : null
              const now = current === i
              return (
                <li key={i} className={`sent-line sent-${voiceOf(l.who)} ${now ? 'is-current' : ''}`} aria-current={now ? 'true' : undefined}>
                  {name ? <span className="sent-speaker">{name}</span> : null}
                  {now ? <span className="sr-only">{t('learn.scene.now')}</span> : null}
                  <p className="sent-cmn" lang="zh-CN">
                    <Highlighted text={l.hanzi} word={hanzi} />
                  </p>
                  {settings.showPinyin ? (
                    <p className="sent-pinyin">
                      <TonePinyin pinyin={l.pinyin} />
                    </p>
                  ) : null}
                  <p className="sent-tr" lang={lang}>
                    {l[lang]}
                  </p>
                  {l.outsideWords.length ? (
                    <p className="sent-outside">
                      <span className="sent-outside-tag">{t('learn.scene.outside')}</span>{' '}
                      <span lang="zh-CN" className="hanzi-inline">
                        {l.outsideWords.join('、')}
                      </span>
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ol>

          {sentence.source === 'tatoeba' && sentence.sourceId !== null ? (
            <p className="example-src">
              {t('learn.scene.source')}{' '}
              <a href={tatoebaUrl(Number(sentence.sourceId))} target="_blank" rel="noopener noreferrer">
                Tatoeba #{sentence.sourceId}
              </a>
              {sentence.author ? ` · ${sentence.author}` : ''}
              {sentence.license ? ` · ${sentence.license}` : ''}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
