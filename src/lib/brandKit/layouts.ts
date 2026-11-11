/**
 * Cards and footers (punch list #313) — the brand and the layouts, as data.
 *
 * A person's email footer and business card are drawn from their facts and photo instead of
 * being flat pictures a designer made by hand. Three layers, so a later change is one edit:
 *
 *  - `BRAND`: the colours, the typeface, the two words of the wordmark and the mark.
 *  - `LAYOUTS`: each piece as data — its size, where the pipes run, where the logo, the ring
 *    and the words sit, and which lines it shows.
 *  - the parts in `draw.ts`, one function per thing drawn.
 *
 * Every number was measured off the designer's flat files (the footer at 2709 x 625, the card
 * at 1125 x 675, which is 3.5 x 2 in with an eighth-inch bleed at 300 to the inch) and checked
 * by laying a render over each file (`to-dos/cards-and-footers/`, the spike that fitted them).
 *
 * The designer's three layouts are kept as they were. The owner took five changes on
 * 2026-11-11 (one orange, even lines on the card, a title, a phone on the footer, the photo
 * front kept); each is a small patch on a copy, and `CHOSEN_LOOK` is the look they add up to.
 *
 * To add a line to the card (a license number, a website): add one row to the layout's
 * `rows` and give the person that fact. Nothing else moves by hand.
 */

export type KitFact = 'name' | 'title' | 'email' | 'mobile' | 'office' | 'license'
export type KitIcon = 'email' | 'mobile' | 'office' | 'license'
export type KitColour = 'orange' | 'white'
export type KitWeight = 'bold' | 'light'
export type KitAsset = 'mark' | 'cardFrontPhoto'
export type KitPoint = [number, number]

/** One line of words. Left off when the person lacks the fact (and `or`), and the rows under it close up. */
export type KitRow = {
  fact: KitFact
  /** A second fact to fall back on: the footer's phone is the mobile, or the office line. */
  or?: KitFact
  weight: KitWeight
  size: number
  tracking?: number
  colour: KitColour
  opacity?: number
  /** The widest the line may run; a longer one shrinks. */
  fit?: number
  /** The step down from the row above it. */
  advance?: number
  /** A different step when it follows a certain row. */
  advanceAfter?: Partial<Record<KitFact, number>>
  x?: number
  /** A row with an icon is a contact line. */
  icon?: KitIcon
  dx?: number
  rise?: number
}

/**
 * The stack of words: rows top down from `start` (the first row's baseline). With `centre`,
 * the whole stack is centred on that height instead, so it stays in the middle however many
 * rows a person has, and `floor` is the lowest the last row may sit. A contact line's first
 * step is `firstLine`, under the name or under the title; each later one steps by `lineSteps`
 * in turn, the last step repeating for any further line.
 */
export type KitWords = {
  x: number
  start?: number
  centre?: number
  floor?: number
  firstLine?: { afterName: number; afterTitle: number }
  lineSteps?: number[]
  icons?: { x: number; size: number; rise: number; textX: number }
  rows: KitRow[]
}

/**
 * A pipe run: its width, the points it runs through and its couplings. A bend sits at each
 * inner point: it leaves the straight `from` before the corner and joins the next straight
 * `to` after it, and `ease` says how far before and after the corner the curve's two handles
 * sit (small numbers make a tight corner). A coupling is [centre x, centre y, width, height].
 */
export type KitPipe = {
  width: number
  points: KitPoint[]
  bends?: { from: number; to: number; ease: [number, number] }[]
  couplings?: [number, number, number, number][]
}

export type KitLayout = {
  size: [number, number]
  ground: string
  orange: string
  /** A picture under everything, full bleed. */
  photo?: KitAsset
  panels?: { points: KitPoint[]; colour: KitColour }[]
  pipes?: KitPipe[]
  logo?: { x: number; y: number; scale: number }
  ring?: { cx: number; cy: number; photo: number; ring: number }
  words?: KitWords
}

