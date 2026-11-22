import { useEffect, useRef, useState } from 'react'
import { useT } from '../../i18n/context'
import { backupFileName, BACKUP_MAX_BYTES, makeBackup, parseBackup, type BackupError, type BackupSummary } from '../../lib/backup'
import type { Progress } from '../../lib/progress'
import { useSettings } from '../../lib/settings-context'
import type { Settings } from '../../lib/settings'
import { updateProgress, useProgress } from '../learn/hooks'

interface Pending {
  progress: Progress
  settings: Settings
  summary: BackupSummary
}

type Notice = { kind: 'status' | 'error'; text: string } | null

export function BackupPanel() {
  const t = useT()
  const { settings, replace } = useSettings()
  const progress = useProgress()
  const [pending, setPending] = useState<Pending | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const summaryRef = useRef<HTMLHeadingElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const save = () => {
    const now = new Date()
    const name = backupFileName(now)
    const blob = new Blob([JSON.stringify(makeBackup(progress, settings, now), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice({ kind: 'status', text: t('backup.saved', { file: name }) })
  }

  const fail = (error: BackupError | 'read') => {
    setPending(null)
    setNotice({ kind: 'error', text: t(`backup.err.${error}`) })
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    if (fileRef.current) fileRef.current.value = '' // supaya file yang sama bisa dipilih lagi
    setNotice(null)
    setPending(null)
    if (file.size > BACKUP_MAX_BYTES) return fail('too-big')
    let text: string
    try {
      text = await file.text()
    } catch {
      return fail('read')
    }
    const parsed = parseBackup(text)
    if (!parsed.ok) return fail(parsed.error)
    setPending({ progress: parsed.progress, settings: parsed.settings, summary: parsed.summary })
  }

  // Fokus ke ringkasan supaya pengguna keyboard / pembaca layar langsung ke tombol konfirmasi.
  useEffect(() => {
    if (pending) summaryRef.current?.focus()
  }, [pending])

  const finishRestore = (n: Notice) => {
    setPending(null)
    setNotice(n)
    if (fileRef.current) fileRef.current.value = ''
    headingRef.current?.focus()
  }

  const confirm = () => {
    if (!pending) return
    // Mengganti (bukan menggabung) progres dan pengaturan.
    updateProgress(() => pending.progress)
    replace(pending.settings)
    finishRestore({ kind: 'status', text: t('backup.restored') })
  }

  const s = pending?.summary
  const exported = s?.exportedAt
    ? new Intl.DateTimeFormat(settings.lang === 'id' ? 'id-ID' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(s.exportedAt))
    : null

  return (
    <section className="card backup-card" aria-labelledby="backup-title">
      <h2 id="backup-title" ref={headingRef} tabIndex={-1} className="card-title">
        {t('backup.title')}
      </h2>
      <p>{t('backup.intro')}</p>
      <div className="row-actions">
        <button type="button" className="btn btn-purple" onClick={save}>
          {t('backup.save')}
        </button>
      </div>

      <div className="backup-restore">
        <label className="backup-file-label" htmlFor="backup-file">
          {t('backup.restoreLabel')}
        </label>
        <input
          id="backup-file"
          ref={fileRef}
          className="backup-file"
          type="file"
          accept="application/json,.json"
          aria-describedby="backup-file-hint"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <p id="backup-file-hint" className="muted backup-hint">
          {t('backup.restoreHint')}
        </p>
      </div>

      {pending && s ? (
        <div className="backup-summary" role="group" aria-labelledby="backup-summary-title">
          <h3 id="backup-summary-title" ref={summaryRef} tabIndex={-1}>
            {t('backup.summaryTitle')}
          </h3>
          <ul>
            {exported ? <li>{t('backup.sum.exported', { date: exported })}</li> : null}
            <li>{t('backup.sum.units', { n: s.unitsDone })}</li>
            <li>{t('backup.sum.tracked', { n: s.wordsTracked })}</li>
            <li>{t('backup.sum.mastered', { n: s.wordsMastered })}</li>
            <li>{t('backup.sum.streak', { n: s.bestStreak })}</li>
          </ul>
          <p className="backup-warn">{t('backup.warn')}</p>
          <div className="row-actions">
            <button type="button" className="btn btn-orange" onClick={confirm}>
              {t('backup.confirm')}
            </button>
            <button type="button" className="btn btn-white" onClick={() => finishRestore({ kind: 'status', text: t('backup.cancelled') })}>
              {t('backup.cancel')}
            </button>
          </div>
        </div>
      ) : null}

      {/* Dua wilayah tetap ada di halaman, supaya pembaca layar mengumumkan isinya saat berubah. */}
      <div className="backup-notice" role="status">
        {notice?.kind === 'status' ? <p className="notice-status">{notice.text}</p> : null}
      </div>
      <div className="backup-notice" role="alert">
        {notice?.kind === 'error' ? <p className="notice-error">{notice.text}</p> : null}
      </div>
    </section>
  )
}
