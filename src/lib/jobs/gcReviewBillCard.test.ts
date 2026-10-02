import { describe, expect, it } from 'vitest'
import { gcReviewBillCardWords } from './gcReviewBillCard'

const row = (over: Partial<Parameters<typeof gcReviewBillCardWords>[0]> = {}) => ({
  hcp: '650',
  jobName: 'ATI Schertz — As per plans',
  customerName: 'ATI Schertz',
  referenceDateDisplay: 'Jul 15, 2026',
  ageDays: 79 as number | null,
  ...over,
})

describe('gcReviewBillCardWords', () => {
  it('names the job by number and name, the link a card opens', () => {
    expect(gcReviewBillCardWords(row()).job).toBe('650 · ATI Schertz — As per plans')
    expect(gcReviewBillCardWords(row({ jobName: '' })).job).toBe('650')
  })

  it('Loberg’s 650: the job’s name already holds the customer, so the line says only when', () => {
    expect(gcReviewBillCardWords(row()).when).toBe('Billed Jul 15, 2026 · 79 d')
  })

  it('leads with the customer when the job’s name does not say it', () => {
    const w = gcReviewBillCardWords(row({ hcp: '1059', jobName: 'Seaver Pretest', customerName: 'Tyler Seaver', referenceDateDisplay: 'Sep 30, 2026', ageDays: 1 }))
    expect(w.when).toBe('Tyler Seaver · billed Sep 30, 2026 · 1 d')
  })

  it('matches the customer in the name whatever the case, and skips a job with no customer', () => {
    expect(gcReviewBillCardWords(row({ jobName: 'Michael Palmer (ivan kopecky)', customerName: 'Ivan Kopecky' })).when).toBe('Billed Jul 15, 2026 · 79 d')
    expect(gcReviewBillCardWords(row({ jobName: 'Michael Palmer- Jacob Roberts', customerName: '—' })).when).toBe('Billed Jul 15, 2026 · 79 d')
  })

  it('keeps an estimated date’s mark, and leaves the age off a date still ahead', () => {
    expect(gcReviewBillCardWords(row({ referenceDateDisplay: 'Jul 15, 2026 (est.)' })).when).toBe('Billed Jul 15, 2026 (est.) · 79 d')
    expect(gcReviewBillCardWords(row({ referenceDateDisplay: 'Oct 9, 2026', ageDays: null })).when).toBe('Billed Oct 9, 2026')
  })

  it('says so when the bill has no date, instead of "Billed —"', () => {
    expect(gcReviewBillCardWords(row({ referenceDateDisplay: '—', ageDays: null })).when).toBe('No bill date')
    expect(gcReviewBillCardWords(row({ jobName: 'Seaver Pretest', customerName: 'Tyler Seaver', referenceDateDisplay: '—', ageDays: null })).when).toBe('Tyler Seaver · no bill date')
  })
})