export const BRAND = {
  font: "'Lexend', system-ui, sans-serif",
  weights: { bold: 700, light: 300 } as Record<KitWeight, number>,
  /** The designer's files hold three oranges a hair apart. The owner took this one for every piece. */
  orange: '#e17232',
  white: '#ffffff',
  /** The logo: a picture of the mark, then two words set in the brand's own type. */
  mark: { width: 243.5, height: 248.4 },
  wordmark: [
    { text: 'CLICK', weight: 'bold' as KitWeight, size: 113.58, tracking: 10, x: 277.5, y: 144.75 },
    { text: 'Plumbing', weight: 'light' as KitWeight, size: 75.68, tracking: 0, x: 277.5, y: 221.75 },
  ],
} as const

/** Print: 300 units to the inch. The card is 3.5 x 2 in, an eighth-inch bleed all round, an eighth-inch safe margin inside the cut. */
export const CARD = { w: 1125, h: 675, bleed: 37.5, safe: 37.5 } as const

const footer01: KitLayout = {
  size: [2709, 625],
  ground: '#000000',
  orange: '#e17232',
  pipes: [
    { width: 53, points: [[1736, -60], [1736, 170.5], [2703, 170.5]], bends: [{ from: 190, to: 250, ease: [130, 30] }], couplings: [[2018, 170.5, 28, 95], [2602, 170.5, 28, 95]] },
    { width: 53, points: [[1645, 541.5], [2703, 541.5]], couplings: [[1645, 539.5, 32, 95]] },
    { width: 54, points: [[5, 452.5], [441, 452.5], [441, 690]], bends: [{ from: 301, to: 237.5, ease: [42, 15.5] }], couplings: [[94, 454, 28, 96]] },
  ],
  logo: { x: 100, y: 89.75, scale: 1 },
  ring: { cx: 1187.5, cy: 312.5, photo: 227.5, ring: 251.5 },
  words: {
    x: 1520,
    start: 349,
    rows: [
      { fact: 'name', weight: 'bold', size: 69, tracking: 1, colour: 'white', fit: 1129 },
      { fact: 'email', weight: 'light', size: 56, tracking: 1.3, colour: 'white', fit: 1129, advance: 69 },
    ],
  },
}

const cardBack1: KitLayout = {
  size: [1125, 675],
  ground: '#050708',
  orange: '#e37334',
  panels: [{ points: [[0, 0], [323, 0], [323, 675], [0, 675]], colour: 'orange' }],
  ring: { cx: 323, cy: 307, photo: 128.5, ring: 140 },
  words: {
    x: 515,
    start: 306,
    firstLine: { afterName: 76, afterTitle: 49 },
    lineSteps: [54, 63],
    // The designer set the email a hair right of the phones and its icon a hair higher; dx and rise keep that.
    icons: { x: 564, size: 46, rise: 31, textX: 628 },
    rows: [
      { fact: 'name', weight: 'bold', size: 52, tracking: 1.1, colour: 'orange', fit: 530 },
      { fact: 'title', weight: 'light', size: 28, tracking: 0, colour: 'white', opacity: 0.85, x: 519, advance: 39, fit: 520 },
      { fact: 'email', icon: 'email', weight: 'light', size: 35, tracking: 0, colour: 'white', fit: 410, dx: 5, rise: 34 },
      { fact: 'mobile', icon: 'mobile', weight: 'light', size: 35, tracking: 0, colour: 'white', fit: 410 },
      { fact: 'office', icon: 'office', weight: 'light', size: 35, tracking: 0, colour: 'white', fit: 410 },
    ],
  },
}

const cardFront1: KitLayout = {
  size: [1125, 675],
  ground: '#2f3339',
  orange: '#e37334',
  photo: 'cardFrontPhoto',
  panels: [{ points: [[618.8, 0], [1125, 0], [1125, 675], [346.8, 675]], colour: 'orange' }],
  logo: { x: 267.6, y: 239.6, scale: 0.8335 },
}

