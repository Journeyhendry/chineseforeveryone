import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '../components/ComingSoon'
import { useT } from '../i18n/context'
import { waitForAudio } from '../lib/audio'
import { localDay } from '../lib/dates'
import { dueWords, recordAnswers } from '../lib/leitner'
import { buildReviewQuiz, type Question } from '../lib/quiz'
import { parseReviewRoute, REVIEW_HOME, REVIEW_SESSION, useRoute } from '../lib/router'
import { useSettings } from '../lib/settings-context'
import { go, updateProgress, useDocumentTitle, useProgress, useWordBank } from './learn/hooks'
import { LoadState } from './learn/parts'
import { QuizRunner, type QuizResult } from './learn/QuizRunner'
import { NotFoundPage } from './NotFoundPage'
import { ReviewHome } from './review/ReviewHome'
import { ReviewResult } from './review/ReviewResult'
import './review/review.css'

interface Session {
  run: number
  questions: Question[]
  /** Kotak tiap kata sebelum sesi, untuk daftar "naik kotak" di layar hasil. */
  before: Record<string, number>
}

interface Finished {
  r: QuizResult
  before: Record<string, number>
  today: string
}

const newSeed = () => Math.floor(Math.random() * 0x7fffffff)

/** Ulangan harian: beranda (#/ulang) dan sesi (#/ulang/sesi). */
export function ReviewPage() {
  const t = useT()
  const route = parseReviewRoute(useRoute().segments)
  const bank = useWordBank()
  const { settings } = useSettings()
  const progress = useProgress()
  const [session, setSession] = useState<Session | null>(null)
  const [finished, setFinished] = useState<Finished | null>(null)
  const [run, setRun] = useState(0)
  const [starting, setStarting] = useState(false)
  const inSession = route.screen === 'session'

  // Keluar dari sesi (ke beranda atau halaman lain): lupakan sesi dan hasilnya.
  const wasIn = useRef(false)
  useEffect(() => {
    if (wasIn.current && !inSession) {
      setSession(null)
      setFinished(null)
    }
    wasIn.current = inSession
  }, [inSession])

  const quizWords = bank.status === 'ready' ? bank.data : null
  const words = quizWords?.words
  const title = finished ? t('review.result.screen') : inSession ? t('review.session.screen') : t('page.review.title')
  useDocumentTitle(route.screen === 'notfound' ? t('notfound.title') : title)

  const start = async () => {
    if (!quizWords || starting) return
    const today = localDay(new Date())
    const ids = dueWords(progress, today, quizWords.knownIds).slice(0, settings.dailyGoal)
    const asked = ids.map((id) => quizWords.words.get(id)!)
    if (asked.length === 0) return
    setStarting(true)
    const audio = await waitForAudio()
    setStarting(false)
    const questions = buildReviewQuiz(asked, quizWords.groups, { seed: newSeed(), audio })
    const before = Object.fromEntries(ids.map((id) => [id, progress.words?.[id]?.box ?? 0]))
    setFinished(null)
    setRun((n) => n + 1)
    setSession({ run: run + 1, questions, before })
    if (!inSession) go(REVIEW_SESSION)
  }

  const finish = (s: Session, r: QuizResult) => {
    const today = localDay(new Date())
    // Disimpan sekali, saat layar hasil muncul (dipanggil dari tombol "Selesai" soal terakhir).
    updateProgress((p) => recordAnswers(p, r.answers, today, 'review'))
    setFinished({ r, before: s.before, today })
  }

  if (route.screen === 'notfound') return <NotFoundPage />

  if (bank.status !== 'ready' || !words) {
    return (
      <>
        <PageHeader title={t('review.title')} />
        <LoadState status={bank.status === 'error' ? 'error' : 'loading'} retry={bank.retry} />
      </>
    )
  }

  if (inSession && session && finished) {
    return <ReviewResult finished={finished} words={words} data={bank.data} onAgain={() => void start()} starting={starting} />
  }

  if (inSession && session) {
    return (
      <QuizRunner
        key={session.run}
        questions={session.questions}
        words={words}
        session={`review:${session.run}`}
        exitHref={REVIEW_HOME}
        exitLabel={t('review.session.exit')}
        context={t('review.session.context')}
        onFinish={(r) => finish(session, r)}
      />
    )
  }

  // #/ulang/sesi dibuka langsung (tanpa sesi berjalan): kembali ke beranda.
  if (inSession) return <RedirectHome />

  return <ReviewHome bank={bank.data} onStart={() => void start()} starting={starting} />
}

function RedirectHome() {
  useEffect(() => {
    window.location.replace(`${window.location.pathname}${window.location.search}${REVIEW_HOME}`)
  }, [])
  return null
}
