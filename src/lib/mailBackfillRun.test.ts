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
    // The only seat verbs that write are the two the apply and the undo call. `read_mail` reads one mail whole, for who it lands on.
    const verbs = [...run.matchAll(/seat(?:<[^(]*>)?\('([a-z_]+)'/g)].map((m) => m[1]).sort()
    expect([...new Set(verbs)]).toEqual(['apply_mail_tag', 'apply_mail_untag', 'plan_mail_tag', 'plan_mail_untag', 'read_mail', 'read_rows', 'search_mail'])
    expect(run).toContain('The run does not start without one.')
  })

  const body = (run: string, name: string, next: string) => run.slice(run.indexOf(`async function ${name}(): Promise<void> {`), run.indexOf(`async function ${next}(): Promise<void> {`))

  it('files nothing in office hours, and asks for --approved and the hours before it reads or writes anything', () => {
    const run = readFileSync('scripts/mail-backfill.ts', 'utf8')
    const apply = body(run, 'apply', 'undo')
    const approved = apply.indexOf("if (!flagOf(argv, '--approved')) throw new Error(")
    const hours = apply.indexOf('if (inOfficeHours(new Date())) throw new Error(')
    const first = apply.indexOf('await ')
    expect(approved).toBeGreaterThan(-1)
    expect(hours).toBeGreaterThan(approved)
    expect(first).toBeGreaterThan(hours)
    // The never-tag list is the load's own refusal, which only a count is let past.
    expect(apply).toContain('const l = await load()')
    expect(body(run, 'plan', 'apply')).toContain('const l = await load()')
    expect(run.match(/await load\(true\)/g)).toHaveLength(1)
    expect(body(run, 'count', 'plan')).toContain('await load(true)')
  })

  it('plans a conversation only when the contact step names every sender, and makes no contact', () => {
    const run = readFileSync('scripts/mail-backfill.ts', 'utf8')
    const plan = body(run, 'plan', 'apply')
    // One plan line, inside the branch the contact step did not hold; a held conversation gets a line `apply` never reads.
    expect(plan.match(/kind: 'plan'/g)).toHaveLength(1)
    const held = plan.indexOf("if (contact!.kind === 'held') {")
    const heldLine = plan.indexOf("kind: 'held'")
    const planLine = plan.indexOf("kind: 'plan'")
    expect(held).toBeGreaterThan(-1)
    expect(heldLine).toBeGreaterThan(held)
    expect(planLine).toBeGreaterThan(plan.indexOf('} else {', heldLine))
    expect(plan.indexOf('await contactStep(')).toBeLessThan(held)
    // The run names nobody: the doors that make or name a contact are a person's, in the app.
    for (const door of ['contact_for_customer', 'contact_for_job', 'contact_find_or_make', 'contact_make_for_channel', 'name_contact', 'email_place_address']) expect(run).not.toContain(`'${door}'`)
    expect(run).not.toContain("'call_read'")
  })

  it('stops a filing run at an unnamed sender the contact step missed', () => {
    const run = readFileSync('scripts/mail-backfill.ts', 'utf8')
    const apply = body(run, 'apply', 'undo')
    const made = apply.indexOf('done.unknown_sender')
    expect(made).toBeGreaterThan(apply.indexOf("'apply_mail_tag'"))
    expect(apply.slice(made)).toMatch(/if \(unnamed\) \{[\s\S]*?break\n/)
  })

  it('keeps a held conversation out of what apply files, and a later plan puts it back', () => {
    const ledger = [entry('plan', 't1', { planHash: 'h1' }), entry('held', 't1', { words: 'customerNoContact' }), entry('held', 't2', { words: 'stranger' }), entry('plan', 't2', { planHash: 'h2' })]
    expect(plannedOf(ledger, 'pipeline:elm').map((e) => e.threadId)).toEqual(['t2'])
    expect(appliedOf(ledger, 'pipeline:elm')).toEqual([])
  })
})
