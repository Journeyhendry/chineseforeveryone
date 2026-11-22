// Task 3d: the dialogs shown on the site come from data/hsk1/dialogs-natural.json (hand-written, one per unit,
// with a place and a goal). The vocabulary rules are the ones of src/lib/casual.ts (checkDialog); this module adds
// the checks of the new fields and swaps the dialogs into the outputs of buildCasualRemapped, so casual.ts, the
// candidates and the evidence workflow stay untouched. Pure functions, used by scripts/build-casual.ts and the tests.
import { buildDialogContext, checkDialog, evaluateCandidates, formatJson, type Bilingual, type Dialog, type DialogCheck, type Speaker } from './casual.ts'
import { buildCasualRemapped, remapCandidates, type RemapBuildInput, type RemapBuildOutput } from './casual-remap.ts'

export const PLACE_KINDS = ['home', 'school', 'market', 'eatery', 'shop', 'transport', 'phone', 'office', 'street', 'clinic', 'park'] as const
export type PlaceKind = (typeof PLACE_KINDS)[number]
/** HSK 1 words from units after the dialog's unit: allowed, but at most this many per dialog. */
export const MAX_LATER_UNIT_WORDS = 3
export const MIN_PLACE_KINDS = 7
export const MAX_PER_PLACE_KIND = 5
/** Each of these needs at least one dialog (a list means: one of them). */
export const REQUIRED_PLACE_KINDS: PlaceKind[][] = [['phone'], ['transport'], ['market', 'shop'], ['eatery'], ['school']]

export interface NaturalDialog extends Dialog {
  place: Bilingual
  placeKind: PlaceKind
  goal: Bilingual
}
export interface NaturalDialogsFile {
  version: number
  speakers: Record<string, Speaker>
  dialogs: NaturalDialog[]
}

const hasText = (b: Bilingual | undefined) => typeof b?.id === 'string' && b.id.trim() !== '' && typeof b?.en === 'string' && b.en.trim() !== ''

/** Problems with the fields checkDialog does not look at (id, place, goal ...). Empty when fine. */
export function naturalFieldErrors(d: NaturalDialog): string[] {
  const errors: string[] = []
  if (d.id !== `n-${d.unit}`) errors.push(`id ${d.id} should be n-${d.unit}`)
  if (!PLACE_KINDS.includes(d.placeKind)) errors.push(`unknown placeKind ${String(d.placeKind)}`)
  for (const k of ['title', 'place', 'goal', 'situation'] as const) if (!hasText(d[k])) errors.push(`${k} needs id and en`)
  return errors
}

export interface NaturalCheck {
  dialog: NaturalDialog
  check: DialogCheck
  passed: boolean
  reasons: string[]
}

/**
 * Place variety over all dialogs (task 3d, part A): at least MIN_PLACE_KINDS kinds, none more than
 * MAX_PER_PLACE_KIND times, and every group of REQUIRED_PLACE_KINDS present. Empty when fine.
 */
export function placeVarietyErrors(dialogs: Pick<NaturalDialog, 'placeKind'>[]): string[] {
  const count = new Map<string, number>()
  for (const d of dialogs) count.set(d.placeKind, (count.get(d.placeKind) ?? 0) + 1)
  const errors: string[] = []
  if (count.size < MIN_PLACE_KINDS) errors.push(`only ${count.size} place kinds (need ${MIN_PLACE_KINDS})`)
  for (const [kind, n] of count) if (n > MAX_PER_PLACE_KIND) errors.push(`placeKind ${kind} used ${n} times (max ${MAX_PER_PLACE_KIND})`)
  for (const group of REQUIRED_PLACE_KINDS) if (!group.some((k) => count.has(k))) errors.push(`no dialog with placeKind ${group.join(' or ')}`)
  return errors
}

