import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  blankStickersOf,
  canMintStickers,
  lastRunWords,
  mintedRunOf,
  mintedStickerOf,
  printRestLabel,
  printRunLabel,
  reprintLabel,
  restAfterStop,
  runCountsOf,
  runsFoldWords,
  runStripsWords,
  STICKER_COUNT_PRESETS,
  STICKER_MINT_WHO,
  STICKER_TEST_STRIP,
  stickerCountOf,
  stickerRunByLine,
  stickerRunCountWords,
  stickerRunOf,
  stickerRunPressLabel,
  stickerRunRequest,
  stickerRunTitle,
  stickersCsvFileName,
  stickersCsvText,
  stickersPrintedWhole,
  stickersSentWords,
  stickerStrip,
  type MintedSticker,
  type StickerRowOfRun,
} from './stickerRun'

/** A made-up run for Juniper Ridge: 200 stickers, 0101 to 0300, two of each, printed by Dana. */
const runRow = { id: 'run-1', job_id: 'job-juniper', sticker_count: 200, first_number: 101, last_number: 300, copies: 2, printed_by: 'u-dana', printed_by_name: 'Dana', printed_at: '2026-11-12T16:00:00Z' }
const stickerRows = Array.from({ length: 200 }, (_, i) => ({ id: `s-${101 + i}`, number: 101 + i, code: `4f2a9c${String(i).padStart(2, '0')}` }))

describe('how many', () => {
  it('offers the card’s four quick counts and takes a whole number from 1 to 500', () => {
    expect(STICKER_COUNT_PRESETS).toEqual([30, 60, 100, 200])
    expect(stickerCountOf(200)).toBe(200)
    expect(stickerCountOf('30')).toBe(30)
    expect(stickerCountOf(' 500 ')).toBe(500)
    expect(stickerCountOf(0)).toBeNull()
    expect(stickerCountOf(501)).toBeNull()
    expect(stickerCountOf(2.5)).toBeNull()
    expect(stickerCountOf('')).toBeNull()
    expect(stickerCountOf('two')).toBeNull()
  })

  it('the press counts stickers, or sets when each prints more than once, and is dead at zero', () => {
    expect(stickerRunPressLabel(200, 1)).toBe('Print 200 stickers')
    expect(stickerRunPressLabel(200, 2)).toBe('Print 200 sets')
    expect(stickerRunPressLabel(1, 1)).toBe('Print 1 sticker')
    expect(stickerRunPressLabel(1, 3)).toBe('Print 1 set')
    expect(stickerRunPressLabel(0, 1)).toBe('Print stickers')
  })

  it('says the strips under the title', () => {
    expect(stickerRunCountWords(200, 1)).toBe('200 stickers, one strip each.')
    expect(stickerRunCountWords(200, 2)).toBe('200 stickers, 2 strips each. 400 strips.')
    expect(stickerRunCountWords(1, 1)).toBe('1 sticker, one strip each.')
  })

  it('says where the numbers start', () => {
    expect(lastRunWords(100)).toBe('The last run ended at 0100.')
    expect(lastRunWords(null)).toBe('This is the first run. The numbers start at 0001.')
  })
})

describe('who', () => {
  it('mirrors sticker_can_mint: the office, a primary, a superintendent', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'primary', 'superintendent']) expect(canMintStickers(role)).toBe(true)
    for (const role of ['estimator', 'helpers', 'journeyman', 'subcontractor', null, undefined]) expect(canMintStickers(role)).toBe(false)
  })
})

describe('the request', () => {
  it('passes a whole request through', () => {
    expect(stickerRunRequest({ jobId: 'job-juniper', count: '200', copies: 2, role: 'assistant' })).toEqual({ ok: true, request: { jobId: 'job-juniper', count: 200, copies: 2 } })
  })

  it('refuses in the database’s own words', () => {
    expect(stickerRunRequest({ jobId: 'job-juniper', count: 200, copies: 2, role: 'estimator' })).toEqual({ ok: false, words: STICKER_MINT_WHO })
    expect(stickerRunRequest({ jobId: null, count: 200, copies: 2, role: 'dev' })).toEqual({ ok: false, words: 'A run names the job its new boxes go on.' })
    expect(stickerRunRequest({ jobId: 'j', count: 501, copies: 2, role: 'dev' })).toEqual({ ok: false, words: 'A run is 1 to 500 stickers.' })
    expect(stickerRunRequest({ jobId: 'j', count: 10, copies: 7, role: 'dev' })).toEqual({ ok: false, words: 'Copies of each is 1 to 6.' })
    expect(stickerRunRequest({ jobId: 'j', count: 10, copies: 0, role: 'dev' })).toEqual({ ok: false, words: 'Copies of each is 1 to 6.' })
  })
})

