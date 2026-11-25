export type View = 'front' | 'side' | 'back'
export type Expression = 'neutral' | 'happy' | 'sad' | 'surprised' | 'angry' | 'sleep'
export type ShownExpression = Exclude<Expression, 'neutral' | 'sleep'>
/** Scene-only expressions (not on the character sheets): eyes closed in sleep. */
export const SCENE_EXPRESSIONS: readonly Expression[] = ['sleep']

export const VIEWS: readonly View[] = ['front', 'side', 'back']
export const EXPRESSIONS: readonly ShownExpression[] = ['happy', 'sad', 'surprised', 'angry']

export type HairId =
  | 'bun'
  | 'grayBun'
  | 'tufts'
  | 'sidePart'
  | 'spiky'
  | 'pigtails'
  | 'lowPonytail'
  | 'quiff'
  | 'bob'
  | 'slick'
  | 'cropped'
  | 'long'
  | 'curly'

export type HatId = 'cap' | 'driverCap'
export type GlassesId = 'round' | 'square'

/** Body proportions; all lengths in viewBox units (floor line y=432 is shared by everyone). */
export interface Proportions {
  headScale: number
  /** pants/legs length from crotch to top of shoe */
  legLen: number
  /** shoulder line to torso hem */
  torsoLen: number
  shoulderHalf: number
  hemHalf: number
  armLen: number
  /** half-width of the arm tube */
  armHalf: number
  legWidth: number
  shoeScale: number
  /** gap between chin and shoulder line */
  neckLen: number
}

export interface CharacterSpec {
  id: string
  name: { id: string; en: string }
  gender: 'male' | 'female'
  role: 'family' | 'support'
  /** short English description for aria-label */
  label: string
  skin: string
  skinShade: string
  hair: HairId
  hairColor: string
  /** hair ties, headband */
  hairAccent?: string
  hat?: { id: HatId; color: string; band?: string }
  glasses?: GlassesId
  mustache?: string
  /** grandparents: small smile wrinkles at the eyes */
  senior?: boolean
  body: Proportions
}

/** Resolved body geometry for one character (absolute coordinates). */
export interface Rig {
  skin: string
  skinShade: string
  cx: number
  floorY: number
  shoeTop: number
  hipY: number
  hemY: number
  shoulderY: number
  chinY: number
  headY: number
  p: Proportions
}
