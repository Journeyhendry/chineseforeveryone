import { lazy, Suspense } from 'react'
import { NotFoundPage } from './NotFoundPage'
import { useT } from '../i18n/context'
import { loadIndex, loadUnit, type LessonIndex, type LessonUnitInfo } from '../lib/lessons'
import { isUnitUnlocked } from '../lib/progress'
import { parseLearnRoute, useRoute, type LearnRoute } from '../lib/router'
import { useDocumentTitle, useProgress, useResource } from './learn/hooks'
import { LockedScreen } from './learn/LockedScreen'
import { MapScreen } from './learn/MapScreen'
import { LoadState } from './learn/parts'
import { PracticeScreen } from './learn/PracticeScreen'
import { SkipScreen } from './learn/SkipScreen'
import { UnitScreen } from './learn/UnitScreen'
import { WordScreen } from './learn/WordScreen'

const BasicsRoute = lazy(() => import('./learn/basics/BasicsScreens').then((m) => ({ default: m.BasicsRoute })))

/** Halaman Belajar: peta, Tahap 0, ringkasan unit, kenalan kata, latihan, tes loncat. */
export function LearnPage() {
  const route = parseLearnRoute(useRoute().segments)
  const index = useResource('index', loadIndex)
  if (route.screen === 'notfound') return <LearnNotFound />
  if (route.screen === 'basics' || route.screen === 'basics-part' || route.screen === 'basics-practice') {
    return (
      <Suspense fallback={<LoadState status="loading" retry={() => {}} />}>
        <BasicsRoute route={route} />
      </Suspense>
    )
  }
  if (index.status !== 'ready') return <LearnLoading status={index.status} retry={index.retry} />
  if (route.screen === 'map') return <MapScreen index={index.data} />
  const info = index.data.units.find((u) => u.id === route.unitId)
  if (!info) return <LearnNotFound />
  if (route.screen === 'skip') return <SkipScreen key={info.id} index={index.data} info={info} />
  return <UnitRoute key={info.id} route={route} index={index.data} info={info} />
}

function UnitRoute({ route, index, info }: { route: LearnRoute; index: LessonIndex; info: LessonUnitInfo }) {
  const progress = useProgress()
  const unlocked = isUnitUnlocked(info, index.units, progress)
  const data = useResource(`unit:${info.id}`, () => loadUnit(info.id))
  if (!unlocked) return <LockedScreen info={info} />
  if (data.status !== 'ready') return <LearnLoading status={data.status} retry={data.retry} />
  switch (route.screen) {
    case 'unit':
      return <UnitScreen info={info} data={data.data} />
    case 'word':
      if (route.index > data.data.words.length) return <LearnNotFound />
      return <WordScreen info={info} data={data.data} n={route.index} />
    case 'practice':
      return <PracticeScreen index={index} info={info} data={data.data} />
    default:
      return <LearnNotFound />
  }
}

function LearnLoading({ status, retry }: { status: 'loading' | 'error'; retry: () => void }) {
  const t = useT()
  useDocumentTitle(t('page.learn.title'))
  return <LoadState status={status} retry={retry} />
}

function LearnNotFound() {
  const t = useT()
  useDocumentTitle(t('notfound.title'))
  return <NotFoundPage />
}
