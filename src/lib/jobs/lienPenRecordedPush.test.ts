import { describe, expect, it } from 'vitest'
import { lienPenRecordedPush, lienPenRecordedUrl } from './lienApprovalPush'

describe('the push when the office records a pen signature (the pen train, PR 3)', () => {
  it('one line: who wrote it down, the job, the money, the day, how they know; the tap lands on the notice in Ready', () => {
    const p = lienPenRecordedPush({ jobLabel: '878 · Take 5 - Seguin', jobId: 'j-878', claim: 38625, signedYmd: '2026-10-09', recorderName: 'Taunya Lee', how: 'watched' })
    expect(p.title).toBe('Taunya recorded your pen signature')
    expect(p.body).toBe('878 · Take 5 - Seguin · $38,625 · signed Oct 9 · Taunya watched you sign')
    expect(p.url).toBe('/jobs?tab=stages&liendesk=1&liendeskPile=ready&liendeskJob=j-878')
    expect(p.tag).toBe('lien-pen-j-878')
    expect(p.subject).toBe('Taunya recorded your pen signature · 878 · Take 5 - Seguin')
    expect(p.emailText).toContain('Open the Lien desk and press Yes, I signed it, or Not what I signed. Nothing waits on your answer.')
    expect(lienPenRecordedUrl('a b')).toBe('/jobs?tab=stages&liendesk=1&liendeskPile=ready&liendeskJob=a%20b')
  })

  it('the three ways, and the office by name or not', () => {
    expect(lienPenRecordedPush({ jobLabel: 'J', jobId: 'j', claim: null, signedYmd: null, recorderName: null, how: 'told' }).body).toBe('J · The office says you told them')
    expect(lienPenRecordedPush({ jobLabel: 'J', jobId: 'j', claim: 0, signedYmd: 'nope', recorderName: 'Dana', how: 'page' }).body).toBe('J · Dana has the signed page')
    expect(lienPenRecordedPush({ jobLabel: 'J', jobId: 'j', claim: null, signedYmd: null, recorderName: null, how: null }).title).toBe('The office recorded your pen signature')
  })
})
