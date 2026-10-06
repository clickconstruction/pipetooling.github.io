import { describe, expect, it } from 'vitest'
import {
  conditionalReleaseParagraph,
  noticeReleaseEnclosureWords,
  noticeReleaseFields,
  noticeReleaseFormType,
  noticeReleaseFromRow,
  noticeReleaseLabel,
  noticeReleaseMoney,
  noticeReleasePageHtml,
  noticeReleaseThroughDate,
  type NoticeRelease,
} from './lienNoticeRelease'

describe('the conditional release enclosed with a notice (v2.4729)', () => {
  it('is the Final form when the claim is everything open on the job, Progress otherwise', () => {
    expect(noticeReleaseFormType(17585, 17585)).toBe('conditional_final')
    expect(noticeReleaseFormType(17585, 17585.004)).toBe('conditional_final')
    expect(noticeReleaseFormType(9800, 17585)).toBe('conditional_progress')
    // Nothing known about the job's bills: progress, the form that does not say it is the last payment.
    expect(noticeReleaseFormType(17585, 0)).toBe('conditional_progress')
  })

  it('covers progress payments through the last day of the last work month', () => {
    expect(noticeReleaseThroughDate(['2026-04', '2026-08', '2026-06'])).toBe('2026-08-31')
    expect(noticeReleaseThroughDate(['2026-02'])).toBe('2026-02-28')
    expect(noticeReleaseThroughDate(['2028-02'])).toBe('2028-02-29')
    expect(noticeReleaseThroughDate([])).toBe('')
    expect(noticeReleaseThroughDate(['junk'])).toBe('')
  })

  it('fills the form from the notice: the claimant releases, the GC is the check’s maker, the claim is the amount, the signature waits', () => {
    const f = noticeReleaseFields({ claimantName: 'Click Plumbing', gcName: 'RMC- Dudley Mason', jobName: 'Dudley (Lennox)', jobAddress: '1021 Lennox Hill, San Antonio, TX', claim: '17585.00', months: ['2026-07', '2026-08'], signerName: 'Robert Douglas', signerTitle: 'Owner · Responsible Master Plumber' })
    expect(f).toEqual({
      companyName: 'Click Plumbing',
      checkFrom: 'RMC- Dudley Mason',
      amount: '17585.00',
      projectDescription: 'Dudley (Lennox), 1021 Lennox Hill, San Antonio, TX',
      throughDate: '2026-08-31',
      signedDate: '',
      signerName: 'Robert Douglas',
      signerTitle: 'Owner · Responsible Master Plumber',
    })
    expect(noticeReleaseFields({ claimantName: ' Click ', gcName: '', jobName: null, jobAddress: '', claim: '$1,050.00', months: [], signerName: 'R' }).checkFrom).toBe('the original contractor')
    expect(noticeReleaseMoney('$17,585.00')).toBe(17585)
    expect(noticeReleaseMoney('nope')).toBe(0)
  })

  it('says the paragraph in Stephen’s words, with the letter’s own figure', () => {
    expect(conditionalReleaseParagraph('$15,722.49')).toBe(
      'A conditional release of lien is enclosed. This release is not effective today. It becomes effective only after $15,722.49 is received and the funds have cleared. Until then, the notice stands.',
    )
    expect(noticeReleaseEnclosureWords(null)).toBe('')
    expect(noticeReleaseLabel('17585')).toBe('Conditional release of lien · $17,585.00')
  })

  it('reads a row back as the run carries it, and refuses an unconditional one', () => {
    const row = { id: 'rel-1', form_type: 'conditional_progress', amount: 17585, through_date: '2026-08-31', fields: { companyName: 'Click Plumbing', checkFrom: 'RMC- Dudley Mason', amount: '17585.00', projectDescription: 'Dudley (Lennox), 1021 Lennox Hill', throughDate: '2026-08-31', signedDate: '', signerName: 'Robert Douglas', signerTitle: '' } }
    const r = noticeReleaseFromRow(row, null)!
    expect(r.id).toBe('rel-1')
    expect(r.formType).toBe('conditional_progress')
    expect(r.fields.checkFrom).toBe('RMC- Dudley Mason')
    expect(r.amount).toBe(17585)
    expect(noticeReleaseEnclosureWords(r)).toBe(', and a conditional release of lien')
    expect(noticeReleaseFromRow({ ...row, form_type: 'unconditional_progress' }, null)).toBeNull()
    // A row with no snapshot still reads: the amount and the through date come from their columns.
    expect(noticeReleaseFromRow({ ...row, fields: null }, null)!.fields).toMatchObject({ amount: '17585', throughDate: '2026-08-31' })
  })

  it('prints the page as the Release of Lien window would: the letterhead, the statutory form, a line to sign', () => {
    const r: NoticeRelease = {
      id: 'rel-1',
      formType: 'conditional_progress',
      amount: 17585,
      signature: null,
      fields: { companyName: 'Click Plumbing', checkFrom: 'RMC- Dudley Mason', amount: '17585.00', projectDescription: 'Dudley (Lennox), 1021 Lennox Hill', throughDate: '2026-08-31', signedDate: '', signerName: 'Robert Douglas', signerTitle: '' },
    }
    const html = noticeReleasePageHtml(r, { letterhead: { company: 'Click Plumbing', licenseLine: 'M-12345', contactLines: ['Bulverde, TX', '(512) 360-0599'] } })
    expect(html).toContain('Conditional Waiver and Release on Progress Payment')
    expect(html).toContain('a check from RMC- Dudley Mason in the sum of $17,585.00 payable to Click Plumbing')
    expect(html).toContain('through: August 31, 2026')
    expect(html).toContain('Signed ______________________')
    expect(html).toContain('Bulverde, TX')
    expect(html).not.toContain('<html')
    // Signed in the app: the name under the rule, no blank.
    const signed = noticeReleasePageHtml({ ...r, signature: { mode: 'type', printedName: 'Robert Douglas', auditLine: 'Signed by Robert Douglas', signedYmd: '2026-10-06' } })
    expect(signed).toContain('Signed by Robert Douglas')
    expect(signed).not.toContain('Signed ______________________')
  })
})
