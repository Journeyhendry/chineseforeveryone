// Task 6c stage 2: the balloons of a scene say the word's sentence / dialog line by line. Pure checks
// (no file access) shared by scripts/check-visuals.ts and src/art/scenes.test.ts.
import { characterAnchors, faceBox } from '../art/scenes/compose.ts'
import type { Scene } from '../art/scenes/types.ts'

/** The part of a data/hsk1/word-sentences.json entry these checks need. */
export interface SceneLinesEntry {
  wordId: string
  sentence: { hanzi: string; speaker: string | null }
  dialog: { lines: { who: string; hanzi: string }[] } | null
  scene: { fit: string }
}

/** Fits whose scene balloons say the stage-1 sentence / dialog (all 233 scenes of units 1–16). */
export const LINE_FITS = ['keep', 'rebubble', 'redraw']

/** The lines a scene for this word says, in order. */
export function sentenceLines(e: SceneLinesEntry): { who: string | null; hanzi: string }[] {
  return e.dialog ? e.dialog.lines.map((l) => ({ who: l.who, hanzi: l.hanzi })) : [{ who: e.sentence.speaker, hanzi: e.sentence.hanzi }]
}

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/**
 * Problems with the line balloons of one scene: text per line (joined over its balloons, in order)
 * must equal the sentence / dialog line, every balloon of a line-based scene must carry a `line`, a
 * balloon's speaker must be the line's speaker when that character is in the panel, the learned word
 * is highlighted where it appears, and no balloon covers a face.
 */
export function checkSceneLines(scene: Scene, entry: SceneLinesEntry | undefined): string[] {
  const where = `${scene.wordId} ${scene.hanzi}`
  const errors: string[] = []
  const bubbles = scene.panels.flatMap((p, pi) => (p.bubbles ?? []).map((b) => ({ b, pi })))
  const lined = bubbles.filter(({ b }) => b.line !== undefined)
  const mustHaveLines = !!entry && LINE_FITS.includes(entry.scene.fit)
  if (!mustHaveLines && !lined.length) return errors
  if (!entry) return [`${where}: balloons have line numbers but the word has no sentence`]
  const lines = sentenceLines(entry)
  for (const { b } of bubbles) {
    if (b.line === undefined) errors.push(`${where}: balloon "${b.text ?? b.icon ?? ''}" has no line number`)
    else if (!b.text) errors.push(`${where}: line balloon ${b.line} has no text`)
  }
  lines.forEach((l, i) => {
    const said = lined.filter(({ b }) => b.line === i)
    const text = said.map(({ b }) => b.text ?? '').join('')
    if (text !== l.hanzi) errors.push(`${where}: line ${i} balloons say "${text}", expected "${l.hanzi}"`)
    for (const { b, pi } of said) {
      const chars = scene.panels[pi].characters
      const speakerHere = l.who ? chars.findIndex((c) => c.id === l.who) : -1
      if (speakerHere >= 0 && b.from !== speakerHere) errors.push(`${where}: line ${i} balloon should point at ${l.who}`)
      if (speakerHere < 0 && b.from !== undefined) errors.push(`${where}: line ${i} is said by ${l.who ?? 'nobody'} (not drawn), so its balloon has no tail`)
      const hasWord = (b.text ?? '').includes(scene.hanzi)
      if (hasWord !== !!b.highlight) errors.push(`${where}: line ${i} balloon "${b.text}" highlight should be ${hasWord}`)
    }
  })
  for (const { b } of lined) if ((b.line as number) >= lines.length) errors.push(`${where}: balloon line ${b.line} but only ${lines.length} line(s)`)
  const anchors = characterAnchors(scene)
  scene.panels.forEach((p, pi) => {
    for (const b of p.bubbles ?? []) {
      p.characters.forEach((c, ci) => {
        if (overlaps(b, faceBox(c, anchors[pi][ci]))) errors.push(`${where}: balloon "${b.text}" covers the face of ${c.id}`)
      })
    }
  })
  return errors
}

/** All problems over the scenes file. */
export function checkAllSceneLines(scenes: Scene[], entries: SceneLinesEntry[]): string[] {
  const byId = new Map(entries.map((e) => [e.wordId, e]))
  const errors: string[] = []
  for (const s of scenes) errors.push(...checkSceneLines(s, byId.get(s.wordId)))
  // every keep / rebubble / redraw word has its scene
  const sceneIds = new Set(scenes.map((s) => s.wordId))
  for (const e of entries) if (LINE_FITS.includes(e.scene.fit) && !sceneIds.has(e.wordId)) errors.push(`${e.wordId}: fit ${e.scene.fit} but no scene`)
  return errors
}
