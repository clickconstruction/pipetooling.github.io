import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  BIO_CAP,
  BIO_PROMPTS,
  BIO_WORDS,
  bioLength,
  bioLengthWith,
  bioLinesFromRows,
  bioOpener,
  bioPickedLines,
  bioText,
  bioTitle,
  firstNameOf,
  introduced,
  leftWords,
  liveLines,
  usualPicks,
  type BioLine,
  type BioLineRow,
} from './bio'

const row = (id: string, text: string, extra: Partial<BioLineRow> = {}): BioLineRow => ({ id, text, text_es: null, position: 1, added_at: '2026-10-16T10:00:00Z', removed_at: null, off_by_user_at: null, ...extra })

const luis: BioLineRow[] = [
  row('l1', 'Luis has been a plumber for twelve years and holds a Texas journeyman license.', { position: 1, text_es: 'Es plomero desde hace doce años y tiene licencia de oficial en Texas.' }),
  row('l2', 'Water heaters and repipes are his specialty.', { position: 2, text_es: 'Su especialidad son los calentadores de agua y las retuberías.' }),
  row('l3', 'Off the clock he coaches Little League in Seguin.', { position: 3 }),
  row('l4', 'He is an Astros fan, win or lose.', { position: 4, text_es: 'Es aficionado de los Astros, ganen o pierdan.', off_by_user_at: '2026-10-16T11:00:00Z' }),
  row('l0', 'He drives a white van.', { position: 2, removed_at: '2026-10-15T00:00:00Z' }),
]

describe('bioLinesFromRows', () => {
  it('orders by place, then when added, then id, and keeps removed and off', () => {
    const lines = bioLinesFromRows(luis)
    expect(lines.map((l) => l.id)).toEqual(['l1', 'l0', 'l2', 'l3', 'l4'])
    expect(lines.find((l) => l.id === 'l0')?.removed).toBe(true)
    expect(lines.find((l) => l.id === 'l4')?.offByUser).toBe(true)
    expect(lines.find((l) => l.id === 'l3')?.textEs).toBeNull()
  })

  it('reads blank Spanish as none', () => {
    expect(bioLinesFromRows([row('a', 'x', { text_es: '   ' })])[0]?.textEs).toBeNull()
  })
})

describe('liveLines and usualPicks', () => {
  const lines = bioLinesFromRows(luis)
  it('leaves the removed line out', () => {
    expect(liveLines(lines).map((l) => l.id)).toEqual(['l1', 'l2', 'l3', 'l4'])
  })
  it('the usual picks are the live lines not turned off', () => {
    expect(usualPicks(lines)).toEqual(['l1', 'l2', 'l3'])
  })
})

describe('the opener', () => {
  it('takes the first word of the name', () => {
    expect(firstNameOf('Luis Ortega')).toBe('Luis')
    expect(firstNameOf('  ')).toBeNull()
    expect(bioOpener('Luis')).toBe('A little about Luis:')
    expect(bioOpener('Luis', 'es')).toBe('Un poco sobre Luis:')
    expect(bioOpener(null)).toBe('A little about me:')
    expect(bioTitle('Luis')).toBe('Luis’s bio')
    expect(bioTitle(null)).toBe('Bio')
  })
})

describe('bioText', () => {
  const lines = bioLinesFromRows(luis)
  it('joins the usual picks after the opener', () => {
    expect(bioText({ lines, first: 'Luis' })).toBe(
      'A little about Luis: Luis has been a plumber for twelve years and holds a Texas journeyman license. Water heaters and repipes are his specialty. Off the clock he coaches Little League in Seguin.',
    )
  })
  it('takes a pick for this customer, in the office’s order, ignoring a removed or unknown id', () => {
    expect(bioText({ lines, first: 'Luis', picked: ['l4', 'l1', 'l0', 'zz'] })).toBe('A little about Luis: Luis has been a plumber for twelve years and holds a Texas journeyman license. He is an Astros fan, win or lose.')
    expect(bioPickedLines({ lines, first: 'Luis', picked: ['l4', 'l1'] }).map((l) => l.id)).toEqual(['l1', 'l4'])
  })
  it('in Spanish takes only the lines that have it', () => {
    expect(bioText({ lines, first: 'Luis', lang: 'es' })).toBe('Un poco sobre Luis: Es plomero desde hace doce años y tiene licencia de oficial en Texas. Su especialidad son los calentadores de agua y las retuberías.')
  })
  it('is null when nothing goes', () => {
    expect(bioText({ lines, first: 'Luis', picked: [] })).toBeNull()
    expect(bioText({ lines: [], first: 'Luis' })).toBeNull()
    expect(bioText({ lines: bioLinesFromRows([row('a', 'Only English.')]), first: 'Luis', lang: 'es' })).toBeNull()
    expect(bioText({ lines: bioLinesFromRows([row('a', 'Off.', { off_by_user_at: '2026-10-16T00:00:00Z' })]), first: 'Luis' })).toBeNull()
  })
})

