import { describe, expect, it } from 'vitest'
import type { WorkMonth } from './forecastWorkMonths'
import type { LienMonthHistoryEntry } from './lienMonthHistory'
import { affidavitMonthRows, affidavitMonthsSentence } from './affidavitMonths'

const wm = (key: string, hours: number, notice: WorkMonth['notice']): WorkMonth => ({ key, label: key, weeks: [], people: [], hours, pendingHours: 0, dayCount: 1, hoursShare: 0, notice })
const hist = (month: string, over: Partial<LienMonthHistoryEntry>): LienMonthHistoryEntry => ({ month, outcome: 'missed', at: '', reason: '', byName: '', deadline: '', approvedHours: null, approvalMode: '', ...over })
const label = (k: string) => ({ '2026-06': 'June 2026', '2026-07': 'July 2026', '2026-08': 'August 2026', '2026-05': 'May 2026' })[k] ?? k

describe('affidavitMonthRows (v2.3681)', () => {
  it('a noticed month is on the lien, a missed one is unsecured, an open one waits — job 258', () => {
    const work = [wm('2026-06', 8, { due: '2026-09-15', daysLeft: -6, state: 'closed' }), wm('2026-07', 41.4, { due: '2026-10-15', daysLeft: 24, state: 'sent' }), wm('2026-08', 61.7, { due: '2026-11-16', daysLeft: 56, state: 'open' })]
    const history = [hist('2026-06', { deadline: '2026-09-15' }), hist('2026-07', { outcome: 'sent', at: '2026-09-24T15:00:00Z' })]
    const rows = affidavitMonthRows(work, history)
    expect(rows).toEqual([
      { key: '2026-06', status: 'unsecured', words: '8 approved hours · window closed Sep 15 with no notice — the lien does not cover it' },
      { key: '2026-07', status: 'lien', words: '41.4 approved hours · notice sent Sep 24' },
      { key: '2026-08', status: 'open', words: '61.7 approved hours · notice still open — mail by Nov 16' },
    ])
    expect(affidavitMonthsSentence(rows, label)).toBe("The affidavit names July 2026, and August 2026 once its notice has gone out. June 2026's share of the balance stays an ordinary receivable — chase it in Collections; it does not ride on the lien.")
  })

  it('a skipped month says who gave it up; a direct job needs no monthly notice; nothing noticed says so', () => {
    const skipped = affidavitMonthRows([wm('2026-05', 1, { due: '2026-08-17', daysLeft: -30, state: 'closed' })], [hist('2026-05', { outcome: 'skipped', at: '2026-08-11T13:59:00Z', byName: 'Taunya', reason: 'paid' })])
    expect(skipped[0]).toEqual({ key: '2026-05', status: 'unsecured', words: '1 approved hour · skipped Aug 11 by Taunya — given up on purpose; the lien does not cover it' })
    expect(affidavitMonthsSentence(skipped, label)).toBe("No month has a notice on record — the affidavit cannot claim this work. May 2026's share of the balance stays an ordinary receivable — chase it in Collections; it does not ride on the lien.")
    expect(affidavitMonthRows([wm('2026-06', 8, null)], [])[0]).toEqual({ key: '2026-06', status: 'lien', words: '8 approved hours · no monthly notice required' })
    expect(affidavitMonthsSentence([{ key: '2026-08', status: 'open', words: '' }], label)).toBe('Nothing is on the lien yet — August 2026 joins it once the notice has gone out.')
  })
})
