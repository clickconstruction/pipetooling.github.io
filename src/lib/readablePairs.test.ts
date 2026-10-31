import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SAFETY_ORANGE_TEXT, SAFETY_ORANGE_UNDER_WORDS, TEXT_ON_SAFETY_ORANGE } from './bids/bidStyles'
import { CLOCK_IN_ACCENT_TEXT, CLOCK_IN_ACCENT_UNDER_WORDS } from './clock/clockColors'
import { ORANGE_UNDER_WORDS, WORDS_ON_ORANGE } from './orangeUnderWords'
import { SKY_UNDER_WORDS, SKY_UNDER_WORDS_HOVER, WORDS_ON_SKY } from './skyUnderWords'
import { MORE_SWIPE_GREY } from './people/usersTabPhone'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from './deadPress'
import { JOB_ACTIVITY_EVENT_RENDER } from './jobActivityEvent'
import { PURSUIT_OUTCOME_CHIP_COLORS } from './bids/pursuitOutcomeColors'
import { OVERHEAD_METHOD_INKS } from './overheadMethodInks'
import { GUIDE_CAPTION_INK, GUIDE_DEAD_BUTTON, GUIDE_PANEL_GROUND } from './helpGuideIllustrations'
import { GOOD_THROUGH_PASSED_CHIP_COLORS } from './estimates/estimateGoodThroughChip'
import { GRADE_COLORS } from '../components/bids/RobotReferenceGradeModal'
import { BID_STAGE_MARKER_COLOR } from './map/builderBidMapFocus'
import { JOBS_MAP_SECTION_COLOR, MAP_PAGE_ESTIMATE_COLOR, MAP_PAGE_UNKNOWN_COLOR } from './map/mapPageSections'
import { PIN_LABEL_DARK_INK, PIN_LABEL_DARK_INK_DRAWN, pinLabelInk } from './map/pinLabelInk'
import { contrastRatio, over, parseRgb } from './lens/lensAudit'
import { hexToRgba, parseThemeTokens, type ThemeName } from './lens/lensTokens'
import { PORTAL_TRADE_COLORS } from './portal/portalPayload'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, NOTE_BAND, PAPER } from './portal/portalTheme'
import { TRADE_COLORS } from './tradeColors'
import { BID_SERVICE_TYPE_TAGS } from '../utils/unifiedJobBidSearch'
import { RIGHT, WRONG } from '../components/training/figures/plumbingTokens'
import { SALES_BAR_INKS } from './bridge/sales/salesBarInks'

/**
 * The four pairs What everyone sees measured under 3:1 on 2026-10-27, held at 4.5:1 since v2.5981:
 * the Clock In bar, the Bids mode chip in dark, the Calendar's dates in dark, and the portal's
 * small print; the Pipeline's good-through-passed chip since v2.6037; and the pairs the sweep of
 * 2026-10-29 found, each since the version named on it. Each color as the theme draws it, read from
 * src/index.css.
 */
const tokens = parseThemeTokens(readFileSync('src/index.css', 'utf8'))
const THEMES: readonly ThemeName[] = ['light', 'dark']

/** A hex as is; a token from that theme's block, or the light block's when dark leaves it alone. */
function drawn(color: string, theme: ThemeName): string {
  const name = /^var\((--[a-z0-9-]+)\)$/.exec(color)?.[1]
  if (!name) return color
  const find = (t: ThemeName) => tokens[t].find((d) => d.name === name)?.value
  const value = (theme === 'dark' ? find('dark') : undefined) ?? find('light')
  if (!value) throw new Error(`src/index.css declares no ${name}`)
  return value
}

const ratio = (fg: string, bg: string, theme: ThemeName) => contrastRatio(hexToRgba(drawn(fg, theme)), hexToRgba(drawn(bg, theme)))

