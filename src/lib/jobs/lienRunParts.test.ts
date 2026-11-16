import { describe, expect, it } from 'vitest'
import { LIEN_RUN_GROUPS, lienRunPartOf, lienRunParts, lienRunSubLine } from './lienRunParts'

type RowIn = Parameters<typeof lienRunParts>[0][number]
const row = (itemId: string, over: Partial<RowIn> = {}): RowIn => ({ itemId, held: null, signed: { how: 'typed', at: '2026-11-12T15:00:00Z', by: 'Malachi' }, printed: null, paperless: false, mailed: null, ...over })
const printed = { at: '2026-11-16T15:00:00Z', by: 'Taunya' }
const mailed = { tracking: '9407 1118 9956 0031 2245 17', sentOn: null }
const env = (key: string, ids: string[], over: { tracking?: string; method?: 'certified_mail' | 'email'; via?: 'docsmit' } = {}) => ({ key, method: over.method ?? ('certified_mail' as const), tracking: over.tracking ?? '', contents: ids.map((itemId) => ({ notice: { itemId }, recipient: { via: over.via } })) })

/** The drawing's batch: 15 notices, 8 ready, 5 waiting on the signature, 2 held. */
const fifteen = () => [
  ...['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8'].map((id) => row(id)),
  ...['w1', 'w2', 'w3', 'w4', 'w5'].map((id) => row(id, { signed: null })),
  row('h1', { held: 'no mailing address' }),
  row('h2', { held: 'Nothing to claim: the job owes $0 now.', signed: null }),
]

describe('lienRunPartOf — every notice is in one part', () => {
  it('a hold comes before the signature, the signature before the print, the print before the numbers', () => {
    expect(lienRunPartOf(row('a', { held: 'no mailing address', signed: null }))).toBe('held')
    expect(lienRunPartOf(row('a', { signed: null, printed }))).toBe('wait')
    expect(lienRunPartOf(row('a'))).toBe('ready')
    expect(lienRunPartOf(row('a', { signed: 'not_needed' }))).toBe('ready')
    expect(lienRunPartOf(row('a', { printed }))).toBe('owe')
    expect(lienRunPartOf(row('a', { paperless: true }))).toBe('owe')
    expect(lienRunPartOf(row('a', { printed, mailed }))).toBe('record')
  })
})

