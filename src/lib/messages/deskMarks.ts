/**
 * The two desks' marks (punch list #258, v2.6507): the word, the fill, the ink and the icon the header's two inbox
 * presses wear — the bell on the deep sky for **Dispatch** (`Layout.tsx`'s Task Dispatch, `skyUnderWords.ts`'s pair,
 * white on it 5.93:1 since v2.6186) and the pencil and ruler on violet for **Estimating** (Ask estimating, white on
 * `#7c3aed` 5.7:1). The header read them from four literals before; it and the band on a New row (`DeskBand.tsx` over
 * `rowDesk.ts`) read this one record now, so a change to a color or an icon is both at once. The fills are literals,
 * not theme tokens, so a desk reads the same in light and dark, as the header does; `readablePairs.test.ts` holds the
 * inks on them at 4.5:1 in both themes, and `deskMarks.test.ts` keeps the header on this file. Pure.
 */
import { SKY_UNDER_WORDS, WORDS_ON_SKY } from '../skyUnderWords'
import { DESK_WORDS, type Desk } from './rowDesk'

/** The violet under the Ask estimating press's white words, and the words on it. */
export const ESTIMATING_UNDER_WORDS = '#7c3aed'
export const WORDS_ON_ESTIMATING = '#ffffff'

export interface DeskMark {
  /** The desk's word: Dispatch, Estimating. */
  word: string
  /** The fill under the icon or the words. */
  fill: string
  /** The icon's or the words' color on the fill. */
  ink: string
  /** The icon, one path on a 640 box. */
  icon: { viewBox: string; path: string }
}

/** The bell. */
const DISPATCH_PATH =
  'M280 128C266.7 128 256 138.7 256 152C256 165.3 266.7 176 280 176L296 176L296 209.3C188.8 220.7 104.2 307.7 96.6 416L543.5 416C535.8 307.7 451.2 220.7 344 209.3L344 176L360 176C373.3 176 384 165.3 384 152C384 138.7 373.3 128 360 128L280 128zM88 464C74.7 464 64 474.7 64 488C64 501.3 74.7 512 88 512L552 512C565.3 512 576 501.3 576 488C576 474.7 565.3 464 552 464L88 464z'

/** The pencil and ruler. */
const ESTIMATING_PATH =
  'M468 64C487.2 64 505.6 71.6 519.1 85.2L554.8 120.9C568.4 134.4 576 152.8 576 172C576 191.2 568.4 209.6 554.8 223.1L509.9 268L372 130.1L416.9 85.2C430.4 71.6 448.8 64 468 64zM122.9 379.1L338.1 164L476 301.9L260.9 517.1C250.2 527.8 236.8 535.6 222.2 539.7L94.4 575.1C86.1 577.4 77.1 575.1 71 568.9C64.9 562.7 62.5 553.8 64.8 545.5L100.4 417.8C104.5 403.2 112.2 389.9 123 379.1zM289.4 144.8L144.8 289.4L75.7 220.3C60.1 204.7 60.1 179.4 75.7 163.7L163.7 75.7C179.3 60.1 204.6 60.1 220.3 75.7L226.2 81.6L169.9 137.9C162.1 145.7 162.1 158.4 169.9 166.2C177.7 174 190.4 174 198.2 166.2L254.5 109.9L289.4 144.8zM495.2 350.6L530.1 385.5L473.8 441.8C466 449.6 466 462.3 473.8 470.1C481.6 477.9 494.3 477.9 502.1 470.1L558.4 413.8L564.3 419.7C579.9 435.3 579.9 460.6 564.3 476.3L476.3 564.3C460.7 579.9 435.4 579.9 419.7 564.3L350.6 495.2L495.2 350.6z'

export const DESK_MARKS: Readonly<Record<Desk, DeskMark>> = {
  dispatch: { word: DESK_WORDS.dispatch.word, fill: SKY_UNDER_WORDS, ink: WORDS_ON_SKY, icon: { viewBox: '0 0 640 640', path: DISPATCH_PATH } },
  estimating: { word: DESK_WORDS.estimating.word, fill: ESTIMATING_UNDER_WORDS, ink: WORDS_ON_ESTIMATING, icon: { viewBox: '0 0 640 640', path: ESTIMATING_PATH } },
}

/** The band's width and its icon's, at a desk and on a phone (`DeskBand.tsx`); the row moves its padding by the width. */
export const DESK_BAND = { desk: { width: 22, icon: 14 }, phone: { width: 18, icon: 12 } } as const
