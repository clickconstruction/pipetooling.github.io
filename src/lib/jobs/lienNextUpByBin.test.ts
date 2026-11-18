import { describe, expect, it } from 'vitest'
import type { LienNextUpRow } from './lienNextUp'
import { groupLienNextUpByBin, isLienFoldRow, lienBinFolds, type LienBinFoldRule, type LienRowBin } from './lienNextUpByBin'

/** The Board's bins, in its order: the notices' column, then the affidavits'. */
const BINS: Record<string, LienRowBin> = {
  'notice:needs_owner': { key: 'notice:needs_owner', label: 'Needs the owner', kind: 'notice', order: 0 },
  'notice:to_send': { key: 'notice:to_send', label: 'To send for Master approval', kind: 'notice', order: 1 },
  'notice:awaiting': { key: 'notice:awaiting', label: 'Awaiting Master approval', kind: 'notice', order: 2 },
  'notice:in_mail': { key: 'notice:in_mail', label: 'Approved · to mail', kind: 'notice', order: 3 },
  'affidavit:needs_property': { key: 'affidavit:needs_property', label: 'Needs the property facts', kind: 'affidavit', order: 7 },
  'affidavit:to_send': { key: 'affidavit:to_send', label: 'To send for Master approval', kind: 'affidavit', order: 8 },
  'affidavit:ready': { key: 'affidavit:ready', label: 'Ready to file', kind: 'affidavit', order: 10 },
}

type Over = Partial<LienNextUpRow> & { bin?: string | null }
const binOf = new Map<string, string | null>()
function row(key: string, over: Over = {}): LienNextUpRow {
  const [kind, jobId] = key.split(':') as ['notice' | 'affidavit' | 'retainage', string]
  const { bin, ...rest } = over
  if (bin !== undefined) binOf.set(key, bin)
  return { key, kind, jobId, gcId: null, title: `Job ${jobId}`, sub: '', dueOn: '2026-11-16', daysLeft: 1, severity: 'red', group: 'now', action: 'draft', button: 'Open', target: { open: 'affidavits', jobId }, ...rest }
}
const binFor = (r: LienNextUpRow) => {
  const key = binOf.get(r.key)
  return key ? BINS[key]! : null
}
const amount = (r: Pick<LienNextUpRow, 'jobId'>) => (r.jobId ? Number(r.jobId) * 100 : null)

const PRINT: LienBinFoldRule = { bin: 'affidavit:ready', action: 'file_affidavit', title: (n) => `${n} affidavits approved and ready to file`, sub: 'One stack for the notary, then the county clerk.', button: 'Print 3 for notarization ›', target: { open: 'affidavits', jobId: '' } }

