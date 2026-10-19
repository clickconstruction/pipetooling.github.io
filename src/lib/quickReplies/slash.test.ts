import { describe, expect, it } from 'vitest'
import type { QuickReply, StepRef } from './kernel'
import { paperTeamLine, SLASH_WORDS_MAX, slashHead, slashLines, slashMove, slashPaperKind, slashPick, slashTotal, slashWordAt, type SlashInput } from './slash'

const line = (id: string, text: string, set: Partial<QuickReply> = {}): QuickReply => ({
  id,
  text,
  for: 'customer',
  stepId: null,
  scope: 'team',
  addedBy: 'u-rosa',
  addedAt: Date.parse('2026-10-01T14:00:00.000Z'),
  removed: false,
  uses: {},
  lastUsed: null,
  ...set,
})

const STEPS: StepRef[] = [
  { id: 'billed', name: 'Billed' },
  { id: 'paid', name: 'Paid' },
  { id: 'found', name: 'What we found' },
]

const LINES: QuickReply[] = [
  line('bill', '{first}, here is your bill for {job}. You can pay it here: {bill}', { uses: { 'u-rosa': 4 } }),
  line('remind', '{first}, a reminder that {amount} for {job} is still open. You can pay it here: {bill}', { stepId: 'paid' }),
  line('paid', 'Thank you, {first}. We got your payment for {job}.', { uses: { 'u-lee': 9 } }),
  line('found', '{first}, {tech} found {found}. We will send you a price shortly.', { stepId: 'found' }),
  line('late', '{first}, we are running behind. The new window is {window}.', { textEs: '{first}, vamos con retraso. La nueva ventana es {window}.' }),
  line('thanks', 'Got it, thank you.', { for: 'any', uses: { 'u-rosa': 30 } }),
  line('trade', 'Is the W-9 on its way?', { for: 'trade' }),
  line('gone', 'The site is open from 7.', { removed: true }),
  line('mine', 'Call me on my cell.', { scope: 'mine', addedBy: 'u-lee' }),
]

const input = (set: Partial<SlashInput> = {}): SlashInput => ({ kind: 'customer', nowStepId: null, steps: STEPS, me: 'u-rosa', ...set })
const ids = (rows: readonly QuickReply[]) => rows.map((q) => q.id)

describe('slashWordAt: which / opens the list', () => {
  it('opens on a / at the start of the box, after a space and after a line break', () => {
    expect(slashWordAt('/', 1)).toEqual({ start: 0, end: 1, words: '' })
    expect(slashWordAt('/pay', 4)).toEqual({ start: 0, end: 4, words: 'pay' })
    expect(slashWordAt('Hi Dana /pa', 11)).toEqual({ start: 8, end: 11, words: 'pa' })
    expect(slashWordAt('Hi Dana,\n/late', 14)).toEqual({ start: 9, end: 14, words: 'late' })
  })

  it('takes the whole word when the caret sits inside it, and stops at the next space', () => {
    expect(slashWordAt('/pay thanks', 3)).toEqual({ start: 0, end: 4, words: 'pay' })
  })

  it('opens nothing for a / inside a word: a fraction, and/or, a date, a link', () => {
    expect(slashWordAt('a 1/2 inch line', 5)).toBeNull()
    expect(slashWordAt('and/or', 6)).toBeNull()
    expect(slashWordAt('on 10/19', 8)).toBeNull()
    expect(slashWordAt('https://example.com/pay', 23)).toBeNull()
  })

  it('opens nothing for a / with a space straight after it, two slashes, or a sentence after it', () => {
    expect(slashWordAt('/ ', 2)).toBeNull()
    expect(slashWordAt('//', 2)).toBeNull()
    expect(slashWordAt('/a/b', 4)).toBeNull()
    expect(slashWordAt(`/${'x'.repeat(SLASH_WORDS_MAX + 1)}`, SLASH_WORDS_MAX + 2)).toBeNull()
    expect(slashWordAt(`/${'x'.repeat(SLASH_WORDS_MAX)}`, SLASH_WORDS_MAX + 1)?.words.length).toBe(SLASH_WORDS_MAX)
  })

  it('opens nothing before the first character or past the end', () => {
    expect(slashWordAt('/pay', 0)).toBeNull()
    expect(slashWordAt('/pay', 5)).toBeNull()
    expect(slashWordAt('', 0)).toBeNull()
  })
})

describe('slashLines: the strip’s lines in the strip’s order, narrowed by the words', () => {
  it('lists their kind’s lines and anyone’s, the most used first; a removed line and someone else’s own line stay out', () => {
    expect(ids(slashLines(LINES, input(), ''))).toEqual(['bill', 'paid', 'found', 'late', 'remind', 'thanks'])
    expect(slashTotal(LINES, input())).toBe(6)
  })

  it('narrows by the words, blanks’ names included, as the strip’s narrow box does', () => {
    expect(ids(slashLines(LINES, input(), 'pay'))).toEqual(['bill', 'paid', 'remind'])
    expect(ids(slashLines(LINES, input(), 'PAY'))).toEqual(['bill', 'paid', 'remind'])
    expect(ids(slashLines(LINES, input(), 'window'))).toEqual(['late'])
    expect(ids(slashLines(LINES, input(), 'zzz'))).toEqual([])
  })

  it('finds a line by its Spanish words too', () => {
    expect(ids(slashLines(LINES, input(), 'retraso'))).toEqual(['late'])
  })

  it('puts the step they are on first, and the job’s stage before that', () => {
    expect(ids(slashLines(LINES, input({ nowStepId: 'found' }), ''))).toEqual(['found', 'bill', 'paid', 'late', 'remind', 'thanks'])
    expect(ids(slashLines(LINES, input({ nowStepId: 'found', stageStepIds: ['paid'] }), 'pay'))).toEqual(['remind', 'bill', 'paid'])
  })

  it('gives a trade partner their own lines and anyone’s, never a customer’s', () => {
    expect(ids(slashLines(LINES, input({ kind: 'trade' }), ''))).toEqual(['trade', 'thanks'])
  })
})

