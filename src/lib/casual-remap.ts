// Task 2b: the casual drafts (casual-candidates.json, dialogs-draft.json) were written for the 20 units of the
// 500-word list. data/hsk1/casual-remap.json says where each candidate / dialog goes in the 2025 units (or why it
// was dropped), so the drafts and the evidence workflow stay untouched. Pure functions, shared by
// scripts/build-casual.ts and the tests.
import { buildLexicon, segment, type Lexicon, type UnitInput, type WordInput } from './sentences.ts'
import { buildCasual, evaluateCandidates, formatJson, type CandidatesFile, type CasualBuildInput, type CasualBuildOutput, type CasualCandidate, type Dialog, type DialogsFile } from './casual.ts'

export interface CasualRemap {
  version: number
  note: string
  /** Per candidate id: a new unit, or a reason why it is not used any more. A candidate without an entry keeps its own unit. */
  candidates: Record<string, { unit: string } | { drop: string }>
  /** Per draft dialog id: the unit it is tried in. A dialog without an entry is retired. */
  dialogs: Record<string, { unit: string }>
}

export interface DroppedCandidate {
  id: string
  hanzi: string
  draftUnit: string
  reason: string
}

/** HSK 1 word ids of the words in the HSK version shown with an expression (the 2025 words, in reading order). */
export function hskVersionWordIds(hanzi: string, lex: Lexicon): string[] {
  const ids: string[] = []
  for (const t of segment(hanzi, lex)) if (t.kind === 'word' && !ids.includes(t.ids[0])) ids.push(t.ids[0])
  return ids
}

/**
 * New unit for each candidate and its HSK word ids re-read from the HSK version against the 300 words (old ids
 * such as 里边 or 在家 no longer exist); candidates marked "drop" are returned separately.
 */
export function remapCandidates(items: CasualCandidate[], remap: CasualRemap, words: WordInput[], units: UnitInput[]): { items: CasualCandidate[]; dropped: DroppedCandidate[] } {
  const lex = buildLexicon(words, units)
  const out: CasualCandidate[] = []
  const dropped: DroppedCandidate[] = []
  for (const c of items) {
    const rule = remap.candidates[c.id]
    if (rule && 'drop' in rule) {
      dropped.push({ id: c.id, hanzi: c.hanzi, draftUnit: c.unit, reason: rule.drop })
      continue
    }
    out.push({ ...c, unit: rule ? rule.unit : c.unit, hsk: { ...c.hsk, wordIds: hskVersionWordIds(c.hsk.hanzi, lex) } })
  }
  return { items: out, dropped }
}

/** Draft dialogs that have a place in the new units, with that unit; the others are returned as retired. */
export function remapDialogs(draft: DialogsFile, remap: CasualRemap): { dialogs: Dialog[]; unplaced: Dialog[] } {
  const dialogs: Dialog[] = []
  const unplaced: Dialog[] = []
  for (const d of draft.dialogs) {
    const rule = remap.dialogs[d.id]
    if (rule) dialogs.push({ ...d, unit: rule.unit })
    else unplaced.push(d)
  }
  return { dialogs, unplaced }
}

export interface RemapBuildInput extends Omit<CasualBuildInput, 'candidates' | 'dialogs'> {
  candidates: CandidatesFile
  dialogs: DialogsFile | null
  remap: CasualRemap
}

export interface RemapBuildOutput extends CasualBuildOutput {
  'dialogs-retired.json': string
}

/**
 * buildCasual on the remapped drafts, plus dialogs-retired.json: every draft dialog that is not in dialogs.json,
 * unchanged (draft unit and text) with the reason, as material for task 3d.
 */
export function buildCasualRemapped(input: RemapBuildInput): RemapBuildOutput {
  const { items, dropped } = remapCandidates(input.candidates.items, input.remap, input.words, input.units)
  const draft = input.dialogs ?? { version: 1, speakers: {}, dialogs: [] }
  const placed = remapDialogs(draft, input.remap)
  const out = buildCasual({ ...input, candidates: { version: input.candidates.version, items }, dialogs: { ...draft, dialogs: placed.dialogs } })

  const report = JSON.parse(out['casual-report.json']) as { failedDialogs: { id: string; reasons: string[] }[] }
  const failed = new Map(report.failedDialogs.map((f) => [f.id, f.reasons]))
  const retired = draft.dialogs
    .filter((d) => !placed.dialogs.some((p) => p.id === d.id) || failed.has(d.id))
    .map((d) => {
      const reasons = failed.get(d.id)
      return { ...d, retired: { reason: reasons ? 'failed the vocabulary check against the 300 words / passed expressions' : 'no matching unit in the 2025 unit list', details: reasons ?? [] } }
    })
  // Dropped candidates keep their line in casual-evidence.json (what the sources and the reviewer said), marked
  // with the reason and without a unit; the file keeps the order of casual-candidates.json.
  const evidenceOut = JSON.parse(out['casual-evidence.json']) as { items: { id: string }[] }
  const droppedById = new Map(dropped.map((d) => [d.id, d]))
  const droppedResults = new Map(
    evaluateCandidates(input.candidates.items.filter((c) => droppedById.has(c.id)), input.evidence, input.reviews).map((r) => [r.candidate.id, r]),
  )
  const evById = new Map((input.evidence?.items ?? []).map((e) => [e.id, e]))
  const reviewById = new Map((input.reviews?.reviews ?? []).map((r) => [r.id, r]))
  const keptById = new Map(evidenceOut.items.map((e) => [e.id, e]))
  evidenceOut.items = input.candidates.items.map((c) => {
    const kept = keptById.get(c.id)
    if (kept) return kept
    const r = droppedResults.get(c.id)!
    const ev = evById.get(c.id)
    const rv = reviewById.get(c.id)
    return {
      id: c.id,
      unit: null,
      hanzi: c.hanzi,
      label: c.label,
      sources: {
        cedict: ev ? ev.cedict : null,
        wiktionary: ev ? { status: ev.wiktionary.status, labels: ev.wiktionary.labels, senses: ev.wiktionary.senses, pages: ev.wiktionary.pages.map((p) => ({ site: p.site, title: p.title, status: p.status, ...(p.error ? { error: p.error } : {}) })) } : null,
        tatoeba: ev ? ev.tatoeba : null,
      },
      counted: r.layer2.sources,
      flags: r.layer2.flags,
      review: rv ? { verdict: rv.verdict, natural: rv.natural, labelOk: rv.labelOk, comment: rv.comment } : null,
      passed: false,
      failedAt: null,
      dropped: droppedById.get(c.id)!.reason,
      reasons: [...r.layer2.reasons, ...r.layer3.reasons],
    }
  })

  // The report of a remapped build also lists what was dropped, so nothing disappears silently.
  const full = JSON.parse(out['casual-report.json']) as Record<string, unknown>
  full.droppedCandidates = dropped
  full.retiredDialogs = retired.map((d) => d.id)
  return {
    ...out,
    'casual-evidence.json': formatJson({ ...(JSON.parse(out['casual-evidence.json']) as object), items: evidenceOut.items }),
    'casual-report.json': formatJson(full),
    'dialogs-retired.json': formatJson({
      version: 1,
      speakers: draft.speakers,
      note: 'Dialogs of the 500-word draft (task 3b) that are not used in the 300-word units. Material for task 3d (rewrite); not shown on the site.',
      dialogs: retired,
    }),
  }
}
