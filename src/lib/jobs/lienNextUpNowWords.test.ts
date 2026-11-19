import { describe, expect, it } from 'vitest'
import { lienNextUpCount, type LienNextUpRow } from './lienNextUp'
import { groupLienNextUpByBin, type LienBinFoldRule, type LienRowBin } from './lienNextUpByBin'
import { lienNextUpNowWords } from './lienNextUpNowWords'

const BINS: Record<string, LienRowBin> = {
  'notice:to_send': { key: 'notice:to_send', label: 'To send for Master approval', kind: 'notice', order: 1 },
  'notice:awaiting': { key: 'notice:awaiting', label: 'Awaiting Master approval', kind: 'notice', order: 2 },
  'notice:in_mail': { key: 'notice:in_mail', label: 'Approved · to mail', kind: 'notice', order: 3 },
  'affidavit:ready': { key: 'affidavit:ready', label: 'Ready to file', kind: 'affidavit', order: 10 },
}
const binOf = new Map<string, string>()
function row(key: string, bin: string | null, over: Partial<LienNextUpRow> = {}): LienNextUpRow {
  const [kind, jobId] = key.split(':') as ['notice' | 'affidavit' | 'retainage', string]
  if (bin) binOf.set(key, bin)
  return { key, kind, jobId, gcId: null, title: `Job ${jobId}`, sub: '', dueOn: '2026-11-16', daysLeft: 1, severity: 'red', group: 'now', action: 'draft', button: 'Open', target: { open: 'affidavits', jobId }, ...over }
}
const binFor = (r: LienNextUpRow) => {
  const key = binOf.get(r.key)
  return key ? BINS[key]! : null
}
const LATER = { dueOn: '2026-12-15', daysLeft: 30, severity: 'quiet' as const, group: 'coming' as const }
const PRINT: LienBinFoldRule = { bin: 'affidavit:ready', action: 'file_affidavit', title: (n) => `${n} affidavits approved and ready to file`, sub: 'One stack for the notary, then the county clerk.', button: 'Print 3 for notarization ›', target: { open: 'affidavits', jobId: '' } }
const words = (rows: LienNextUpRow[], folds: LienBinFoldRule[] = []) => lienNextUpNowWords(groupLienNextUpByBin(rows, { binFor, folds, waitingOn: 'Sam' }).groups)

describe('lienNextUpNowWords — what the head over Needs you now says it counts', () => {
  it('names its unit, papers, and says how many more wait under Later', () => {
    const rows = [row('notice:2104', 'notice:to_send'), row('notice:2111', 'notice:to_send'), row('affidavit:2118', 'affidavit:ready', { action: 'file_affidavit' }), row('notice:2125', 'notice:to_send', LATER), row('affidavit:2132', 'affidavit:ready', LATER)]
    expect(words(rows)).toEqual({ count: '3 papers', later: '2 more under Later' })
  })

  it('agrees with one paper, and says nothing of Later with nothing there', () => {
    expect(words([row('notice:2104', 'notice:to_send')])).toEqual({ count: '1 paper', later: null })
  })

  it('is null when nothing needs anyone now, where the list draws no such head', () => {
    expect(words([row('notice:2125', 'notice:to_send', LATER)])).toBeNull()
    expect(words([])).toBeNull()
  })

  it('is the sum of the heads under it and the Later head’s own figure', () => {
    const rows = [
      row('notice:2104', 'notice:to_send'),
      row('affidavit:2118', 'affidavit:ready', { action: 'file_affidavit' }),
      row('affidavit:2119', 'affidavit:ready', { action: 'file_affidavit' }),
      row('affidavit:2120', 'affidavit:ready', { action: 'file_affidavit' }),
      row('retainage:2140', null),
      row('notice:2125', 'notice:to_send', LATER),
    ]
    const g = groupLienNextUpByBin(rows, { binFor, folds: [PRINT], waitingOn: 'Sam' })
    const w = lienNextUpNowWords(g.groups)!
    const parts = g.groups.filter((x) => x.part)
    // Three affidavits fold to one row and still count three; a paper with no bin counts under Other lien papers.
    expect(parts.map((x) => [x.label, x.papers])).toEqual([['To send for Master approval', 1], ['Ready to file', 3], ['Other lien papers', 1]])
    expect(w.count).toBe(`${parts.reduce((n, x) => n + x.papers, 0)} papers`)
    expect(w.count).toBe(`${g.now!.papers} papers`)
    const later = g.groups.find((x) => x.later)!
    expect([later.countWords, w.later]).toEqual(['1 paper', '1 more under Later'])
  })

  it('counts papers and not the tab’s rows: a paper that waits on the leader is in, and a folded row counts each paper', () => {
    const rows = [
      row('notice:2104', 'notice:to_send'),
      // Waiting on the leader: the tab leaves it out, the head keeps it in.
      row('notice:2111', 'notice:awaiting', { action: 'approve', button: null }),
      // One run row standing for six printed notices: one row for the tab, six papers for the head.
      { ...row('notice:run', 'notice:in_mail'), key: 'run:gc1', jobId: null, gcId: 'gc1', jobs: ['2201', '2202', '2203', '2204', '2205', '2206'].map((jobId) => ({ jobId, title: `Job ${jobId}`, dueOn: '2026-11-16' })) },
    ]
    binOf.set('run:gc1', 'notice:in_mail')
    const w = words(rows)!
    expect(lienNextUpCount(rows)).toBe(2)
    expect(w.count).toBe('8 papers')
  })
})