describe('the count', () => {
  const lines = bioLinesFromRows(luis)
  it('counts every live line, turned off or not, with the opener', () => {
    const whole = 'A little about Luis: Luis has been a plumber for twelve years and holds a Texas journeyman license. Water heaters and repipes are his specialty. Off the clock he coaches Little League in Seguin. He is an Astros fan, win or lose.'
    expect(bioLength(lines, 'Luis')).toBe(whole.length)
    expect(bioLength([], 'Luis')).toBe(0)
    expect(bioLength(lines, 'Luis', 'es')).toBe('Un poco sobre Luis: Es plomero desde hace doce años y tiene licencia de oficial en Texas. Su especialidad son los calentadores de agua y las retuberías. Es aficionado de los Astros, ganen o pierdan.'.length)
  })
  it('says what a new or changed line would do to the whole', () => {
    const before = bioLength(lines, 'Luis')
    expect(bioLengthWith(lines, 'Luis', null, 'He is tall.', null).en).toBe(before + ' He is tall.'.length)
    expect(bioLengthWith(lines, 'Luis', 'l3', 'Short.', null).en).toBe(before - 'Off the clock he coaches Little League in Seguin.'.length + 'Short.'.length)
    expect(bioLengthWith(lines, 'Luis', null, 'x', 'y').es).toBe(bioLength(lines, 'Luis', 'es') + ' y'.length)
  })
  it('reads left or over', () => {
    expect(leftWords(191)).toBe(`${BIO_CAP - 191} left of ${BIO_CAP}`)
    expect(leftWords(BIO_CAP)).toBe(`0 left of ${BIO_CAP}`)
    expect(leftWords(BIO_CAP + 12)).toBe(`12 over ${BIO_CAP}`)
  })
})

describe('introduced', () => {
  it('is true only for a line out that names the tech', () => {
    expect(introduced([{ direction: 'out', introducesUserId: 'u1' }], 'u1')).toBe(true)
    expect(introduced([{ direction: 'out', introducesUserId: 'u2' }], 'u1')).toBe(false)
    expect(introduced([{ direction: 'in', introducesUserId: 'u1' }], 'u1')).toBe(false)
    expect(introduced([{ direction: 'out', introducesUserId: null }], 'u1')).toBe(false)
    expect(introduced([], 'u1')).toBe(false)
  })
})

describe('the prompts and the words', () => {
  it('each prompt starts a sentence by name', () => {
    for (const p of BIO_PROMPTS) expect(p.starter('Luis')).toContain('Luis')
    expect(BIO_PROMPTS.map((p) => p.label)).toEqual(['Years in the trade', 'License', 'Best at', 'Family', 'Off the clock', 'Hometown'])
  })
  it('the sentences a first-timer reads are plain', () => {
    const read = [BIO_WORDS.deskHint('Luis'), BIO_WORDS.deskEmpty('Luis'), BIO_WORDS.addHint, BIO_WORDS.yourHint, BIO_WORDS.yourEmpty, BIO_WORDS.removeAsk('Luis'), BIO_WORDS.tooLong(331), BIO_WORDS.notThere]
    for (const words of read) expect(plainWordsFailures(words), words).toEqual([])
  })
  it('a line of its own', () => {
    const line: BioLine = { id: 'a', text: 'x', textEs: null, position: 1, addedAt: 0, removed: false, offByUser: false }
    expect(usualPicks([line])).toEqual(['a'])
  })
})