describe('the pairs What everyone sees found, in both themes', () => {
  const pairs: { label: string; fg: string; bg: string }[] = [
    { label: "Clock In, Complete Clock In, the Job Mode press and the Currently in head on the clock-in orange's deep shade (white since v2.6186)", fg: CLOCK_IN_ACCENT_TEXT, bg: CLOCK_IN_ACCENT_UNDER_WORDS },
    { label: "the picked Bids mode chip (BidsModeToggle): white on the violet's light value since v2.6190", fg: '#ffffff', bg: '#6d28d9' },
    { label: "the Calendar's dates on the day card", fg: 'var(--text-blue-700)', bg: 'var(--surface)' },
    { label: "the Calendar's dates on the hovered day", fg: 'var(--text-blue-700)', bg: 'var(--bg-blue-tint)' },
    { label: "the Calendar's other months' dates", fg: 'var(--text-muted)', bg: 'var(--surface)' },
    { label: "the Pipeline's good-through-passed chip", fg: GOOD_THROUGH_PASSED_CHIP_COLORS.fg, bg: GOOD_THROUGH_PASSED_CHIP_COLORS.bg },
    { label: 'a dead press: Print, Generate PO, Send feedback, Post note, the Job Mode bar (v2.6062)', fg: DEAD_PRESS_TEXT, bg: DEAD_PRESS_FILL },
    { label: "the open Counts, Pricing or Cover Letter tab, an orange button and the pending count on safety orange's deep shade (v2.6063, white since v2.6186)", fg: TEXT_ON_SAFETY_ORANGE, bg: SAFETY_ORANGE_UNDER_WORDS },
    { label: 'a closed Counts, Pricing or Cover Letter tab on the page (v2.6063)', fg: SAFETY_ORANGE_TEXT, bg: 'var(--bg-page)' },
    { label: "a form's orange hint on the surface (v2.6063)", fg: SAFETY_ORANGE_TEXT, bg: 'var(--surface)' },
    { label: "a picked chip, a picked weekday, a Save or a blue press once filled with --text-link (v2.6068), and the Dashboard's calendar count (v2.6130): white on #2563eb since v2.6190", fg: '#ffffff', bg: '#2563eb' },
    { label: "People → Users' phone row, swipe to More (v2.6068)", fg: '#ffffff', bg: MORE_SWIPE_GREY },
    { label: "an amber count or press with words, on the deep orange: the follow-ups count, a follow-up's job number, the inbox's N open (v2.6070, white since v2.6186)", fg: WORDS_ON_ORANGE, bg: ORANGE_UNDER_WORDS },
    { label: "the Checklist's ✓ You on green (v2.6070)", fg: 'var(--text-on-bright-solid)', bg: '#22c55e' },
    { label: "a sky press on the deep sky: the header's dispatch press and the dispatch mode ticks (v2.6070, white since v2.6186), and every other sky press since v2.6196", fg: WORDS_ON_SKY, bg: SKY_UNDER_WORDS },
    { label: "a workflow's Set Start or Approve hovered, on the darker sky (v2.6196)", fg: WORDS_ON_SKY, bg: SKY_UNDER_WORDS_HOVER },
    { label: "a blue press with white words on #2563eb in both themes: the cost move's Move, Apply and Done, and the payroll sort chips (v2.6186)", fg: '#ffffff', bg: '#2563eb' },
    { label: 'Next, ✓ All clear and the discount in green-700 on the surface (v2.6075)', fg: 'var(--text-green-700)', bg: 'var(--surface)' },
    { label: 'the Bid Costs unsent chip (v2.6081)', fg: PURSUIT_OUTCOME_CHIP_COLORS.unsent.fg, bg: PURSUIT_OUTCOME_CHIP_COLORS.unsent.bg },
    { label: "People → Overhead's method A on the page (v2.6082)", fg: OVERHEAD_METHOD_INKS.A, bg: 'var(--bg-page)' },
    { label: "People → Overhead's method B on the page (v2.6082)", fg: OVERHEAD_METHOD_INKS.B, bg: 'var(--bg-page)' },
    { label: "People → Overhead's method C on the page (v2.6082)", fg: OVERHEAD_METHOD_INKS.C, bg: 'var(--bg-page)' },
    { label: "the overhead lens window's heading, method A (v2.6082)", fg: OVERHEAD_METHOD_INKS.A, bg: 'var(--surface)' },
    { label: "the overhead lens window's heading, method B (v2.6082)", fg: OVERHEAD_METHOD_INKS.B, bg: 'var(--surface)' },
    { label: "the overhead lens window's heading, method C (v2.6082)", fg: OVERHEAD_METHOD_INKS.C, bg: 'var(--surface)' },
    { label: "a guide's Example caption on its light panel (v2.6085)", fg: GUIDE_CAPTION_INK, bg: GUIDE_PANEL_GROUND },
    { label: "a guide's grey mock button (v2.6085)", fg: GUIDE_DEAD_BUTTON.ink, bg: GUIDE_DEAD_BUTTON.fill },
    { label: "a robot's X grade: the Bid Board's badge, the Counts tab's chip, the key and the grade window (v2.6130)", fg: '#ffffff', bg: GRADE_COLORS.X },
    { label: "the nav's Messages count on its red (v2.6151)", fg: '#ffffff', bg: '#b91c1c' },
  ]
  for (const p of pairs) {
    for (const theme of THEMES) {
      it(`${p.label}, ${theme}: 4.5:1 or better`, () => {
        expect(ratio(p.fg, p.bg, theme)).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})

describe("a job's activity tags on the surface, in both themes (v2.6078)", () => {
  const tagColors = [...new Set(Object.values(JOB_ACTIVITY_EVENT_RENDER).map((m) => m.tagColor))]
  for (const fg of tagColors) {
    for (const theme of THEMES) {
      it(`${fg} on the surface, ${theme}: 4.5:1 or better`, () => {
        expect(ratio(fg, 'var(--surface)', theme)).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})

describe("a map pin's count in the ink its fill takes, in both themes (v2.6130)", () => {
  it('the dark ink the kernel weighs is --text-on-bright-solid as each theme draws it', () => {
    for (const theme of THEMES) expect(drawn(PIN_LABEL_DARK_INK, theme).toLowerCase()).toBe(PIN_LABEL_DARK_INK_DRAWN)
  })
  const fills: Record<string, string> = { ...JOBS_MAP_SECTION_COLOR, ...BID_STAGE_MARKER_COLOR, noSection: MAP_PAGE_UNKNOWN_COLOR }
  for (const [section, fill] of Object.entries(fills)) {
    for (const theme of THEMES) {
      it(`on ${section}'s ${fill}, ${theme}: 4.5:1 or better`, () => {
        expect(ratio(pinLabelInk(fill), fill, theme)).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
  it("on the estimates' violet: 3:1 or better (the lens's floor; white reads 4.23:1 and the dark ink 4.19:1, so neither reaches 4.5:1)", () => {
    for (const theme of THEMES) expect(ratio(pinLabelInk(MAP_PAGE_ESTIMATE_COLOR), MAP_PAGE_ESTIMATE_COLOR, theme)).toBeGreaterThanOrEqual(3)
  })
})

describe("an empty cell's dash in --text-faint, as the app's other empty dashes draw it: Supply Houses and the customer review (v2.6197)", () => {
  for (const bg of ['var(--bg-page)', 'var(--surface)']) {
    for (const theme of THEMES) {
      it(`on ${bg}, ${theme}: 3:1 or better (the lens's floor; a dash says nothing is there, the quiet it keeps is the point)`, () => {
        expect(ratio('var(--text-faint)', bg, theme)).toBeGreaterThanOrEqual(3)
      })
    }
  }
})

describe("a schedule block's − and + presses on the block's tint, in both themes (v2.6197)", () => {
  for (const fg of ['var(--text-red-700)', 'var(--text-blue-700)']) {
    for (const bg of ['var(--bg-violet-100)', 'var(--bg-blue-tint)']) {
      for (const theme of THEMES) {
        it(`${fg} on ${bg}, ${theme}: 4.5:1 or better`, () => {
          expect(ratio(fg, bg, theme)).toBeGreaterThanOrEqual(4.5)
        })
      }
    }
  }
})

describe('words on a wash over a fill', () => {
  /** A chip's rgba wash laid over a ground token, as the theme draws it. */
  const washed = (wash: string, ground: string, theme: ThemeName) => {
    const w = parseRgb(wash)
    if (!w) throw new Error(`not an rgba wash: ${wash}`)
    return over(w, hexToRgba(drawn(ground, theme)))
  }
  for (const [outcome, c] of Object.entries(PURSUIT_OUTCOME_CHIP_COLORS)) {
    if (!c.bg.startsWith('rgba')) continue
    for (const ground of ['var(--bg-page)', 'var(--surface)']) {
      for (const theme of THEMES) {
        it(`the Bid Costs ${outcome} chip on its wash over ${ground}, ${theme}: 4.5:1 or better (v2.6081)`, () => {
          expect(contrastRatio(hexToRgba(drawn(c.fg, theme)), washed(c.bg, ground, theme))).toBeGreaterThanOrEqual(4.5)
        })
      }
    }
  }
  it("the Bids lens bar's count pill: white on a 25% black wash over the open lens's blue, 4.5:1 or better (v2.6070)", () => {
    const ground = over({ r: 0, g: 0, b: 0, a: 0.25 }, hexToRgba('#3b82f6'))
    expect(contrastRatio(hexToRgba('#ffffff'), ground)).toBeGreaterThanOrEqual(4.5)
  })
})

describe("the training figures' words on the grounds they are drawn on, in both themes (v2.6133)", () => {
  const pairs: { label: string; fg: string; bg: string }[] = [
    { label: 'the right way, RIGHT, on the surface', fg: RIGHT, bg: 'var(--surface)' },
    { label: "the right way on a grey ground: the fire classes, two systems' air gap", fg: RIGHT, bg: 'var(--bg-subtle)' },
    { label: "the stud setback's 1-1/4 in on the amber plate", fg: RIGHT, bg: 'var(--bg-amber-100)' },
    { label: "the fire classes' dry chemical in the red C column", fg: 'var(--text-green-800)', bg: 'var(--bg-red-100)' },
    { label: 'the wrong way, WRONG, on the surface', fg: WRONG, bg: 'var(--surface)' },
    { label: 'the wrong way on a grey ground: the frost-proof bib', fg: WRONG, bg: 'var(--bg-subtle)' },
    { label: 'the hazards in red-800 on the surface: call 911, never jump, the mA scale', fg: 'var(--text-red-800)', bg: 'var(--surface)' },
    { label: "never water and the swing radius's blind spots on their red wash", fg: 'var(--text-red-800)', bg: 'var(--bg-red-100)' },
    { label: "the cave-in signs inside the trench's grey", fg: 'var(--text-red-800)', bg: 'var(--bg-subtle)' },
    { label: "the swing radius's red rope marks it on the surface", fg: 'var(--text-red-600)', bg: 'var(--surface)' },
    { label: "the warnings in amber on the surface: limited approach, 19.5%, protect, the gauge's weak", fg: 'var(--text-amber-700)', bg: 'var(--surface)' },
    { label: "two systems' out: gravity on its grey", fg: 'var(--text-amber-700)', bg: 'var(--bg-subtle)' },
    { label: 'the cold labels in blue on the surface: cold in, cold', fg: 'var(--text-link)', bg: 'var(--surface)' },
    { label: "two systems' in: pressure on its grey", fg: 'var(--text-link)', bg: 'var(--bg-subtle)' },
    { label: "the water heater's cold sinks inside the tank's blue", fg: 'var(--text-blue-700)', bg: 'var(--bg-blue-200)' },
  ]
  for (const p of pairs) {
    for (const theme of THEMES) {
      it(`${p.label}, ${theme}: 4.5:1 or better`, () => {
        expect(ratio(p.fg, p.bg, theme)).toBeGreaterThanOrEqual(4.5)
      })
    }
  }

  it('the eight literal inks stay only where a figure draws a real object: the copper print, the flags, the signs, the GHS border, the STOP paddle, the rope, the numbered badges and the purple primer', () => {
    const dir = 'src/components/training/figures'
    const counts: Record<string, number> = {}
    for (const name of readdirSync(dir)) {
      const n = (readFileSync(`${dir}/${name}`, 'utf8').match(/#(15803d|b91c1c|991b1b|dc2626|b45309|2563eb|7c3aed|d97706)\b/gi) ?? []).length
      if (n) counts[name] = n
    }
    expect(counts).toEqual({ 'CopperTypes.tsx': 3, 'DigFlags.tsx': 2, 'DwvMaterials.tsx': 1, 'ExcavatorSiteMap.tsx': 2, 'HandSignals.tsx': 1, 'HazcomPictograms.tsx': 1, 'SignColours.tsx': 2, 'SolventJoint.tsx': 2, 'SwingRadius.tsx': 1 })
  })
})

describe("the Sales desk bar's dollars on their fills, in both themes (v2.6133)", () => {
  for (const [segment, { fill, words }] of Object.entries(SALES_BAR_INKS)) {
    for (const theme of THEMES) {
      it(`${segment}: ${words} on ${fill}, ${theme}: 4.5:1 or better`, () => {
        expect(ratio(words, fill, theme)).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})

describe("the training figures' words inside a tint, the primer's purple and the sludge's word, in both themes (v2.6135)", () => {
  const pairs: { label: string; fg: string; bg: string }[] = [
    { label: 'the purple primer and its cement in violet-700 on the surface', fg: 'var(--text-violet-700)', bg: 'var(--surface)' },
    { label: 'a grey word inside an amber tint: the heat stages, the septic tank, the dirty bucket', fg: 'var(--text-600)', bg: 'var(--bg-amber-100)' },
    { label: "a grey word inside a red tint: heat stroke, the stack's taper, the dip tube", fg: 'var(--text-600)', bg: 'var(--bg-red-100)' },
    { label: "a grey word inside a blue tint: the water heater's no neutral, the pressure tank", fg: 'var(--text-600)', bg: 'var(--bg-blue-200)' },
    { label: "a breaker's amps on its surface halo, where it crosses the subpanel's ground bar", fg: 'var(--text-muted)', bg: 'var(--surface)' },
  ]
  for (const p of pairs) {
    for (const theme of THEMES) {
      it(`${p.label}, ${theme}: 4.5:1 or better`, () => {
        expect(ratio(p.fg, p.bg, theme)).toBeGreaterThanOrEqual(4.5)
      })
    }
  }

  for (const theme of THEMES) {
    it(`the septic tank's solids settle in --text-strong on the sludge, --text-muted at 55% over the amber, ${theme}: 4.5:1 or better`, () => {
      const sludge = over({ ...hexToRgba(drawn('var(--text-muted)', theme)), a: 0.55 }, hexToRgba(drawn('var(--bg-amber-100)', theme)))
      expect(contrastRatio(hexToRgba(drawn('var(--text-strong)', theme)), sludge)).toBeGreaterThanOrEqual(4.5)
    })
  }
})

describe("the portal's paper: every text tier on every ground", () => {
  const grounds = { CARD, PAPER, NOTE_BAND }
  for (const [tier, fg] of Object.entries({ INK, MUTED, FAINT })) {
    for (const [ground, bg] of Object.entries(grounds)) {
      it(`${tier} on ${ground}: 4.5:1 or better`, () => {
        expect(ratio(fg, bg, 'light')).toBeGreaterThanOrEqual(4.5)
      })
    }
  }

  it('FAINT stays a step lighter than MUTED', () => {
    expect(ratio(FAINT, CARD, 'light')).toBeLessThan(ratio(MUTED, CARD, 'light'))
  })
})

describe("the portal's trade colours and copper (v2.6067, punch list #199)", () => {
  const grounds = { CARD, PAPER, NOTE_BAND }
  for (const [tag, color] of Object.entries(TRADE_COLORS)) {
    for (const [ground, bg] of Object.entries(grounds)) {
      it(`${tag} as a word on ${ground}: 4.5:1 or better`, () => {
        expect(ratio(color, bg, 'light')).toBeGreaterThanOrEqual(4.5)
      })
    }
    it(`white on ${tag}, the app's pill: 4.5:1 or better`, () => {
      expect(ratio('#ffffff', color, 'light')).toBeGreaterThanOrEqual(4.5)
    })
  }

  for (const [ground, bg] of Object.entries(grounds)) {
    it(`COPPER as a word on ${ground}: 4.5:1 or better`, () => {
      expect(ratio(COPPER, bg, 'light')).toBeGreaterThanOrEqual(4.5)
    })
  }

  it('white on the copper, a button: 4.5:1 or better', () => {
    expect(ratio('#ffffff', COPPER, 'light')).toBeGreaterThanOrEqual(4.5)
  })

  it("a waiting press, muted words on the hairline: 3:1 or better (the lens's floor; a waiting control is exempt from 4.5:1)", () => {
    expect(ratio(MUTED, HAIR, 'light')).toBeGreaterThanOrEqual(3)
  })

  it('the portal and the app read one trade colour source', () => {
    expect(PORTAL_TRADE_COLORS).toEqual(TRADE_COLORS)
    expect(Object.values(BID_SERVICE_TYPE_TAGS).map((t) => [t.tag, t.color])).toEqual(Object.entries(TRADE_COLORS))
  })
})

/** Each line under src/, tests aside, that colours words with the hex: one that must stay a fill or a border. */
function wordsInLiteral(hex: string): string[] {
  const words = new RegExp(`(?<![A-Za-z])color:\\s*[^,{}]*'${hex}'`, 'i')
  const hits: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`
      if (entry.isDirectory()) walk(path)
      else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
        readFileSync(path, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            if (words.test(line)) hits.push(`${path}:${i + 1}`)
          })
      }
    }
  }
  walk('src')
  return hits
}

describe("the discount's green, in both themes (v2.6116)", () => {
  for (const theme of THEMES) {
    it(`its words on its green wash: the standing offer's dollars, a standing discount's %, the summary's share, ${theme}: 4.5:1 or better`, () => {
      expect(ratio('var(--text-green-700)', 'var(--bg-green-100)', theme)).toBeGreaterThanOrEqual(4.5)
    })
  }

  it('#0f7a52 colours no words under src/: it read 2.74:1 on the dark surface, so it stays only as a fill under white', () => {
    expect(wordsInLiteral('#0f7a52')).toEqual([])
  })
})

describe("green-700's words on the grounds the sweep put them on, in both themes (v2.6120)", () => {
  for (const bg of ['var(--bg-green-tint)', 'var(--bg-subtle)', 'var(--bg-muted)']) {
    for (const theme of THEMES) {
      it(`on ${bg}, ${theme}: 4.5:1 or better`, () => {
        expect(ratio('var(--text-green-700)', bg, theme)).toBeGreaterThanOrEqual(4.5)
      })
    }
  }

  it("'#15803d' colours no words under src/: it read 2.93:1 on the dark surface, so it stays only as a fill or a border", () => {
    expect(wordsInLiteral('#15803d')).toEqual([])
  })
})

describe('words on a press, chip or count once filled with a text token, in both themes (v2.6190)', () => {
  // A text token turns light in dark, so white words on one read 1.05:1 to 2.77:1 there. A coloured
  // one now fills with its light value as a literal under white words, deep in both themes; a grey
  // one keeps its token under var(--surface) words. npm run check:text-fill-words refuses the rest.
  const coloured: { fill: string; token: string; where: string }[] = [
    { fill: '#2563eb', token: 'var(--text-link)', where: "the contract, lien and billing presses, the picked chips and Saves, the statement's ✓, the calendar count, the GC flows, the ☎ (and --text-blue-500's fills)" },
    { fill: '#1d4ed8', token: 'var(--text-blue-700)', where: "the contract forms' submit, the AR tip's two presses, Who is this? on a new lane and a GC thread" },
    { fill: '#1e40af', token: 'var(--text-blue-800)', where: 'the ☎ while its window is open' },
    { fill: '#6d28d9', token: 'var(--text-violet-700)', where: "the counts import's picked pair, the Workflow link, the guide ring's Next and current step" },
    { fill: '#b91c1c', token: 'var(--text-red-700)', where: "Edit Bid's per-GC Mark lost, the contract sweep's send, the Punch list's Drop" },
    { fill: '#dc2626', token: 'var(--text-red-600)', where: "the lien timeline's missed step and struck mark, the Bridge collect desk's press" },
    { fill: '#166534', token: 'var(--text-green-800)', where: "the bill's owner-line press, the lien timeline's done step, the Lien desk's green press" },
    { fill: '#15803d', token: 'var(--text-green-700)', where: "the ✓ marks, the bid flow's done step, the GC stage's done node and Week done pin, a GC's done step, the Punch list's Do (and --text-green-600's fills)" },
    { fill: '#b45309', token: 'var(--text-amber-700)', where: "an alternate's picked answer on Edit Bid, a counts group's alternate chip, the contracts tab's queue count" },
    { fill: '#92400e', token: 'var(--text-amber-800)', where: "the Lien desk's amber press, the lien calendar's Draft, the Punch list's Later" },
  ]
  for (const { fill, token, where } of coloured) {
    it(`white on ${fill}, ${token}'s light value: ${where}: 4.5:1 or better in both themes`, () => {
      expect(drawn(token, 'light').toLowerCase()).toBe(fill)
      expect(ratio('#ffffff', fill, 'light')).toBeGreaterThanOrEqual(4.5)
    })
  }

  const greys: { token: string; where: string }[] = [
    { token: 'var(--text-strong)', where: "the Submittal Room's picked row, picked role and Send" },
    { token: 'var(--text-700)', where: 'the owner share chip turning off' },
    { token: 'var(--text-muted)', where: "an alternate's declined answer, a muted robot's badge" },
    { token: 'var(--text-base)', where: "the Bridge desks' Close and tooltips, the GC Gantt's hover line" },
    { token: 'var(--text-slate-600)', where: "the follow-ups window's picked view" },
  ]
  for (const { token, where } of greys) {
    for (const theme of THEMES) {
      it(`var(--surface) on ${token}: ${where}, ${theme}: 4.5:1 or better`, () => {
        expect(ratio('var(--surface)', token, theme)).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})
