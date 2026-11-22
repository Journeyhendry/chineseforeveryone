import { PageHeader } from '../components/ComingSoon'
import { useT, type MessageKey } from '../i18n/context'
import { useSettings } from '../lib/settings-context'
import { DAILY_GOALS, type DailyGoal, type Lang, type Settings, type ThemeSetting } from '../lib/settings'

function RadioGroup<V extends string | number>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string
  name: string
  value: V
  options: { value: V; label: string }[]
  onChange: (v: V) => void
}) {
  return (
    <fieldset className="card field">
      <legend>{legend}</legend>
      <div className="choices">
        {options.map((o) => (
          <label key={String(o.value)} className="choice">
            <input
              type="radio"
              name={name}
              checked={o.value === value}
              onChange={() => onChange(o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="card toggle">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-text">
        <span className="toggle-label">{label}</span>
        <span className="muted">{hint}</span>
      </span>
    </label>
  )
}

export function SettingsPage() {
  const t = useT()
  const { settings, update } = useSettings()
  const opt = <V extends string | number>(value: V, key: MessageKey) => ({
    value,
    label: t(key),
  })
  return (
    <>
      <PageHeader title={t('settings.title')} />
      <p className="muted">{t('settings.intro')}</p>
      <div className="settings-list">
        <RadioGroup<Lang>
          legend={t('settings.lang.legend')}
          name="lang"
          value={settings.lang}
          options={[opt('id', 'lang.name.id'), opt('en', 'lang.name.en')]}
          onChange={(lang) => update({ lang })}
        />
        <Toggle
          label={t('settings.pinyin.label')}
          hint={t('settings.pinyin.hint')}
          checked={settings.showPinyin}
          onChange={(showPinyin) => update({ showPinyin })}
        />
        <RadioGroup<Settings['voiceSpeed']>
          legend={t('settings.voice.legend')}
          name="voiceSpeed"
          value={settings.voiceSpeed}
          options={[opt(1, 'settings.voice.normal'), opt(0.75, 'settings.voice.slow')]}
          onChange={(voiceSpeed) => update({ voiceSpeed })}
        />
        <Toggle
          label={t('settings.sound.label')}
          hint={t('settings.sound.hint')}
          checked={settings.soundEffects}
          onChange={(soundEffects) => update({ soundEffects })}
        />
        <RadioGroup<DailyGoal>
          legend={t('settings.goal.legend')}
          name="dailyGoal"
          value={settings.dailyGoal}
          options={DAILY_GOALS.map((g) => ({ value: g, label: t('review.goalOption', { n: g }) }))}
          onChange={(dailyGoal) => update({ dailyGoal })}
        />
        <RadioGroup<ThemeSetting>
          legend={t('settings.theme.legend')}
          name="theme"
          value={settings.theme}
          options={[
            opt('system', 'settings.theme.system'),
            opt('light', 'settings.theme.light'),
            opt('dark', 'settings.theme.dark'),
          ]}
          onChange={(theme) => update({ theme })}
        />
      </div>
    </>
  )
}
