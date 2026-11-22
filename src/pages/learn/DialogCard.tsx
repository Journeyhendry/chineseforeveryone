import { useT } from '../../i18n/context'
import type { LessonDialog, PlaceKind } from '../../lib/lessons'
import { useSettings } from '../../lib/settings-context'
import { MachineTag, SpeakButton } from './parts'

/** Ikon kecil per jenis tempat (hiasan saja; teks tempat tetap tertulis). */
const PLACE_ICONS: Record<PlaceKind, string> = {
  home: '🏠',
  school: '🏫',
  market: '🧺',
  eatery: '🍜',
  shop: '🛍️',
  transport: '🚕',
  phone: '📞',
  office: '🏢',
  street: '🚶',
  clinic: '🩺',
  park: '🌳',
}

export function DialogCard({ dialog }: { dialog: LessonDialog }) {
  const t = useT()
  const { settings } = useSettings()
  const lang = settings.lang
  return (
    <section className="card dialog-card" aria-labelledby="dialog-title">
      <p className="eyebrow">{t('learn.dialog.eyebrow')}</p>
      <h2 id="dialog-title" className="card-title">
        {dialog.title[lang]}
      </h2>
      <p className="dialog-goal">
        <span className="dialog-key">{t('learn.dialog.goal')}</span> {dialog.goal[lang]}
      </p>
      <p className="dialog-place">
        <span className="dialog-place-icon" aria-hidden="true">
          {PLACE_ICONS[dialog.placeKind] ?? '📍'}
        </span>
        <span className="sr-only">{t('learn.dialog.place')} </span>
        {dialog.place[lang]}
      </p>
      <p className="muted">
        {dialog.situation[lang]} {dialog.machine ? <MachineTag /> : null}
      </p>
      <ol className="dialog-lines">
        {dialog.lines.map((line, i) => {
          const name = dialog.speakers[line.speaker]?.name[lang] ?? line.speaker
          return (
            <li key={i} className={`dialog-line dialog-${line.gender}`}>
              <span className="dialog-speaker">{name}</span>
              <div className="dialog-bubble">
                <p className="dialog-cmn" lang="zh-CN">
                  {line.tokens.map((tok, j) =>
                    settings.showPinyin && tok.pinyin ? (
                      <ruby key={j}>
                        {tok.text}
                        <rp>(</rp>
                        <rt lang="zh-Latn-pinyin">{tok.pinyin}</rt>
                        <rp>)</rp>
                      </ruby>
                    ) : (
                      <span key={j}>{tok.text}</span>
                    ),
                  )}
                </p>
                <p className="dialog-tr">
                  {line[lang]} {line.machine && !dialog.machine ? <MachineTag /> : null}
                </p>
              </div>
              <SpeakButton text={line.cmn} label={`${name}: ${line.cmn}`} />
            </li>
          )
        })}
      </ol>
    </section>
  )
}
