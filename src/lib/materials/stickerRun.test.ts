import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { mintStickerRunArgs, nameSpanWords, runSpanWords, stickerReadName, stickerSpanWords, stickerStrip as stripOf, stripNameChars } from './stickerRun'
import {
  blankStickersOf,
  canMintStickers,
  mintedRunOf,
  mintedStickerOf,
  PRINT_STICKERS_LABEL,
  printRestLabel,
  printRunLabel,
  reprintLabel,
  reserveRunPressLabel,
  restAfterStop,
  runCountsOf,
  runsFoldWords,
  runStripsWords,
  STICKER_COUNT_PRESETS,
  STICKER_MINT_WHO,
  STICKER_TEST_STRIP,
  STICKERS_GUIDE_HEADING,
  STICKERS_GUIDE_QUESTION,
  STICKERS_RESERVED_WORDS,
  stickerCountOf,
  stickerReserveWords,
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
  stickersStoppedWords,
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

  it('the ask’s press reserves and prints in one, and a run already made only prints (v2.7484)', () => {
    expect(reserveRunPressLabel(109, 1, ['G92', 'G200'])).toBe('Reserve and print 109 stickers, G92 to G200')
    expect(reserveRunPressLabel(200, 2)).toBe('Reserve and print 200 sets')
    expect(reserveRunPressLabel(1, 1, ['G92'])).toBe('Reserve and print 1 sticker, G92')
    expect(reserveRunPressLabel(0, 1)).toBe('Reserve and print stickers')
    expect(printRunLabel([{ number: 1, boxName: 'G92' }], 1)).toBe('Print 1 sticker, G92')
  })

  it('no word a person reads says a sticker is blank: the press reserves, and the window says what is held (v2.7484)', () => {
    expect(PRINT_STICKERS_LABEL).toBe('Print future stickers')
    expect(STICKERS_GUIDE_HEADING).toBe(PRINT_STICKERS_LABEL)
    expect(STICKERS_GUIDE_QUESTION).toBe('How do I print future stickers?')
    expect(stickerReserveWords(true)).toBe('Printing reserves each name and gives each sticker its own link. You say which box it is on later.')
    expect(stickerReserveWords(false)).toBe('Printing gives each sticker its own link and holds it for a box. You say which box it is on later.')
    for (const words of [stickerReserveWords(true), stickerReserveWords(false), STICKERS_RESERVED_WORDS, PRINT_STICKERS_LABEL, STICKERS_GUIDE_QUESTION]) {
      expect(plainWordsFailures(words)).toEqual([])
      expect(words).not.toMatch(/blank/i)
    }
  })

  it('says the strips under the title', () => {
    expect(stickerRunCountWords(200, 1)).toBe('200 stickers, one strip each.')
    expect(stickerRunCountWords(200, 2)).toBe('200 stickers, 2 strips each. 400 strips.')
    expect(stickerRunCountWords(1, 1)).toBe('1 sticker, one strip each.')
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
  it('is the tape label’s shape, and with no name it has no stencil: the code is drawn larger in its place', () => {
    expect(stickerStrip({ id: 's-147', number: 147, code: '4F2A9C18' })).toEqual({
      id: 's-147',
      stencil: '',
      address: 'PRTS.CO/B/4F2A-9C18',
      value: 'HTTPS://PRTS.CO/B/4F2A9C18',
    })
    // the sticker's running number is nowhere on the strip (Taunya's call of 2026-11-16)
    for (const strip of [stickerStrip({ id: 'x', number: 147, code: '4F2A9C18', boxName: 'G78' }), stickerStrip({ id: 'x', number: 147, code: '4F2A9C18' })]) {
      expect([strip.stencil, strip.address, strip.value].join(' ')).not.toMatch(/147/)
    }
    // no line of words on a sticker (Taunya's ask of 2026-11-15); the test strip keeps its own
    expect(stickerStrip({ id: 's-147', number: 147, code: '4F2A9C18' }).words).toBeUndefined()
  })

  it('the test strip mints nothing and its code lands on Scan a label', () => {
    expect(STICKER_TEST_STRIP.value).toBe('HTTPS://PRTS.CO/B')
    expect(STICKER_TEST_STRIP.stencil).toBe('TEST')
    expect(STICKER_TEST_STRIP.words).toBe('Test strip')
  })
})

describe('a run’s words', () => {
  const run = stickerRunOf(runRow)!

  it('titles a run with no names by its count and its sets', () => {
    expect(stickerRunTitle(run)).toBe('Run of 200 sets')
    expect(stickerRunTitle({ ...run, copies: 1 })).toBe('Run of 200')
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
    // stickers with no names are said by how many, whether or not they are one unbroken block
    expect(printRestLabel([{ number: 163 }, { number: 164 }])).toBe('Print the rest, 2 stickers')
    expect(printRestLabel(Array.from({ length: 138 }, (_, i) => ({ number: 163 + i })))).toBe('Print the rest, 138 stickers')
    expect(printRestLabel([{ number: 163 }, { number: 205 }, { number: 206 }])).toBe('Print the rest, 3 stickers')
    expect(printRestLabel([{ number: 163 }])).toBe('Print the rest, 1 sticker')
  })

  it('the press on a minted run with no names says how many', () => {
    const stickers: MintedSticker[] = stickerRows.map((s) => ({ ...s, code: s.code.toUpperCase() }))
    expect(printRunLabel(stickers, 2)).toBe('Print 200 sets')
    expect(printRunLabel(stickers.slice(62), 1)).toBe('Print 138 stickers')
    expect(printRunLabel([stickers[0]!, stickers[5]!], 1)).toBe('Print 2 stickers')
    expect(printRunLabel([], 1)).toBe('Print stickers')
  })

  it('says the strips of a minted run', () => {
    expect(runStripsWords(run, 200)).toBe('200 stickers, 2 strips each. 400 strips.')
    expect(runStripsWords({ ...run, copies: 1 }, 138)).toBe('138 of 200 stickers, one strip each.')
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
    // Stop printing: the stickers whose every strip went, and no printer to blame
    expect(stickersStoppedWords(4, 30, 2)).toBe('2 of 30 stickers printed, then you stopped the run.')
    expect(stickersStoppedWords(3, 30, 2)).toBe('1 of 30 stickers printed, then you stopped the run.')
    expect(stickersStoppedWords(0, 1, 1)).toBe('0 of 1 sticker printed, then you stopped the run.')
    expect(stickersSentWords(123, 200, 2, 'There is no tape in the printer.')).toBe('61 of 200 stickers printed, then the printer stopped: There is no tape in the printer.')
  })
})

describe('the CSV', () => {
  it('writes one row a sticker in the order they print, with no Number column', () => {
    const text = stickersCsvText([{ id: 'b', number: 102, code: '9C184F2A' }, { id: 'a', number: 101, code: '4F2A9C18' }])
    // the Name column leads; a run with no names leaves it empty
    expect(text.split('\r\n')).toEqual(['Name,Code,Address,QR', ',4F2A-9C18,prts.co/b/4F2A-9C18,HTTPS://PRTS.CO/B/4F2A9C18', ',9C18-4F2A,prts.co/b/9C18-4F2A,HTTPS://PRTS.CO/B/9C184F2A', ''])
    const named = stickersCsvText([{ id: 'a', number: 225, code: '4F2A9C18', boxName: 'G78' }])
    expect(named.split('\r\n')[1]).toBe('G78,4F2A-9C18,prts.co/b/4F2A-9C18,HTTPS://PRTS.CO/B/4F2A9C18')
    // the file is named by the run's names, or by its count when it has none
    expect(stickersCsvFileName({ count: 223, names: ['G78', 'G79', 'G300'] }, '2026-11-14')).toBe('stickers-G78-G300-2026-11-14.csv')
    expect(stickersCsvFileName({ count: 1, names: ['G78'] }, '2026-11-14')).toBe('stickers-G78-2026-11-14.csv')
    expect(stickersCsvFileName({ count: 200, names: null }, '2026-11-14')).toBe('stickers-200-2026-11-14.csv')
  })
})

describe('plain words', () => {
  it('every sentence a person reads passes the rules', () => {
    const texts = [STICKER_MINT_WHO, stickerRunCountWords(200, 2), stickersSentWords(123, 200, 2, 'There is no tape in the printer.'), 'A run is 1 to 500 stickers.']
    for (const t of texts) expect(plainWordsFailures(t)).toEqual([])
  })
})

describe('a run that names its boxes (design section 10, PR 8, v2.7391)', () => {
  const g = (n: number, number: number) => ({ id: `s-${number}`, number, code: '4F2A9C18', boxName: `G${n}` })

  it('the request carries the names, and the count follows them', () => {
    const v = stickerRunRequest({ jobId: 'j', count: 'nonsense', copies: 1, role: 'assistant', names: ['G78', 'G79', 'G80'] })
    expect(v).toEqual({ ok: true, request: { jobId: 'j', count: 3, copies: 1, names: ['G78', 'G79', 'G80'] } })
    // no names: the request is the one a numbered run always made, with no names key at all
    expect(stickerRunRequest({ jobId: 'j', count: '200', copies: 2, role: 'assistant', names: null })).toEqual({ ok: true, request: { jobId: 'j', count: 200, copies: 2 } })
    expect(stickerRunRequest({ jobId: 'j', count: '200', copies: 2, role: 'assistant', names: [] })).toEqual({ ok: true, request: { jobId: 'j', count: 200, copies: 2 } })
    // more names than a run holds is the count's own refusal
    const many = Array.from({ length: 501 }, (_, i) => `G${i + 1}`)
    expect(stickerRunRequest({ jobId: 'j', count: 1, copies: 1, role: 'assistant', names: many })).toEqual({ ok: false, words: 'A run is 1 to 500 stickers.' })
    // who may mint is still asked first
    expect(stickerRunRequest({ jobId: 'j', count: 1, copies: 1, role: 'helpers', names: ['G78'] })).toEqual({ ok: false, words: STICKER_MINT_WHO })
  })

  it('the mint is sent the names only when the run has them', () => {
    expect(mintStickerRunArgs({ jobId: 'j', count: 2, copies: 1, names: ['G78', 'G79'] })).toEqual({ p_job_id: 'j', p_count: 2, p_copies: 1, p_names: ['G78', 'G79'] })
    expect(mintStickerRunArgs({ jobId: 'j', count: 200, copies: 2 })).toEqual({ p_job_id: 'j', p_count: 200, p_copies: 2 })
    expect(mintStickerRunArgs({ jobId: 'j', count: 200, copies: 2, names: null })).toEqual({ p_job_id: 'j', p_count: 200, p_copies: 2 })
  })

  it('the press names its count and its range', () => {
    const names = Array.from({ length: 223 }, (_, i) => `G${78 + i}`)
    expect(stickerRunPressLabel(223, 1, names)).toBe('Print 223 stickers, G78 to G300')
    expect(stickerRunPressLabel(223, 2, names)).toBe('Print 223 sets, G78 to G300')
    expect(stickerRunPressLabel(1, 1, ['G78'])).toBe('Print 1 sticker, G78')
    expect(stickerRunPressLabel(200, 1, null)).toBe('Print 200 stickers')
    expect(stickerRunPressLabel(0, 1, names)).toBe('Print stickers')
    expect(nameSpanWords('G78', 'G78')).toBe('G78')
  })

  it('a named sticker prints its name large over the link, and nothing else', () => {
    expect(stripOf(g(78, 225))).toEqual({ id: 's-225', stencil: 'G78', address: 'PRTS.CO/B/4F2A-9C18', value: 'HTTPS://PRTS.CO/B/4F2A9C18' })
    expect(stripOf({ id: 'a', number: 147, code: '4F2A9C18', boxName: null })).toEqual({ id: 'a', stencil: '', address: 'PRTS.CO/B/4F2A-9C18', value: 'HTTPS://PRTS.CO/B/4F2A9C18' })
  })

  it('up to four characters print at the full size, five to seven smaller', () => {
    const strip = (boxName: string) => stripOf({ id: 'a', number: 1, code: '4F2A9C18', boxName })
    expect(strip('G78').small).toBeUndefined()
    expect(strip('AB12').small).toBeUndefined()
    expect(strip('AB300').small).toBe(true)
    expect(strip('ABC999Z').small).toBe(true)
    // the room the print window cuts: a seven-character name at the smaller size takes five characters' worth
    expect(stripNameChars(strip('ABC999Z'))).toBe(5)
    expect(stripNameChars(strip('AB300'))).toBe(4)
    expect(stripNameChars(strip('G120'))).toBe(4)
    expect(stripNameChars(strip('G7'))).toBe(2)
    // a sticker with no name: the room its larger code needs
    expect(stripNameChars(stripOf({ id: 'a', number: 1, code: '4F2A9C18' }))).toBe(4)
  })

  it('a block of stickers reads by its names when every one has one, and has no words when not', () => {
    expect(stickerSpanWords([g(78, 225), g(79, 226), g(80, 227)])).toBe('G78 to G80')
    expect(stickerSpanWords([g(78, 225)])).toBe('G78')
    expect(stickerSpanWords([g(78, 225), { boxName: null }])).toBe('')
    expect(stickerSpanWords([])).toBe('')
    expect(stickerReadName(g(78, 225))).toBe('G78')
    // one with no name is read by its code, as the tape prints it
    expect(stickerReadName({ code: '4F2A9C18' })).toBe('4F2A-9C18')
  })

  it('the presses on a minted run name the names', () => {
    const run = [g(78, 225), g(79, 226), g(80, 227)]
    expect(printRunLabel(run, 1)).toBe('Print 3 stickers, G78 to G80')
    expect(printRestLabel(run.slice(1))).toBe('Print the rest, G79 to G80')
    // a broken block says how many, as a numbered one does
    expect(printRestLabel([run[0]!, run[2]!])).toBe('Print the rest, 2 stickers')
    expect(printRunLabel([run[0]!, run[2]!], 1)).toBe('Print 2 stickers')
  })

  it('the Runs fold titles a named run by its names, and its line under says who and when, never a number', () => {
    const names = Array.from({ length: 223 }, (_, i) => `G${78 + i}`)
    const run = { count: 223, copies: 1, names, printedByName: 'Dana' }
    expect(stickerRunTitle(run)).toBe('Run of 223 · G78 to G300')
    expect(stickerRunTitle({ ...run, copies: 2 })).toBe('Run of 223 sets · G78 to G300')
    expect(stickerRunByLine(run, 'Nov 15')).toBe('Printed Nov 15 by Dana')
    expect(stickerRunByLine({ ...run, copies: 2 }, 'Nov 15')).toBe('Printed Nov 15 by Dana · 2 of each')
    expect(runSpanWords(run)).toBe('G78 to G300')
    expect(runStripsWords(run, 223)).toBe('G78 to G300, one strip each.')
    expect(runStripsWords(run, 8)).toBe('8 of G78 to G300, one strip each.')
    // a run with no names is said by its count
    expect(stickerRunTitle({ count: 200, copies: 1, names: null })).toBe('Run of 200')
    expect(runSpanWords({ names: null })).toBe('')
    expect(runStripsWords({ count: 1, copies: 1, names: null }, 1)).toBe('1 sticker, one strip each.')
  })
})
