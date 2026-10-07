import { describe, expect, it } from 'vitest'
import { buildHeldLienLines } from './heldLienLine'

const TODAY = '2026-10-02'

describe('buildHeldLienLines', () => {
  it('names the earliest open notice a job still owes', () => {
    const lines = buildHeldLienLines(
      [
        { job_id: 'a', deadline: '2026-11-16', noticed: false, open_balance: 18400 },
        { job_id: 'a', deadline: '2026-10-15', noticed: false, open_balance: 18400 },
        // A month already noticed and a window already closed are not what is due.
        { job_id: 'a', deadline: '2026-10-08', noticed: true, open_balance: 18400 },
        { job_id: 'a', deadline: '2026-09-15', noticed: false, open_balance: 18400 },
      ],
      [],
      TODAY,
    )
    expect(lines.get('a')).toEqual({ words: 'On the Lien desk · our notice is due by Oct 15 · $18,400 unpaid', href: '/jobs?tab=stages&liendesk=1&liendeskJob=a', kind: 'notice', urgent: false })
  })

  it('falls to the lien date when no notice is owed, and opens the Affidavits pane', () => {
    const lines = buildHeldLienLines([{ job_id: 'b', deadline: '2026-10-15', noticed: true, open_balance: 900 }], [{ job_id: 'b', deadline: '2026-10-08', filed: false, open_balance: 900 }], TODAY)
    expect(lines.get('b')).toEqual({ words: 'On the Lien desk · our lien is due by Oct 8 · $900 unpaid', href: '/jobs?tab=stages&liendesk=1&liendeskJob=b&kind=affidavit', kind: 'lien', urgent: true })
  })

  it('a notice owed speaks before the lien date', () => {
    const lines = buildHeldLienLines([{ job_id: 'c', deadline: '2026-10-15', noticed: false, open_balance: 500 }], [{ job_id: 'c', deadline: '2026-11-16', filed: false, open_balance: 500 }], TODAY)
    expect(lines.get('c')!.kind).toBe('notice')
  })

  it('says nothing for a filed lien, a closed window or a job off the desk', () => {
    const lines = buildHeldLienLines([{ job_id: 'd', deadline: '2026-09-15', noticed: false, open_balance: 300 }], [{ job_id: 'e', deadline: '2026-10-15', filed: true, open_balance: 300 }, { job_id: 'f', deadline: '2026-09-15', filed: false, open_balance: 300 }], TODAY)
    expect(lines.size).toBe(0)
  })

  it('leaves the money out when none is given', () => {
    const lines = buildHeldLienLines([{ job_id: 'g', deadline: '2026-10-15', noticed: false, open_balance: null }], [], TODAY)
    expect(lines.get('g')!.words).toBe('On the Lien desk · our notice is due by Oct 15')
  })
})
