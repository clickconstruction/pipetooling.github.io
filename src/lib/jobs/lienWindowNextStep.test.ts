import { describe, expect, it } from 'vitest'
import type { LienTimelineNext } from './lienTimeline'
import { lienNextStepDaysWords, lienWindowNextStep } from './lienWindowNextStep'

const next = (over: Partial<LienTimelineNext>): LienTimelineNext => ({ kind: 'notice', words: 'Send the § 53.056 notice by Oct 15.', aside: '', date: '2026-10-15', daysLeft: 10, tone: 'amber', ...over })

describe('lienWindowNextStep', () => {
  it('a notice and a retainage notice are worked on the Lien desk, on this job', () => {
    const n = lienWindowNextStep(next({}), null)
    expect([n.words, n.daysWords, n.tone]).toEqual(['Send the § 53.056 notice by Oct 15.', '10 days left', 'amber'])
    expect(n.button).toEqual({ label: 'Open it on the Lien desk', door: { to: 'desk', kind: 'notice' } })
    expect(lienWindowNextStep(next({ kind: 'retainage' }), null).button?.door).toEqual({ to: 'desk', kind: 'retainage' })
  })

  it('the affidavit, its service and the release of record are made in this window: the button switches the tab', () => {
    expect(lienWindowNextStep(next({ kind: 'affidavit' }), null).button).toEqual({ label: 'Go to the affidavit', door: { to: 'tab', tab: 'affidavit' } })
    expect(lienWindowNextStep(next({ kind: 'serve' }), null).button).toEqual({ label: 'Record the service', door: { to: 'tab', tab: 'affidavit' } })
    expect(lienWindowNextStep(next({ kind: 'release' }), null).button).toEqual({ label: 'Go to the release of record', door: { to: 'tab', tab: 'release_record' } })
  })

  it('counsel’s step and a finished path have no button; a finished path shows no countdown', () => {
    expect(lienWindowNextStep(next({ kind: 'suit' }), null).button).toBeNull()
    const gone = lienWindowNextStep(next({ kind: 'lien_gone', daysLeft: -30 }), null)
    expect([gone.button, gone.daysWords]).toEqual([null, ''])
    expect(lienWindowNextStep(next({ kind: 'none', daysLeft: null }), null).daysWords).toBe('')
  })

  it('says who we wait on when the move is not ours', () => {
    expect(lienWindowNextStep(next({}), { who: 'gc', words: 'payment or a reply' } as never).waitingWords).toBe('Waiting on the GC: payment or a reply')
    expect(lienWindowNextStep(next({}), { who: 'ours', words: 'the draft' } as never).waitingWords).toBe('')
    expect(lienWindowNextStep(next({}), null).waitingWords).toBe('')
  })

  it('the days read late, today, or left', () => {
    expect([lienNextStepDaysWords(-4), lienNextStepDaysWords(-1), lienNextStepDaysWords(0), lienNextStepDaysWords(1), lienNextStepDaysWords(12), lienNextStepDaysWords(null)]).toEqual(['4 days late', '1 day late', 'today', '1 day left', '12 days left', ''])
  })
})