/** Builds the casual outputs, then replaces the dialogs with the natural ones (see the head of this file). */
export function buildCasualWithNaturalDialogs(input: RemapBuildInput & { natural: NaturalDialogsFile | null }): RemapBuildOutput {
  const out = buildCasualRemapped(input)
  const natural = input.natural ?? { version: 1, speakers: {}, dialogs: [] }
  const unitIds = input.units.map((u) => u.id)

  // Same context as buildCasual: remapped candidates, passed = layers 2 and 3 passed.
  const { items } = remapCandidates(input.candidates.items, input.remap, input.words, input.units)
  const passed = evaluateCandidates(items, input.evidence, input.reviews).filter((r) => r.passed).map((r) => r.candidate.id)
  const ctx = buildDialogContext(input.words, input.units, items, passed)
  // Only expressions shown in casual.json may be used, otherwise the dialog would point to a missing item.
  const shown = new Set((JSON.parse(out['casual.json']) as { items: { id: string }[] }).items.map((c) => c.id))

  const seenUnits = new Set<string>()
  const checks: NaturalCheck[] = natural.dialogs.map((d) => {
    const check = checkDialog(d, natural.speakers, ctx)
    const reasons = [...naturalFieldErrors(d), ...check.reasons]
    if (seenUnits.has(d.unit)) reasons.push(`second dialog for unit ${d.unit}`)
    seenUnits.add(d.unit)
    if (check.laterUnitWords.length > MAX_LATER_UNIT_WORDS) reasons.push(`${check.laterUnitWords.length} words from later units (max ${MAX_LATER_UNIT_WORDS})`)
    for (const id of check.casualUsed) if (ctx.passed.has(id) && !shown.has(id)) reasons.push(`casual ${id} is not shown in casual.json`)
    return { dialog: d, check, passed: reasons.length === 0, reasons }
  })

  const dialogsOut = {
    version: 1,
    speakers: natural.speakers,
    dialogs: checks
      .filter((c) => c.passed)
      .map(({ dialog: d, check }) => ({
        id: d.id,
        unit: d.unit,
        title: d.title,
        place: d.place,
        placeKind: d.placeKind,
        goal: d.goal,
        situation: d.situation,
        machine: true,
        lines: d.lines.map((l, i) => ({
          speaker: l.speaker,
          gender: l.gender,
          cmn: l.cmn,
          pinyin: check.lines[i].pinyin,
          tokens: check.lines[i].tokens,
          en: l.en,
          id: l.id,
          machine: true,
        })),
      })),
  }

  // The draft dialogs that passed before (d-u18) are replaced too: all drafts go to dialogs-retired.json.
  const retiredIn = JSON.parse(out['dialogs-retired.json']) as { dialogs: { id: string }[] } & Record<string, unknown>
  const draftKept = (JSON.parse(out['dialogs.json']) as { dialogs: { id: string; unit: string }[] }).dialogs
  const keptUnit = new Map(draftKept.map((d) => [d.id, d.unit]))
  const retiredById = new Map(retiredIn.dialogs.map((d) => [d.id, d]))
  const draft = input.dialogs?.dialogs ?? []
  const retired = draft
    .filter((d) => retiredById.has(d.id) || keptUnit.has(d.id))
    .map((d) => retiredById.get(d.id) ?? { ...d, retired: { reason: `replaced by the natural dialog of unit ${keptUnit.get(d.id)} (task 3d)`, details: [] } })

  const report = JSON.parse(out['casual-report.json']) as Record<string, unknown> & { totals: Record<string, number> }
  report.totals.dialogs = checks.length
  report.totals.dialogsPassed = checks.filter((c) => c.passed).length
  report.unitsWithoutDialog = unitIds.filter((u) => !checks.some((c) => c.passed && c.dialog.unit === u))
  report.failedDialogs = checks.filter((c) => !c.passed).map((c) => ({ id: c.dialog.id, unit: c.dialog.unit, reasons: c.reasons }))
  report.dialogs = checks.map((c) => ({ id: c.dialog.id, passed: c.passed, placeKind: c.dialog.placeKind, casualUsed: c.check.casualUsed, laterUnitWords: c.check.laterUnitWords }))
  report.placeVariety = placeVarietyErrors(checks.filter((c) => c.passed).map((c) => c.dialog))
  report.retiredDialogs = retired.map((d) => d.id)

  return {
    ...out,
    'dialogs.json': formatJson(dialogsOut),
    'dialogs-retired.json': formatJson({
      ...retiredIn,
      note: 'Dialogs of the 500-word draft (task 3b). None of them is shown on the site since task 3d (the site uses data/hsk1/dialogs-natural.json); kept as an archive.',
      dialogs: retired,
    }),
    'casual-report.json': formatJson(report),
  }
}