describe('the run read back', () => {
  it('reads a sticker_runs row', () => {
    expect(stickerRunOf(runRow)).toEqual({ id: 'run-1', jobId: 'job-juniper', count: 200, firstNumber: 101, lastNumber: 300, copies: 2, printedByName: 'Dana', printedAt: '2026-11-12T16:00:00Z', names: null })
    expect(stickerRunOf({ ...runRow, job_id: null, printed_by_name: '' })).toMatchObject({ jobId: null, printedByName: '' })
  })

  it('reads a named run’s names when they are as many as its stickers, and none otherwise (v2.7312)', () => {
    const names = Array.from({ length: 200 }, (_, i) => `G${78 + i}`)
    expect(stickerRunOf({ ...runRow, names })).toMatchObject({ names })
    expect(stickerRunOf({ ...runRow, names: ['G78'] })).toMatchObject({ names: null })
    expect(stickerRunOf({ ...runRow, names: [...names.slice(0, 199), ''] })).toMatchObject({ names: null })
    expect(mintedStickerOf({ id: 's', number: 225, code: '4f2a9c18', box_name: 'g78' })).toEqual({ id: 's', number: 225, code: '4F2A9C18', boxName: 'G78' })
    expect(mintedStickerOf({ id: 's', number: 225, code: '4f2a9c18' })).toEqual({ id: 's', number: 225, code: '4F2A9C18', boxName: null })
  })

  it('is null for a row that is not a numbered run', () => {
    expect(stickerRunOf(null)).toBeNull()
    expect(stickerRunOf({ ...runRow, first_number: null, last_number: null })).toBeNull()
    expect(stickerRunOf({ ...runRow, last_number: 100 })).toBeNull()
    expect(stickerRunOf({ ...runRow, sticker_count: 0 })).toBeNull()
  })

  it('reads the mint’s answer in number order and refuses a run short of its stickers', () => {
    const shuffled = [...stickerRows].reverse()
    const got = mintedRunOf({ run: runRow, stickers: shuffled })
    expect(got?.run.count).toBe(200)
    expect(got?.stickers.map((s) => s.number).slice(0, 3)).toEqual([101, 102, 103])
    expect(got?.stickers[0]?.code).toBe('4F2A9C00')
    expect(mintedRunOf({ run: runRow, stickers: stickerRows.slice(1) })).toBeNull()
    expect(mintedRunOf({ run: runRow })).toBeNull()
    expect(mintedRunOf('nothing')).toBeNull()
    expect(mintedStickerOf({ id: 's', number: 0, code: 'ABCD1234' })).toBeNull()
    expect(mintedStickerOf({ id: 's', number: 1, code: null })).toBeNull()
  })
})

describe('what one sticker prints', () => {
  it('is the tape label’s shape with the number where the stencil goes', () => {
    expect(stickerStrip({ id: 's-147', number: 147, code: '4F2A9C18' })).toEqual({
      id: 's-147',
      stencil: '0147',
      address: 'PRTS.CO/B/4F2A-9C18',
      value: 'HTTPS://PRTS.CO/B/4F2A9C18',
    })
    // no line of words on a sticker (Taunya's ask of 2026-11-15); the test strip keeps its own
    expect(stickerStrip({ id: 's-147', number: 147, code: '4F2A9C18' }).words).toBeUndefined()
  })

  it('the test strip mints nothing and its code lands on Scan a label', () => {
    expect(STICKER_TEST_STRIP.value).toBe('HTTPS://PRTS.CO/B')
    expect(STICKER_TEST_STRIP.stencil).toBe('0000')
    expect(STICKER_TEST_STRIP.words).toBe('Test strip')
  })
})

