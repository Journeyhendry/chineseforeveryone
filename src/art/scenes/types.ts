// Shape of data/hsk1/scenes.json: one scene per word, assembled from characters, props,
// backgrounds and comic bubbles. All coordinates are in the shared 480x360 scene viewBox.
import type { Expression, View } from '../characters/types.ts'
import type { PoseId } from '../characters/pose.ts'

export const SCENE_W = 480
export const SCENE_H = 360
export const SCENE_VIEWBOX = `0 0 ${SCENE_W} ${SCENE_H}`

/** Action presets played on click (CSS in src/pages/learn/scene.css). */
export const PLAY_PRESETS = [
  'wave',
  'bow',
  'nod',
  'shake-head',
  'point',
  'count-up',
  'move-to',
  'pop-bubble',
  'swap-pair',
  'jump',
  'shrug',
  'beckon',
  'panels',
] as const
export type PlayPreset = (typeof PLAY_PRESETS)[number]

/** Which part of a character the action moves. */
export const ACT_TARGETS = ['char', 'head', 'upper', 'arm-left', 'arm-right'] as const
export type ActTarget = (typeof ACT_TARGETS)[number]

/** Extra classes a prop may carry for the action presets. */
export const PROP_ROLES = ['target', 'side-a', 'side-b', 'mover', 'from-left', 'from-right', 'from-top', 'from-far', 'sway', 'bob', 'spin'] as const
export type PropRole = (typeof PROP_ROLES)[number]

export interface SceneCharacter {
  id: string
  pose?: PoseId
  expression?: Expression
  view?: View
  /** feet position */
  x: number
  y?: number
  scale?: number
  /** mirror horizontally (face / point the other way) */
  flip?: boolean
  /** part moved by the action preset */
  act?: ActTarget
  /** fingers shown by the 'count' pose */
  fingers?: number
  /** classes for the action presets (e.g. side-a, mover from-left) */
  roles?: PropRole[]
}

export interface SceneProp {
  id: string
  /** bottom-centre of the prop (or of the first item when count > 1) */
  x: number
  y: number
  scale?: number
  flip?: boolean
  rotate?: number
  /** how many copies (counting scenes); each copy is a count-item */
  count?: number
  /** decorative copies (not counted) laid out like `count` */
  repeat?: number
  /** copies per row and spacing */
  cols?: number
  dx?: number
  dy?: number
  /** digits for digit-bearing props (digit badge, calendar, candle, podium) */
  value?: string
  variant?: string
  color?: string
  roles?: PropRole[]
  /** placed in a character's hand: [character index, hand] (x/y become an offset) */
  hold?: [number, 'left' | 'right']
  /** draw in front of the characters */
  front?: boolean
}

export interface SceneBubble {
  /** index of the speaking/thinking character in this panel (tail points to the mouth) */
  from?: number
  x: number
  y: number
  w: number
  h: number
  kind?: 'speech' | 'thought'
  /** Mandarin text overlaid as HTML (never drawn in the SVG) */
  text?: string
  /** icon drawn inside the bubble instead of text */
  icon?: 'question' | 'heart' | 'check' | 'cross' | 'dots' | 'exclaim'
  /** highlight the learned word inside the text */
  highlight?: boolean
}

export interface ScenePanel {
  background?: string
  characters: SceneCharacter[]
  props: SceneProp[]
  bubbles?: SceneBubble[]
}

export interface Scene {
  wordId: string
  hanzi: string
  unitId: string
  type: 'object' | 'action' | 'pair' | 'count' | 'position' | 'comic'
  background: string
  panels: ScenePanel[]
  alt: { id: string; en: string }
  play: PlayPreset
}

export interface ScenesFile {
  version: 1
  scenes: Scene[]
}

export interface SceneIndexBubble {
  /** box in percent of the scene width/height */
  x: number
  y: number
  w: number
  h: number
  text: string
  highlight: boolean
  /** comic panel the balloon belongs to (1 or 2) */
  panel: number
}

export interface SceneIndexEntry {
  file: string
  alt: { id: string; en: string }
  play: PlayPreset
  bubbles: SceneIndexBubble[]
}

export interface SceneIndex {
  version: 1
  viewBox: string
  scenes: Record<string, SceneIndexEntry>
}
