import { describe, expect, it } from 'vitest'
import { lienCodeUsedPush } from './lienApprovalPush'
import { plainWordsFailures } from '../plainWords'

describe('the push when his signing code signs a notice on someone else’s screen (v2.5791)', () => {
  it('one line: the job, the money, the day, whose screen; the tap lands on the notice in Ready', () => {
    const p = lienCodeUsedPush({ jobLabel: '804 · Summit GC- Auto Zone', jobId: 'j-804', claim: 9006, signedYmd: '2026-10-23', deviceName: 'Robert Douglas' })
    expect(p.title).toBe('Your signing code signed a lien notice')
    expect(p.body).toBe('804 · Summit GC- Auto Zone · $9,006 · signed Oct 23 · on Robert’s screen')
    expect(p.url).toBe('/jobs?tab=stages&liendesk=1&liendeskPile=ready&liendeskJob=j-804')
    expect(p.tag).toBe('lien-code-j-804')
    expect(p.emailText).toContain('Your signing code was typed on Robert’s screen to sign a lien notice.')
    expect(p.emailText).toContain('If that was not you, change your code under Settings, Your account.')
    for (const line of p.emailText.split('\n').filter((l) => /[a-z]{3}/i.test(l) && !/^\d/.test(l))) expect(plainWordsFailures(line), line).toEqual([])
    expect(lienCodeUsedPush({ jobLabel: 'J', jobId: 'j', claim: null, signedYmd: null, deviceName: null }).body).toBe('J · on the office’s screen')
  })
})