describe('a run’s words', () => {
  const run = stickerRunOf(runRow)!

  it('titles a run with its count, its sets and its range', () => {
    expect(stickerRunTitle(run)).toBe('Run of 200 sets · 0101 to 0300')
    expect(stickerRunTitle({ ...run, copies: 1 })).toBe('Run of 200 · 0101 to 0300')
  })

  it('says who printed and when', () => {
    expect(stickerRunByLine(run, 'Nov 12')).toBe('Printed Nov 12 by Dana · 2 of each')
    expect(stickerRunByLine({ ...run, copies: 1, printedByName: '' }, 'Nov 12')).toBe('Printed Nov 12')
  })

  it('folds the runs', () => {
    expect(runsFoldWords(1)).toBe('1 run of stickers')
    expect(runsFoldWords(3)).toBe('3 runs of stickers')
  })

  it('names the reprint and the rest', () => {
    expect(reprintLabel(200)).toBe('Reprint 200 stickers')
    expect(reprintLabel(1)).toBe('Reprint 1 sticker')
    expect(printRestLabel([])).toBe('Print the rest')
    expect(printRestLabel([{ number: 300 }, { number: 163 }, { number: 164 }].filter((s) => s.number !== 300))).toBe('Print the rest, 0163 to 0164')
    expect(printRestLabel(Array.from({ length: 138 }, (_, i) => ({ number: 163 + i })))).toBe('Print the rest, 0163 to 0300')
    expect(printRestLabel([{ number: 163 }, { number: 205 }, { number: 206 }])).toBe('Print the rest, 3 stickers')
    expect(printRestLabel([{ number: 163 }])).toBe('Print the rest, 0163')
  })

  it('the press on a minted run names its range', () => {
    const stickers: MintedSticker[] = stickerRows.map((s) => ({ ...s, code: s.code.toUpperCase() }))
    expect(printRunLabel(stickers, 2)).toBe('Print 200 sets, 0101 to 0300')
    expect(printRunLabel(stickers.slice(62), 1)).toBe('Print 138 stickers, 0163 to 0300')
    expect(printRunLabel([stickers[0]!, stickers[5]!], 1)).toBe('Print 2 stickers')
    expect(printRunLabel([], 1)).toBe('Print stickers')
  })

  it('says the strips of a minted run', () => {
    expect(runStripsWords(run, 200)).toBe('0101 to 0300, 2 strips each. 400 strips.')
    expect(runStripsWords({ ...run, copies: 1 }, 138)).toBe('138 of 0101 to 0300, one strip each.')
  })
})

describe('the fold’s rows', () => {
  const rows: StickerRowOfRun[] = stickerRows.map((s, i) => ({ ...s, code: s.code.toUpperCase(), containerId: i < 104 ? `box-${i}` : null, lostAt: i === 110 ? '2026-11-13T00:00:00Z' : null }))

  it('counts and lists the blank ones in order', () => {
    expect(runCountsOf(rows)).toMatchObject({ total: 200, onBoxes: 104, notUsed: 95, lost: 1 })
    const blank = blankStickersOf([...rows].reverse())
    expect(blank).toHaveLength(95)
    expect(blank[0]?.number).toBe(205)
    expect(blank.some((s) => s.number === 211)).toBe(false)
  })
})

describe('the print', () => {
  it('counts the stickers printed whole from the strips the printer took', () => {
    expect(stickersPrintedWhole(3, 2)).toBe(1)
    expect(stickersPrintedWhole(4, 2)).toBe(2)
    expect(stickersPrintedWhole(62, 1)).toBe(62)
    expect(restAfterStop(['a', 'b', 'c'], 3, 2)).toEqual(['b', 'c'])
    expect(restAfterStop(['a', 'b', 'c'], 6, 2)).toEqual([])
  })

  it('says how it went', () => {
    expect(stickersSentWords(400, 200, 2)).toBe('200 stickers printed.')
    expect(stickersSentWords(1, 1, 1)).toBe('1 sticker printed.')
    expect(stickersSentWords(123, 200, 2, 'There is no tape in the printer.')).toBe('61 of 200 stickers printed, then the printer stopped: There is no tape in the printer.')
  })
})

describe('the CSV', () => {
  it('writes one row a sticker in number order', () => {
    const text = stickersCsvText([{ id: 'b', number: 102, code: '9C184F2A' }, { id: 'a', number: 101, code: '4F2A9C18' }])
    expect(text.split('\r\n')).toEqual(['Number,Code,Address,QR', '0101,4F2A-9C18,prts.co/b/4F2A-9C18,HTTPS://PRTS.CO/B/4F2A9C18', '0102,9C18-4F2A,prts.co/b/9C18-4F2A,HTTPS://PRTS.CO/B/9C184F2A', ''])
    expect(stickersCsvFileName({ firstNumber: 101, lastNumber: 300 }, '2026-11-14')).toBe('stickers-0101-0300-2026-11-14.csv')
  })
})

describe('plain words', () => {
  it('every sentence a person reads passes the rules', () => {
    const texts = [STICKER_MINT_WHO, lastRunWords(100), lastRunWords(null), stickerRunCountWords(200, 2), stickersSentWords(123, 200, 2, 'There is no tape in the printer.'), 'A run is 1 to 500 stickers.']
    for (const t of texts) expect(plainWordsFailures(t)).toEqual([])
  })
})