describe('lienRunParts — one total in notices, its parts in the same words (v2.7477, punch list #362)', () => {
  it('step 1: the window opens on what stops a notice, and the one press prints what is ready', () => {
    const p = lienRunParts(fifteen(), [env('gc', ['r1', 'r2', 'r3', 'r4', 'w1']), env('o1', ['r1']), env('o2', ['r2']), env('o9', ['w1']), env('mail', ['r3'], { method: 'email' })], { leaderName: 'Malachi' })
    expect(p.total).toBe(15)
    expect(p.counts).toEqual({ held: 2, wait: 5, ready: 8, owe: 0, record: 0 })
    expect(p.step).toBe(1)
    expect(p.nodes.map((n) => [n.label, n.count, n.state])).toEqual([
      ['Get them right', '8 of 15 are ready', 'now'],
      ['Print', '0 of 15 printed', 'todo'],
      ['Mail and record', '0 of 15 ready to record', 'todo'],
    ])
    expect(p.line.total).toEqual({ n: 15, words: 'notices' })
    expect(p.line.parts.map((x) => [x.key, x.n, x.words])).toEqual([['ready', 8, 'ready'], ['wait', 5, 'wait on Malachi’s signature'], ['held', 2, 'held']])
    // The parts add up to the total: nothing is counted twice or left out.
    expect(p.line.parts.reduce((n, x) => n + x.n, 0)).toBe(p.line.total.n)
    // Envelopes are named as envelopes: the paper ones the ready notices print into. The email copy carries no number.
    expect(p.envelopes).toMatchObject({ total: 4, forReady: 3 })
    expect(p.press).toEqual({ act: 'print', label: 'Print 8 notices', dead: false, line1: '8 can print now. 7 stay for the next packet.', line2: 'The packet prints with its checklist sheet, in envelope order: 3 envelopes.' })
  })

  it('with nothing stopped the run is on the print; with nothing ready it says why nothing can print', () => {
    const all = lienRunParts([row('a'), row('b')], [env('e', ['a', 'b'])])
    expect(all.step).toBe(2)
    expect(all.nodes.map((n) => n.state)).toEqual(['done', 'now', 'todo'])
    expect(all.nodes[0]!.count).toBe('2 of 2 were ready')
    expect(all.press).toMatchObject({ label: 'Print 2 notices', line1: '2 can print now.' })
    const none = lienRunParts([row('w', { signed: null }), row('h', { held: 'no mailing address' })], [])
    expect(none.step).toBe(1)
    expect(none.press).toEqual({ act: 'print', label: 'Print notices', dead: true, line1: 'Nothing can print yet.', line2: '1 waits on the leader’s signature. 1 notice is held, each with its reason.' })
  })

  it('step 3: after the print the count is what printed, and the press is dead until a notice has every number', () => {
    const rows = [...['r1', 'r2', 'r3'].map((id) => row(id, { printed })), row('w1', { signed: null }), row('h1', { held: 'no mailing address' })]
    const envs = [env('gc', ['r1', 'r2', 'r3']), env('o1', ['r1']), env('o2', ['r2']), env('o3', ['r3'])]
    const p = lienRunParts(rows, envs, { leaderName: 'Malachi' })
    expect(p.step).toBe(3)
    expect(p.nodes.map((n) => [n.count, n.state])).toEqual([['3 of 5 were ready', 'done'], ['3 of 5 printed', 'done'], ['0 of 4 numbers typed', 'now']])
    expect(p.line.total).toEqual({ n: 3, words: 'printed' })
    expect(p.line.parts.map((x) => [x.key, x.n, x.words])).toEqual([['owe', 3, 'owe a number']])
    expect(p.envelopes).toMatchObject({ numbersOwed: 4, numbersTyped: 0 })
    expect(p.press).toEqual({ act: 'record', label: 'Record the mailing', dead: true, line1: '4 envelopes owe a number.', line2: 'Type each from its green slip, or scan it with a phone.' })
  })

  it('with the numbers in, the one press records what is ready and says what stays', () => {
    const rows = [row('r1', { printed, mailed }), row('r2', { printed, mailed }), row('r3', { printed })]
    const envs = [env('gc', ['r1', 'r2', 'r3'], { tracking: '9407 1' }), env('o1', ['r1'], { tracking: '9407 2' }), env('o2', ['r2'], { tracking: '9407 3' }), env('o3', ['r3'])]
    const p = lienRunParts(rows, envs)
    expect(p.step).toBe(3)
    expect(p.nodes[2]!.count).toBe('3 of 4 numbers typed')
    expect(p.line.parts.map((x) => [x.key, x.n, x.words])).toEqual([['record', 2, 'ready to record'], ['owe', 1, 'owes a number']])
    expect(p.press).toEqual({ act: 'record', label: 'Record 2 mailings', dead: false, line1: '2 are ready to record. 1 stays here until its numbers are typed.', line2: 'Recording writes each notice to its job with how it went and every month it covered.' })
  })

  it('a second packet: notices signed after the first print put the run back on the print, with what printed in the count', () => {
    const p = lienRunParts([row('a', { printed }), row('b'), row('c', { signed: null })], [env('e1', ['a']), env('e2', ['b'])])
    expect(p.step).toBe(2)
    expect(p.line.parts.map((x) => [x.key, x.n])).toEqual([['ready', 1], ['printed', 1], ['wait', 1]])
    expect(p.press.label).toBe('Print 1 notice')
  })

  it('an envelope a mail service sends carries no number here, and an empty run says so', () => {
    const p = lienRunParts([row('a', { printed })], [env('d', ['a'], { via: 'docsmit' }), env('o', ['a'])])
    expect(p.envelopes).toMatchObject({ total: 1, numbersOwed: 1 })
    const empty = lienRunParts([], [])
    expect(empty).toMatchObject({ total: 0, step: null, press: { act: 'none', label: 'Nothing to send', dead: true } })
    expect(empty.nodes.every((n) => n.state === 'todo')).toBe(true)
  })
})

describe('the window’s second line and its groups', () => {
  it('names the copies and the envelopes once, with the last day to mail when the desk has one', () => {
    expect(lienRunSubLine({ copies: 30, envelopes: 16, mailByWords: 'Mon Nov 16' })).toBe('30 copies in 16 envelopes · last day to mail Mon Nov 16')
    expect(lienRunSubLine({ copies: 1, envelopes: 1 })).toBe('1 copy in 1 envelope')
    expect(lienRunSubLine({ copies: 0, envelopes: 0 })).toBe('')
  })
  it('draws the rows in the parts’ order, what is stopped first, each head with its count', () => {
    expect(LIEN_RUN_GROUPS.map((g) => g.key)).toEqual(['held', 'wait', 'ready', 'owe', 'record'])
    expect(LIEN_RUN_GROUPS.map((g) => g.head(g.key === 'held' ? 2 : 1, 'Malachi'))).toEqual(['Held · 2 notices', 'Waits on Malachi’s signature · 1 notice', 'Ready · 1 notice', 'Printed · 1 notice · owes a number', 'Ready to record · 1 notice'])
  })
})