describe('slashLines with shortcuts (C): the word first, then the words that start it, then the lines’ words', () => {
  const KEYED: QuickReply[] = [
    ...LINES.filter((q) => q.id !== 'bill' && q.id !== 'remind' && q.id !== 'late'),
    line('bill', '{first}, here is your bill for {job}. You can pay it here: {bill}', { uses: { 'u-rosa': 4 }, shortcut: 'bill' }),
    line('remind', '{first}, a reminder that {amount} for {job} is still open. You can pay it here: {bill}', { stepId: 'paid', shortcut: 'remind' }),
    line('late', '{first}, we are running behind. The new window is {window}.', { shortcut: 'late' }),
    line('back', '{first}, we will be back {back day} to finish.', { shortcut: 'back' }),
  ]

  it('puts the line whose shortcut is the words first, then the shortcuts that start with them', () => {
    expect(ids(slashLines(KEYED, input(), 'back')).slice(0, 1)).toEqual(['back'])
    expect(ids(slashLines(KEYED, input(), 'b'))[0]).toBe('bill')
    expect(ids(slashLines(KEYED, input(), 'b')).slice(0, 2)).toEqual(['bill', 'back'])
  })

  it('finds a line by its shortcut even when its words do not hold them', () => {
    expect(ids(slashLines(KEYED, input(), 'remind'))).toEqual(['remind'])
    expect(ids(slashLines(KEYED, input(), 'lat'))).toEqual(['late'])
  })

  it('reads the typed words in any case, and lists each line once', () => {
    const rows = ids(slashLines(KEYED, input(), 'BILL'))
    expect(rows[0]).toBe('bill')
    expect(new Set(rows).size).toBe(rows.length)
    expect(rows).toContain('remind')
  })

  it('leaves the order alone when nothing is typed', () => {
    expect(ids(slashLines(KEYED, input(), ''))).toEqual(ids(slashLines(KEYED.map((q) => ({ ...q, shortcut: null })), input(), '')))
  })
})

describe('slashPick: the / word gives way to the line', () => {
  it('fills an empty box with the line and puts the caret after it', () => {
    expect(slashPick('/pay', { start: 0, end: 4, words: 'pay' }, 'Dana, here is your bill.')).toEqual({ text: 'Dana, here is your bill.', caret: 24 })
  })

  it('keeps the words before and after the / word', () => {
    const text = 'Hi /pa see you'
    const word = slashWordAt(text, 6)!
    expect(slashPick(text, word, 'Dana, here is your bill.')).toEqual({ text: 'Hi Dana, here is your bill. see you', caret: 27 })
  })
})

describe('slashMove and slashHead', () => {
  it('moves down and up through the rows, round the ends', () => {
    expect(slashMove(0, 3, 1)).toBe(1)
    expect(slashMove(2, 3, 1)).toBe(0)
    expect(slashMove(0, 3, -1)).toBe(2)
    expect(slashMove(4, 0, 1)).toBe(0)
  })

  it('names whose lines they are and how many fit', () => {
    expect(slashHead('Dana', 3, 11)).toEqual({ title: 'Quick replies for Dana', count: '3 of 11' })
    expect(slashHead(null, 0, 2)).toEqual({ title: 'Quick replies', count: '0 of 2' })
  })
})

describe('the customer’s papers (#127 PR 2)', () => {
  it('slashPaperKind: two letters or more that start a paper word, or a paper word that starts them', () => {
    expect([slashPaperKind('bi'), slashPaperKind('bill'), slashPaperKind('billing'), slashPaperKind('inv'), slashPaperKind('pay'), slashPaperKind('owe')]).toEqual(['bill', 'bill', 'bill', 'bill', 'bill', 'bill'])
    expect([slashPaperKind('es'), slashPaperKind('estimate'), slashPaperKind('quo'), slashPaperKind('price')]).toEqual(['estimate', 'estimate', 'estimate', 'estimate'])
    expect([slashPaperKind(''), slashPaperKind('b'), slashPaperKind('late'), slashPaperKind('thanks')]).toEqual([null, null, null, null])
  })

  it('paperTeamLine: the person’s most used line holding the paper’s blank, none for a paid bill', () => {
    const own = line('own-bill', 'Your bill: {bill}', { uses: { 'u-rosa': 2 } })
    const team = line('team-bill', 'Pay here: {bill}', { uses: { 'u-lee': 9 } })
    const est = line('est', 'Your estimate: {estimate}')
    const lines = [team, own, est, line('trade-bill', 'Draw: {bill}', { for: 'trade' })]
    expect(paperTeamLine(lines, 'customer', { kind: 'bill', open: true }, 'u-rosa')?.id).toBe('own-bill')
    expect(paperTeamLine(lines, 'customer', { kind: 'bill', open: false }, 'u-rosa')).toBeNull()
    expect(paperTeamLine(lines, 'customer', { kind: 'estimate' }, 'u-rosa')?.id).toBe('est')
    expect(paperTeamLine([team], 'trade', { kind: 'estimate' }, 'u-rosa')).toBeNull()
  })
})
