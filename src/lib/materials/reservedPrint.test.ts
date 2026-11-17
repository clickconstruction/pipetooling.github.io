import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { newRunBesideReservedWords, PRINT_RESERVED_SAME_WORDS, PRINT_RUN_AGAIN_WORDS, printReservedLabel, reservedRunByLine, reservedRunsToPrint, reservedRunTitle, reservedRunToPrint, restKeptWords } from './reservedPrint'
import type { StickerRowOfRun, StickerRun } from './stickerRun'

const sticker = (number: number, boxName: string | null, containerId: string | null = null, lostAt: string | null = null): StickerRowOfRun => ({ id: `s${number}`, number, code: `AAAA${String(number).padStart(4, '0')}`, boxName, containerId, lostAt })
const run = (id: string, names: string[] | null, stickers: StickerRowOfRun[], over: Partial<StickerRun> = {}): { run: StickerRun; stickers: StickerRowOfRun[] } => ({
  run: { id, jobId: 'j1', count: stickers.length, firstNumber: stickers[0]?.number ?? 0, lastNumber: stickers[stickers.length - 1]?.number ?? 0, copies: 1, printedByName: 'Dana', printedAt: '2026-11-16T15:00:00Z', names, ...over },
  stickers,
})
const named = (from: number, to: number, first = 1) => Array.from({ length: to - from + 1 }, (_, i) => sticker(first + i, `G${from + i}`))

describe('the press that prints a job’s reserved stickers', () => {
  it('counts what it prints and names it, in the line’s own word', () => {
    expect(printReservedLabel(58, 'G93 to G150')).toBe('Print the 58 reserved stickers, G93 to G150')
    expect(printReservedLabel(1, 'G93')).toBe('Print the 1 reserved sticker, G93')
    expect(printReservedLabel(30)).toBe('Print the 30 reserved stickers')
    // dead at none: the bare words, with no count
    expect(printReservedLabel(0, 'G93 to G150')).toBe('Print the reserved stickers')
    // nobody knows the first print came out, so the press never says again
    expect(printReservedLabel(58, 'G93 to G150')).not.toMatch(/again/i)
  })

  it('titles the window it opens', () => {
    expect(reservedRunTitle(58, 'G93 to G150')).toBe('Reserved stickers, G93 to G150')
    expect(reservedRunTitle(1, 'G93')).toBe('Reserved sticker G93')
    expect(reservedRunTitle(30)).toBe('30 reserved stickers')
    expect(reservedRunTitle(1)).toBe('1 reserved sticker')
  })
})

describe('a job’s runs that still hold reserved stickers', () => {
  it('one run with none on a box prints the whole run', () => {
    const stickers = named(93, 150)
    const got = reservedRunsToPrint([run('r1', stickers.map((s) => s.boxName!), stickers)])
    expect(got).toHaveLength(1)
    expect(got[0]!.label).toBe('Print the 58 reserved stickers, G93 to G150')
    expect(got[0]!.title).toBe('Reserved stickers, G93 to G150')
    expect(got[0]!.reserved).toHaveLength(58)
    expect(got[0]!.whole).toHaveLength(58)
    // a sticker handed to the window carries its own code: nothing is minted
    expect(got[0]!.reserved[0]).toEqual({ id: 's1', number: 1, code: 'AAAA0001', boxName: 'G93' })
    // the window takes the whole run, open on the reserved ones
    const toPrint = reservedRunToPrint(got[0]!)
    expect([toPrint.stickers.length, toPrint.printing.length, toPrint.title]).toEqual([58, 58, 'Reserved stickers, G93 to G150'])
  })

  it('leaves out the stickers on boxes and the lost ones, and keeps the whole run for the window’s From and to', () => {
    const stickers = [sticker(1, 'G1', 'box-1'), sticker(2, 'G2'), sticker(3, 'G3'), sticker(4, 'G4', null, '2026-11-10T00:00:00Z'), sticker(5, 'G5')]
    const [got] = reservedRunsToPrint([run('r1', ['G1', 'G2', 'G3', 'G4', 'G5'], stickers)])
    expect(got!.reserved.map((s) => s.boxName)).toEqual(['G2', 'G3', 'G5'])
    expect(got!.whole.map((s) => s.boxName)).toEqual(['G1', 'G2', 'G3', 'G4', 'G5'])
    // a broken block is said by its first names and how many more
    expect(got!.label).toBe('Print the 3 reserved stickers, G2, G3 and 1 more')
  })

  it('offers each run its own press, the lowest names first, and leaves out a run with none left', () => {
    const first = named(1, 3)
    const second = named(4, 6, 4)
    const done = [sticker(7, 'G7', 'box-7')]
    // read newest first, as the page reads them
    const got = reservedRunsToPrint([run('r3', ['G7'], done), run('r2', ['G4', 'G5', 'G6'], second, { printedByName: 'Marcus', printedAt: '2026-11-15T15:00:00Z' }), run('r1', ['G1', 'G2', 'G3'], first)])
    expect(got.map((r) => r.label)).toEqual(['Print the 3 reserved stickers, G1 to G3', 'Print the 3 reserved stickers, G4 to G6'])
    // more than one run: each press says who printed its run and when
    const day = (iso: string) => (iso.startsWith('2026-11-15') ? 'Nov 15' : 'Nov 16')
    expect(got.map((r) => reservedRunByLine(r, got, day))).toEqual(['Printed Nov 16 by Dana', 'Printed Nov 15 by Marcus'])
    // one run: its line already says it
    expect(reservedRunByLine(got[0]!, [got[0]!], day)).toBe('')
  })

  it('says a run with no names by its count', () => {
    const [got] = reservedRunsToPrint([run('r1', null, [sticker(1, null), sticker(2, null, 'box-1'), sticker(3, null)])])
    expect(got!.label).toBe('Print the 2 reserved stickers')
    expect(got!.title).toBe('2 reserved stickers')
    expect(got!.span).toBe('')
  })

  it('a job with nothing reserved has no press', () => {
    expect(reservedRunsToPrint([])).toEqual([])
    expect(reservedRunsToPrint([run('r1', ['G1'], [sticker(1, 'G1', 'box-1')])])).toEqual([])
  })
})

describe('the words beside the press', () => {
  it('tell it apart from a new reservation', () => {
    expect(PRINT_RESERVED_SAME_WORDS).toBe('This prints the same stickers with the same links. It reserves nothing new.')
    expect(newRunBesideReservedWords('G151')).toBe('Print future stickers reserves new ones. A new run opens on G151.')
    expect(newRunBesideReservedWords(null)).toBe('Print future stickers reserves new ones.')
    expect(newRunBesideReservedWords(undefined)).toBe('Print future stickers reserves new ones.')
  })

  it('say the rest of a stopped run is kept, and where it prints later', () => {
    expect(restKeptWords(40)).toBe('The 40 stickers left are still reserved. Print them now, or later from the job’s reserved line.')
    expect(restKeptWords(1)).toBe('The 1 sticker left is still reserved. Print it now, or later from the job’s reserved line.')
    expect(restKeptWords(0)).toBe('')
  })

  it('keep to the plain-words rules', () => {
    for (const words of [PRINT_RESERVED_SAME_WORDS, PRINT_RUN_AGAIN_WORDS, restKeptWords(40), restKeptWords(1), newRunBesideReservedWords('G151'), newRunBesideReservedWords(null)]) {
      expect(plainWordsFailures(words)).toEqual([])
    }
  })
})
