// The Xiǎo family and the supporting cast. Ids and genders match `speakers` in data/hsk1/dialogs.json.
import type { CharacterSpec, Proportions } from './types.ts'

const SKIN = {
  light: ['#F8DCC0', '#EFC9A6'],
  base: ['#F6D3B3', '#EDBE98'],
  warm: ['#F1C7A2', '#E6B48C'],
  tan: ['#EBBE97', '#DDA97F'],
} as const

const adult = (o: Partial<Proportions>): Proportions => ({
  headScale: 1,
  legLen: 106,
  torsoLen: 120,
  shoulderHalf: 48,
  hemHalf: 54,
  armLen: 90,
  armHalf: 10,
  legWidth: 38,
  shoeScale: 1,
  neckLen: 14,
  ...o,
})

export const CHARACTERS: readonly CharacterSpec[] = [
  {
    id: 'yeye', name: { id: 'Kakek', en: 'Grandpa' }, gender: 'male', role: 'family',
    label: 'Grandpa with round glasses, white hair and a green jacket',
    skin: SKIN.light[0], skinShade: SKIN.light[1], hair: 'tufts', hairColor: '#EEEAF2', glasses: 'round', mustache: '#EEEAF2', senior: true,
    body: adult({ headScale: 0.98, legLen: 100, torsoLen: 114, shoulderHalf: 48, hemHalf: 54, armLen: 88, neckLen: 12 }),
  },
  {
    id: 'nainai', name: { id: 'Nenek', en: 'Grandma' }, gender: 'female', role: 'family',
    label: 'Grandma with a grey bun and a plum cardigan',
    skin: SKIN.light[0], skinShade: SKIN.light[1], hair: 'grayBun', hairColor: '#BDB6C9', senior: true,
    body: adult({ headScale: 0.98, legLen: 98, torsoLen: 112, shoulderHalf: 46, hemHalf: 56, armLen: 86, neckLen: 12 }),
  },
  {
    id: 'baba', name: { id: 'Ayah', en: 'Dad' }, gender: 'male', role: 'family',
    label: 'Dad in a light blue shirt with rolled sleeves',
    skin: SKIN.warm[0], skinShade: SKIN.warm[1], hair: 'sidePart', hairColor: '#2B2233',
    body: adult({ headScale: 1.03, legLen: 114, torsoLen: 126, shoulderHalf: 54, hemHalf: 56, armLen: 96, armHalf: 10.5, legWidth: 40 }),
  },
  {
    id: 'mama', name: { id: 'Ibu', en: 'Mom' }, gender: 'female', role: 'family',
    label: 'Mom with a hair bun, red top and apron',
    skin: SKIN.base[0], skinShade: SKIN.base[1], hair: 'bun', hairColor: '#2B2233',
    body: adult({}),
  },
  {
    id: 'gege', name: { id: 'Kakak laki-laki', en: 'Big brother' }, gender: 'male', role: 'family',
    label: 'Big brother, a young university student with spiky hair and an orange hoodie',
    skin: SKIN.warm[0], skinShade: SKIN.warm[1], hair: 'spiky', hairColor: '#3A2C2A',
    body: adult({ headScale: 0.97, legLen: 106, torsoLen: 114, shoulderHalf: 47, hemHalf: 49, armLen: 88, armHalf: 10, legWidth: 36, neckLen: 13 }),
  },
  {
    id: 'meimei', name: { id: 'Adik perempuan', en: 'Little sister' }, gender: 'female', role: 'family',
    label: 'Little sister with two pigtails and a yellow dress',
    skin: SKIN.base[0], skinShade: SKIN.base[1], hair: 'pigtails', hairColor: '#2B2233', hairAccent: '#F28B82',
    body: adult({ headScale: 0.9, legLen: 78, torsoLen: 72, shoulderHalf: 32, hemHalf: 36, armLen: 64, armHalf: 8, legWidth: 26, shoeScale: 0.78, neckLen: 9 }),
  },
  {
    id: 'seller', name: { id: 'Penjual', en: 'Seller' }, gender: 'female', role: 'support',
    label: 'Market seller with a red cap, green apron and blue oversleeves',
    skin: SKIN.tan[0], skinShade: SKIN.tan[1], hair: 'lowPonytail', hairColor: '#4A3328', hairAccent: '#FFD166', hat: { id: 'cap', color: '#E05A47' },
    body: adult({ legLen: 104, shoulderHalf: 50, hemHalf: 56 }),
  },
  {
    id: 'doctor', name: { id: 'Dokter', en: 'Doctor' }, gender: 'male', role: 'support',
    label: 'Doctor in a white coat with a stethoscope',
    skin: SKIN.light[0], skinShade: SKIN.light[1], hair: 'quiff', hairColor: '#4A3328',
    body: adult({ legLen: 110, torsoLen: 124, shoulderHalf: 50, hemHalf: 52, armLen: 94 }),
  },
  {
    id: 'teacher', name: { id: 'Guru', en: 'Teacher' }, gender: 'female', role: 'support',
    label: 'Teacher with a bob, glasses and a book',
    skin: SKIN.base[0], skinShade: SKIN.base[1], hair: 'bob', hairColor: '#4A3328', glasses: 'square',
    body: adult({ torsoLen: 118, shoulderHalf: 46, hemHalf: 50, armHalf: 9.5, legWidth: 36 }),
  },
  {
    id: 'waiter', name: { id: 'Pelayan', en: 'Waiter' }, gender: 'male', role: 'support',
    label: 'Waiter in a black vest and red bow tie with a towel on his arm',
    skin: SKIN.tan[0], skinShade: SKIN.tan[1], hair: 'slick', hairColor: '#2B2233',
    body: adult({ legLen: 112, shoulderHalf: 48, hemHalf: 50, armLen: 94 }),
  },
  {
    id: 'driver', name: { id: 'Sopir', en: 'Driver' }, gender: 'male', role: 'support',
    label: 'Driver in a peaked cap, khaki jacket and white gloves',
    skin: SKIN.tan[0], skinShade: SKIN.tan[1], hair: 'cropped', hairColor: '#2B2233', hat: { id: 'driverCap', color: '#34406B', band: '#2E2838' },
    body: adult({ headScale: 1.02, torsoLen: 126, shoulderHalf: 56, hemHalf: 60, armLen: 94, armHalf: 11, legWidth: 42, neckLen: 12 }),
  },
  {
    id: 'friend', name: { id: 'Teman', en: 'Friend' }, gender: 'female', role: 'support',
    label: 'Friend with long hair, a headband and denim overalls',
    skin: SKIN.base[0], skinShade: SKIN.base[1], hair: 'long', hairColor: '#3A2C2A', hairAccent: '#FFD166',
    body: adult({ headScale: 0.98, legLen: 108, torsoLen: 112, shoulderHalf: 44, hemHalf: 46, armLen: 88, armHalf: 9, legWidth: 34 }),
  },
  {
    id: 'classmate', name: { id: 'Teman kuliah', en: 'Classmate' }, gender: 'male', role: 'support',
    label: 'Classmate with curly hair, a mint T-shirt and a red backpack',
    skin: SKIN.warm[0], skinShade: SKIN.warm[1], hair: 'curly', hairColor: '#4A3328',
    body: adult({ headScale: 0.98, legLen: 112, torsoLen: 116, shoulderHalf: 47, hemHalf: 48, armLen: 92, armHalf: 9.5, legWidth: 36 }),
  },
]
