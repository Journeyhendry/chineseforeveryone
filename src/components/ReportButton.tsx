import { useT } from '../i18n/context'
import { issueUrl, type IssueWord } from '../lib/dictionary'
import { useSettings } from '../lib/settings-context'

/** Alamat halaman ini tanpa query (?q=...) supaya tidak ikut terkirim ke laporan. */
function pageUrlWithoutQuery(): string {
  const { origin, pathname, search, hash } = window.location
  return `${origin}${pathname}${search}${hash.replace(/\?.*$/, '')}`
}

/** Tautan "Lapor salah": membuka GitHub Issue baru yang sudah terisi, di tab baru. */
export function ReportButton({ word, context }: { word?: IssueWord; context: string }) {
  const t = useT()
  const { settings } = useSettings()
  const href = issueUrl({ word, context, pageUrl: pageUrlWithoutQuery(), lang: settings.lang })
  return (
    <div className="report">
      <a className="btn btn-white report-link" href={href} target="_blank" rel="noopener noreferrer">
        <span>{t('report.button')}</span>
        <span className="sr-only"> {t('report.newTab')}</span>
      </a>
      <p className="muted report-note">{t('report.note')}</p>
    </div>
  )
}