describe('groupLienNextUpByBin — the list in the Board’s order (punch list #362, step 4)', () => {
  it('draws one group a bin, the notices’ column first, whatever order the rows came in', () => {
    const rows = [
      row('affidavit:5', { bin: 'affidavit:ready', action: 'file_affidavit' }),
      row('notice:2', { bin: 'notice:to_send' }),
      row('affidavit:4', { bin: 'affidavit:needs_property', action: 'fix_property' }),
      row('notice:1', { bin: 'notice:needs_owner', action: 'find_owner' }),
    ]
    const g = groupLienNextUpByBin(rows, { binFor, amount })
    expect(g.groups.map((x) => [x.key, x.label, x.countWords, x.total])).toEqual([
      ['notice:needs_owner', 'Needs the owner', '1 notice', 100],
      ['notice:to_send', 'To send for Master approval', '1 notice', 200],
      ['affidavit:needs_property', 'Needs the property facts', '1 affidavit', 400],
      ['affidavit:ready', 'Ready to file', '1 affidavit', 500],
    ])
    expect(g.groups.every((x) => x.part && x.bin === x.key)).toBe(true)
    expect(g.now).toEqual({ label: 'Needs you now', papers: 4, total: 1200 })
  })

  it('folds the papers that share one act into one row with their jobs behind it, where the desk gave a press', () => {
    const rows = [
      row('affidavit:5', { bin: 'affidavit:ready', action: 'file_affidavit', button: 'File the affidavit' }),
      row('affidavit:6', { bin: 'affidavit:ready', action: 'file_affidavit', button: 'File the affidavit', dueOn: '2026-11-14', daysLeft: -1 }),
      row('affidavit:7', { bin: 'affidavit:ready', action: 'file_affidavit', button: 'File the affidavit', severity: 'amber' }),
      row('affidavit:8', { bin: 'affidavit:to_send', action: 'draft' }),
    ]
    const g = groupLienNextUpByBin(rows, { binFor, amount, folds: [PRINT] })
    const ready = g.groups.find((x) => x.key === 'affidavit:ready')!
    expect(ready.rows).toHaveLength(1)
    const fold = ready.rows[0]!
    expect(isLienFoldRow(fold)).toBe(true)
    expect(fold).toMatchObject({ key: 'fold:affidavit:ready:file_affidavit', kind: 'affidavit', jobId: null, title: '3 affidavits approved and ready to file', sub: 'One stack for the notary, then the county clerk.', button: 'Print 3 for notarization ›', action: 'file_affidavit', dueOn: '2026-11-14', daysLeft: -1, severity: 'red' })
    expect(fold.jobs?.map((j) => j.jobId).sort()).toEqual(['5', '6', '7'])
    // The head counts the papers, not the rows, and the money is every job's.
    expect([ready.countWords, ready.papers, ready.total]).toEqual(['3 affidavits', 3, 1800])
    // One paper alone in its bin is never folded.
    expect(g.groups.find((x) => x.key === 'affidavit:to_send')!.rows.map((r) => r.key)).toEqual(['affidavit:8'])
    expect(g.now?.papers).toBe(4)
  })

  it('does not fold one paper, a bin with no rule, or a row of another act; a viewer with no press gets a fold with none', () => {
    const one = groupLienNextUpByBin([row('affidavit:5', { bin: 'affidavit:ready', action: 'file_affidavit' })], { binFor, folds: [PRINT] })
    expect(one.groups[0]!.rows.map((r) => r.key)).toEqual(['affidavit:5'])
    const mixed = groupLienNextUpByBin([row('affidavit:5', { bin: 'affidavit:ready', action: 'file_affidavit' }), row('affidavit:6', { bin: 'affidavit:ready', action: 'review_hold' }), row('notice:1', { bin: 'notice:to_send' }), row('notice:2', { bin: 'notice:to_send' })], { binFor, folds: [PRINT] })
    expect(mixed.groups.flatMap((x) => x.rows).some(isLienFoldRow)).toBe(false)
    const reader = groupLienNextUpByBin([row('affidavit:5', { bin: 'affidavit:ready', action: 'file_affidavit', button: null }), row('affidavit:6', { bin: 'affidavit:ready', action: 'file_affidavit', button: null })], { binFor, folds: [PRINT] })
    expect(reader.groups[0]!.rows[0]).toMatchObject({ key: 'fold:affidavit:ready:file_affidavit', button: null })
  })

  it('keeps the rows that will not make their day first inside their bin', () => {
    const rows = [row('notice:1', { bin: 'notice:to_send' }), row('notice:2', { bin: 'notice:to_send' }), row('notice:3', { bin: 'notice:to_send' })]
    const g = groupLienNextUpByBin(rows, { binFor, risk: (r) => (r.key === 'notice:3' ? 3 : null) })
    expect(g.groups[0]!.rows.map((r) => r.key)).toEqual(['notice:3', 'notice:1', 'notice:2'])
  })

  it('a retainage notice that waits on the leader has no bin: its head carries the reminder press when no bin does, and never a second one (v2.7478)', () => {
    const waitingRetainage = row('retainage:7', { bin: null, action: 'approve', button: null })
    const alone = groupLienNextUpByBin([waitingRetainage, row('retainage:8', { bin: null })], { binFor, waitingOn: 'Malachi' })
    expect(alone.groups.map((x) => [x.key, Boolean(x.remind)])).toEqual([['other', true]])
    // A bin that holds a waiting paper keeps the press: one press reminds of every paper that waits.
    const both = groupLienNextUpByBin([waitingRetainage, row('notice:1', { bin: 'notice:awaiting', action: 'approve', button: null })], { binFor, waitingOn: 'Malachi' })
    expect(both.groups.map((x) => [x.key, Boolean(x.remind)])).toEqual([['notice:awaiting', true], ['other', false]])
    // Nothing waits: no press.
    expect(groupLienNextUpByBin([row('retainage:8', { bin: null })], { binFor }).groups.map((x) => Boolean(x.remind))).toEqual([false])
  })

  it('the leader’s own rows lead, the papers the office waits on sit in their bin with the reminder press on the first such head, and reminders keep their group', () => {
    const rows = [
      row('notice:1', { bin: 'notice:awaiting', action: 'approve', button: null }),
      row('affidavit:2', { bin: 'affidavit:to_send', action: 'approve', button: null }),
      row('notice:3', { bin: 'notice:awaiting', action: 'approve', button: 'Approve' }),
      row('notice:4', { bin: 'notice:in_mail', action: 'sign', button: 'Sign' }),
      row('notice:5', { bin: null, action: 'courtesy', dueOn: null, daysLeft: null }),
    ]
    const g = groupLienNextUpByBin(rows, { binFor, waitingOn: 'Malachi' })
    expect(g.groups.map((x) => [x.key, x.group, Boolean(x.remind)])).toEqual([
      ['sign', 'sign', false],
      ['mine', 'mine', false],
      ['notice:awaiting', 'waiting', true],
      ['affidavit:to_send', 'waiting', false],
      ['reminders', 'reminders', false],
    ])
    expect(g.groups.find((x) => x.key === 'mine')!.label).toBe('Only you can approve')
    // A bin whose papers all wait on the leader names him on its head, as the day's list did.
    expect(g.groups.find((x) => x.key === 'notice:awaiting')!.countWords).toBe('1 notice · waiting on Malachi')
    expect(groupLienNextUpByBin([rows[0]!], { binFor }).groups[0]!.countWords).toBe('1 notice · waiting on the leader')
  })

  it('a row with no bin that needs someone now goes under Other lien papers, after the bins', () => {
    const g = groupLienNextUpByBin([row('retainage:9', { bin: null, action: 'draft' }), row('notice:1', { bin: 'notice:to_send' })], { binFor })
    expect(g.groups.map((x) => [x.key, x.label, x.countWords])).toEqual([['notice:to_send', 'To send for Master approval', '1 notice'], ['other', 'Other lien papers', '1 paper']])
  })

  it('everything due later waits under one line, in the Board’s order, with what each bin holds', () => {
    const rows = [
      row('affidavit:5', { bin: 'affidavit:ready', action: 'file_affidavit', group: 'coming', dueOn: '2026-12-15', daysLeft: 30, severity: 'quiet' }),
      row('affidavit:6', { bin: 'affidavit:ready', action: 'file_affidavit', group: 'coming', dueOn: '2026-12-15', daysLeft: 30, severity: 'quiet' }),
      row('notice:1', { bin: 'notice:needs_owner', group: 'coming', dueOn: '2026-12-15', daysLeft: 30, severity: 'quiet' }),
      row('notice:2', { bin: 'notice:to_send' }),
    ]
    const g = groupLienNextUpByBin(rows, { binFor, amount, folds: [PRINT] })
    const later = g.groups[g.groups.length - 1]!
    expect(later).toMatchObject({ key: 'later', group: 'coming', label: 'Later', countWords: '3 papers', papers: 3, total: 1200, later: { line: 'Needs the owner, notices 1 · Ready to file, affidavits 2' } })
    expect(later.part).toBeUndefined()
    // Later rows are listed one a paper, in the Board's order and largest first inside a day: nothing later is folded.
    expect(later.rows.map((r) => r.key)).toEqual(['notice:1', 'affidavit:6', 'affidavit:5'])
    expect(g.now).toEqual({ label: 'Needs you now', papers: 1, total: 200 })
  })

  it('an empty list has no groups and no head', () => {
    expect(groupLienNextUpByBin([], { binFor })).toEqual({ groups: [], now: null })
  })
})