function reworked(base: KitLayout, change: (layout: KitLayout) => void): KitLayout {
  const copy = JSON.parse(JSON.stringify(base)) as KitLayout
  change(copy)
  return copy
}

const FOOTER_TITLE: KitRow = { fact: 'title', weight: 'light', size: 44, tracking: 0.8, colour: 'white', opacity: 0.85, fit: 1129, advance: 56 }
const FOOTER_PHONE: KitRow = { fact: 'mobile', or: 'office', weight: 'light', size: 56, tracking: 1.3, colour: 'white', fit: 1129, advance: 64 }

/** How far above its baseline a row's capitals reach, as a share of its size, in the brand's font. */
export const CAP_HEIGHT = 0.71

/**
 * The footer's two extra rows. The stack is centred where the designer's two rows sit (about
 * 359), so a person with no title and no phone gets the designer's footer exactly; more rows
 * keep that centre, and the last never drops below 462, clear of the pipe under them.
 */
function footerRows(layout: KitLayout, withTitle: boolean, withPhone: boolean) {
  const block = layout.words!
  const name = block.rows[0]!
  const email = block.rows[1]!
  const start = block.start ?? 0
  block.centre = (start - CAP_HEIGHT * name.size + start + (email.advance ?? 0)) / 2
  block.floor = 462
  email.advanceAfter = { title: 66 }
  block.rows = [name, ...(withTitle ? [FOOTER_TITLE] : []), email, ...(withPhone ? [FOOTER_PHONE] : [])]
}

/** The card's contact lines on even steps, the email in line with the phones. */
function evenLines(layout: KitLayout) {
  const block = layout.words!
  block.lineSteps = [58]
  block.firstLine = { afterName: 76, afterTitle: 52 }
  block.icons!.rise = 32
  for (const row of block.rows) {
    delete row.dx
    delete row.rise
  }
}

export const LAYOUTS = {
  /** The designer's three, as they were. */
  footer01,
  cardBack1,
  cardFront1,
  /** The owner's picks. */
  footerReworked: reworked(footer01, (l) => {
    footerRows(l, true, true)
    l.orange = BRAND.orange
  }),
  cardBackReworked: reworked(cardBack1, (l) => {
    evenLines(l)
    l.orange = BRAND.orange
  }),
  cardFrontReworked: reworked(cardFront1, (l) => {
    l.orange = BRAND.orange
  }),
  /** The fallback front with no photo: the same diagonal, black where the photo was, two pipe runs. */
  cardFrontPipes: {
    size: [1125, 675],
    ground: '#050708',
    orange: BRAND.orange,
    panels: cardFront1.panels,
    pipes: [
      { width: 30, points: [[150, -40], [150, 132], [-40, 132]], bends: [{ from: 96, to: 96, ease: [40, 12] }], couplings: [[58, 132, 16, 54]] },
      { width: 30, points: [[-40, 560], [214, 560], [214, 720]], bends: [{ from: 150, to: 115, ease: [22, 9] }], couplings: [[70, 560, 16, 54]] },
    ],
    logo: cardFront1.logo,
  } as KitLayout,
} satisfies Record<string, KitLayout>

export type KitLayoutName = keyof typeof LAYOUTS

/** A look is one footer, one card back and one card front that go together. */
export type KitLook = { footer: KitLayoutName; back: KitLayoutName; front: KitLayoutName }

export const LOOKS = {
  designer: { footer: 'footer01', back: 'cardBack1', front: 'cardFront1' },
  reworked: { footer: 'footerReworked', back: 'cardBackReworked', front: 'cardFrontReworked' },
  'reworked-no-photo': { footer: 'footerReworked', back: 'cardBackReworked', front: 'cardFrontPipes' },
} satisfies Record<string, KitLook>

/** The look the owner chose, 2026-11-11. */
export const CHOSEN_LOOK: KitLook = LOOKS.reworked
