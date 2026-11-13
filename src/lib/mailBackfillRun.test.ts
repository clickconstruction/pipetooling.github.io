import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { appliedOf, argOf, flagOf, ledgerLine, NEVER_TAG_HEAD, parseLedger, plannedOf, sheetCsv, type LedgerEntry } from '../../scripts/lib/mailBackfillRun'
import { parseAddressList } from './myMail/backfillMatch'

// Every mailbox, thread and job here is made up.
const entry = (kind: LedgerEntry['kind'], threadId: string, over: Partial<LedgerEntry> = {}): LedgerEntry => ({
  at: '2026-11-13T03:00:00.000Z',
  kind,
  jobKey: 'pipeline:elm',
  account: 'rosa@clickplumbing.example',
  threadId,
  ...over,
})

describe('the mail backfill’s ledger (punch list #332)', () => {
  it('writes a line an entry and reads them back, skipping a torn last line', () => {
    const text = ledgerLine(entry('plan', 't1', { planHash: 'h1' })) + ledgerLine(entry('applied', 't1', { planHash: 'h1' })) + '{"at":"2026-11-13T03:0'
    expect(parseLedger(text).map((e) => [e.kind, e.threadId])).toEqual([
      ['plan', 't1'],
      ['applied', 't1'],
    ])
    expect(parseLedger('')).toEqual([])
  })

  it('files only a conversation that is planned with a hash and untouched since', () => {
    const ledger = [
      entry('plan', 't1', { planHash: 'h1' }),
      entry('plan', 't2', { planHash: 'h2' }),
      entry('applied', 't2', { planHash: 'h2' }),
      entry('plan', 't3', { planHash: 'h3' }),
      entry('refused', 't3', { words: 'The conversation changed since the plan.' }),
      entry('plan', 't4'),
      entry('plan', 't5', { planHash: 'h5', jobKey: 'pipeline:oak' }),
      entry('plan', 't1', { planHash: 'h1', account: 'marisol@clickplumbing.example' }),
    ]
    expect(plannedOf(ledger, 'pipeline:elm').map((e) => [e.account.split('@')[0], e.threadId, e.planHash])).toEqual([
      ['rosa', 't1', 'h1'],
      ['marisol', 't1', 'h1'],
    ])
  })

  it('takes a newer plan over an older one, and a filing taken back is planned afresh', () => {
    const ledger = [entry('plan', 't1', { planHash: 'old' }), entry('plan', 't1', { planHash: 'new' }), entry('plan', 't2', { planHash: 'h2' }), entry('applied', 't2'), entry('untagged', 't2')]
    expect(plannedOf(ledger, 'pipeline:elm').map((e) => e.planHash)).toEqual(['new'])
    expect(appliedOf(ledger, 'pipeline:elm')).toEqual([])
  })

  it('takes back only what this run filed and has not taken back', () => {
    const ledger = [entry('plan', 't1', { planHash: 'h1' }), entry('applied', 't1'), entry('plan', 't2', { planHash: 'h2' }), entry('applied', 't2'), entry('untagged', 't2'), entry('plan', 't3', { planHash: 'h3' })]
    expect(appliedOf(ledger, 'pipeline:elm').map((e) => e.threadId)).toEqual(['t1'])
  })
})

describe('the sheet a person reads', () => {
  it('quotes commas and quotes, and never lets a cell read as a formula', () => {
    expect(sheetCsv(['mailbox', 'subject'], [['rosa@clickplumbing.example', 'Re: "4 Elm Ct", dates'], ['x', '=HYPERLINK("http://bad.example")'], ['y', '+1 512 555 0100']])).toBe(
      'mailbox,subject\nrosa@clickplumbing.example,"Re: ""4 Elm Ct"", dates"\nx,"\'=HYPERLINK(""http://bad.example"")"\ny,\'+1 512 555 0100\n',
    )
  })
})

describe('the run’s arguments and its guards', () => {
  it('reads a named value and a flag', () => {
    const argv = ['apply', '--job', 'JP1077', '--approved', '--max', '10']
    expect(argOf(argv, '--job')).toBe('JP1077')
    expect(argOf(argv, '--max')).toBe('10')
    expect(argOf(argv, '--dir')).toBeNull()
    expect(argOf(['plan', '--job', '--approved'], '--job')).toBeNull()
    expect(flagOf(argv, '--approved')).toBe(true)
    expect(flagOf(['apply', '--job', 'JP1077'], '--approved')).toBe(false)
  })

  it('seeds a never-tag list whose head is comments alone', () => {
    expect(parseAddressList(NEVER_TAG_HEAD)).toEqual({ addresses: new Set(), domains: new Set() })
  })

  it('files only with --approved, always for the record, and writes nothing in count or plan', () => {
    const run = readFileSync('scripts/mail-backfill.ts', 'utf8')
    expect(run).toContain("if (!flagOf(argv, '--approved')) throw new Error(")
    // Every tag the run plans or files carries for_record: nothing a backfill lands may open on Follow up.
    const tags = run.match(/const tag = \{[^\n]+\}/g) ?? []
    expect(tags.length).toBe(2)
    for (const t of tags) expect(t).toContain('for_record: true')
    // The only seat verbs that write are the two the apply and the undo call.
    const verbs = [...run.matchAll(/seat(?:<[^(]*>)?\('([a-z_]+)'/g)].map((m) => m[1]).sort()
    expect([...new Set(verbs)]).toEqual(['apply_mail_tag', 'apply_mail_untag', 'plan_mail_tag', 'plan_mail_untag', 'read_rows', 'search_mail'])
    expect(run).toContain('The run does not start without one.')
  })
})