describe('lienBinFolds — the folds the desk has a press for', () => {
  it('folds the ready affidavits under the print door’s own words, and the ones to send under the batch send’s, each from two papers up', () => {
    const rules = lienBinFolds({ office: true, printReady: 10, printButton: 'Print 10 for notarization ›', sendReady: 3 })
    expect(rules.map((r) => [r.bin, r.action, r.button, r.target])).toEqual([
      ['affidavit:ready', 'file_affidavit', 'Print 10 for notarization ›', { open: 'affidavit_pile', pile: 'ready' }],
      ['affidavit:to_send', 'draft', 'Send 3 for approval ›', { open: 'affidavit_pile', pile: 'to_draft' }],
    ])
    expect(rules[0]!.title(12)).toBe('12 affidavits approved and ready to file')
    expect(rules[1]!.title(4)).toBe('4 affidavits to send for approval')
  })
  it('folds the filed liens that owe their copies under the press that mails them together (punch list #366)', () => {
    const rules = lienBinFolds({ office: true, printReady: 0, printButton: '', sendReady: 0, serveOwed: 12, serveButton: 'Print 12 liens’ copies ›' })
    expect(rules.map((r) => [r.bin, r.action, r.button, r.target, r.sub])).toEqual([['affidavit:filed', 'record_service', 'Print 12 liens’ copies ›', { open: 'serve_copies' }, 'One stack for the mail, then each mail number.']])
    expect(rules[0]!.title(12)).toBe('12 filed liens owe their copies')
    // One alone keeps its own row and its own Lien window.
    expect(lienBinFolds({ office: true, printReady: 0, printButton: '', sendReady: 0, serveOwed: 1, serveButton: 'x' })).toEqual([])
    expect(lienBinFolds({ office: false, printReady: 0, printButton: '', sendReady: 0, serveOwed: 12, serveButton: 'x' })).toEqual([])
  })
  it('gives none to a viewer who is not the lien office, and none for a press that would take fewer than two', () => {
    expect(lienBinFolds({ office: false, printReady: 10, printButton: 'x', sendReady: 3 })).toEqual([])
    expect(lienBinFolds({ office: true, printReady: 1, printButton: 'x', sendReady: 1 })).toEqual([])
  })
})
