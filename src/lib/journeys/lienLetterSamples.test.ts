/**
 * Settings → What customers see → Lien letters (punch list #326): one made-up unpaid job, and every letter on it drawn
 * by the builders the Lien desk and the Lien window send with.
 */
import { describe, expect, it } from 'vitest'
import { lienFilingEmailHtml } from '../../../supabase/functions/_shared/lienFilingEmail'
import { PORTAL_COMPANY } from '../../../supabase/functions/_shared/portalCompany'
import { SAMPLE_GC, ymdPlusDays } from '../customerSample'
import { buildSampleEmail } from '../customerSampleEmails'
import { noticeDeadlineForMonth } from '../jobs/lienDeadlines'
import { PAPER_IDS, paperSample } from './paperSamples'
import { sampleText } from './sampleTexts'
import { SAMPLE_LIEN_JOB, SAMPLE_OWNER, sampleCourtesyEmail, sampleCourtesyFacts, sampleCourtesyText, sampleLetterTwo, sampleLienAffidavit, sampleLienAffidavitFields, sampleLienCoverLetter, sampleLienDays, sampleOwnerNoticeInputs, sampleReleaseOfRecord, sampleRetainageNotice } from './lienLetterSamples'

const TODAY = '2026-11-12'

describe('the sample lien job’s days', () => {
  it('counts from today by the Lien desk’s own rules', () => {
    expect(sampleLienDays(TODAY)).toEqual({ month: '2026-08', noticeSentOn: '2026-10-22', letterTwoOn: '2026-11-01', lienDay: '2026-12-15', filedOn: '2026-12-08', serveBy: '2026-12-14', paidOn: '2026-12-29' })
  })

  it('stays in order on any day of the year: the notice inside its month’s window, the lien still ahead', () => {
    for (let i = 0; i < 400; i += 1) {
      const today = ymdPlusDays('2026-01-01', i)
      const d = sampleLienDays(today)
      expect(d.noticeSentOn <= noticeDeadlineForMonth(`${d.month}-01`, SAMPLE_LIEN_JOB.propertyKind), today).toBe(true)
      expect(d.noticeSentOn < d.letterTwoOn && d.letterTwoOn <= today, today).toBe(true)
      expect(today < d.filedOn && d.filedOn < d.lienDay && d.filedOn < d.serveBy && d.serveBy < d.paidOn, today).toBe(true)
    }
  })
})

describe('the lien letters, as papers', () => {
  it('every one builds, names the sample people, and leaves no blank of a letter unfilled', () => {
    for (const p of [sampleLienCoverLetter(TODAY), sampleLetterTwo('paid_out', TODAY), sampleLetterTwo('unresponsive', TODAY), sampleRetainageNotice(TODAY), sampleLienAffidavit(TODAY), sampleReleaseOfRecord(TODAY)]) {
      expect(p.html.length, p.title).toBeGreaterThan(400)
      expect(p.html, p.title).not.toMatch(/\{\{|\}\}/)
      expect(p.filename.endsWith('-sample.pdf'), p.title).toBe(true)
      expect(typeof p.pdf).toBe('function')
    }
    // The tab reaches each one by its paper id.
    for (const id of ['lien-cover-letter', 'lien-letter-paid-out', 'lien-letter-quiet', 'lien-affidavit', 'lien-release-of-record', 'lien-retainage'] as const) {
      expect(PAPER_IDS).toContain(id)
      expect(paperSample(id, TODAY).html.length, id).toBeGreaterThan(400)
    }
  })

  it('the cover letter is counsel’s, filled for the sample job: the property, the month, the claim and the three ways it ends', () => {
    const html = sampleLienCoverLetter(TODAY).html
    expect(html).toContain(`To the owner of ${SAMPLE_LIEN_JOB.address},`)
    expect(html).toContain('$12,400.00')
    expect(html).toContain('August 2026')
    expect(html).toContain(SAMPLE_GC.company)
    expect(html).toContain('We cannot deposit a joint check, so please do not send one.')
    expect(html).toContain(`Call our office at ${PORTAL_COMPANY.phone} before the next payment to ${SAMPLE_GC.company}.`)
    expect(html).toContain('Enclosed: Notice of claim for unpaid labor or materials (Tex. Prop. Code § 53.056), with invoices.')
    expect(html).toContain(`Re: ${SAMPLE_LIEN_JOB.number} · ${SAMPLE_LIEN_JOB.name}`)
  })

  it('the notice form names the month and the mailing day every other letter names', () => {
    const { fields, extras } = sampleOwnerNoticeInputs(TODAY)
    expect(fields.noticeDate).toBe('2026-10-22')
    // The three items a real notice's reference line carries. The PDF draws the line unwrapped, so it stays short.
    expect(extras.refItems).toEqual(['Job #1077', 'Work months August 2026', 'October 22, 2026'])
    const form = paperSample('owner-notice', TODAY).html
    expect(form).toContain('October 22, 2026')
    expect(form).toContain('August 2026')
    // Neither today's date nor a month of its own, which is how it disagreed with its cover letter until v2.7070.
    expect(form).not.toContain('November 12, 2026')
    expect(form).not.toContain('2026-09')
    expect(sampleLienCoverLetter(TODAY).html.toUpperCase()).toContain('AUGUST 2026')
    expect(sampleLienAffidavit(TODAY).html).toContain('October 22, 2026')
  })

  it('the attorney’s letter comes in counsel’s two kinds', () => {
    const paidOut = sampleLetterTwo('paid_out', TODAY).html
    expect(paidOut).toContain('We have reason to believe you may already have paid')
    expect(paidOut).toContain('15th day of the fourth month')
    const quiet = sampleLetterTwo('unresponsive', TODAY).html
    expect(quiet).toContain('has not responded to us')
    expect(quiet).not.toContain('We have reason to believe you may already have paid')
  })

  it('the affidavit is the short form on a job under a builder, and swears the notice the group mailed', () => {
    const f = sampleLienAffidavitFields(TODAY)
    expect([f.form, f.isSub, f.workMonthsWords, f.noticesSentWords]).toEqual(['short', true, 'August 2026', 'certified mail on October 22, 2026'])
    const html = sampleLienAffidavit(TODAY).html
    expect(html).toContain('Notice of the claim was sent to the owner by certified mail on October 22, 2026.')
    expect(html).toContain(SAMPLE_OWNER.name)
    expect(html).toContain(`${SAMPLE_LIEN_JOB.county} County`)
  })

  it('the release names the recording number and the day the claim was paid, and the retainage notice its own amount', () => {
    expect(sampleReleaseOfRecord(TODAY).html).toContain(SAMPLE_LIEN_JOB.recordingNumber)
    const retainage = sampleRetainageNotice(TODAY).html
    expect(retainage).toContain('53.057')
    expect(retainage).toContain('1,240.00')
  })
})

describe('the courtesy notice, by email and by text', () => {
  it('is the Lien desk’s own words in the lien email’s own frame, a copy for the owner and one for the builder', () => {
    const owner = sampleCourtesyEmail('owner', TODAY)
    expect(owner.subject).toBe(`A reminder on the notice we mailed Oct 22 · ${SAMPLE_LIEN_JOB.address}`)
    expect(owner.html).toBe(lienFilingEmailHtml(owner.text))
    expect(owner.text).toContain('That notice stands. This is a reminder, not a new notice. You did not hire us, and nothing here is billed to you.')
    expect(owner.text).toContain('by December 15, 2026')
    // The owner is never sent the pay page; the builder is.
    expect(owner.text).not.toContain('my.clickplumbing.com/pay/sample')
    const gc = sampleCourtesyEmail('original_contractor', TODAY)
    expect(gc.subject).toContain('Before we file: Cedar Bend Apartments, $12,400.00')
    expect(gc.text.startsWith('Pat,\n\nOn October 22, 2026 we mailed you and the owner of')).toBe(true)
    expect(gc.text).toContain('Pay it here: my.clickplumbing.com/pay/sample')
    // The tab builds both through the list every other sample email is on.
    const ctx = { rows: [], origin: 'https://app.example', todayYmd: TODAY, dateLabel: 'Nov 12, 2026', sender: null, testReportSettings: null }
    expect(buildSampleEmail('lien-courtesy-owner', ctx).html).toBe(owner.html)
    expect(buildSampleEmail('lien-courtesy-gc', ctx).subject).toBe(gc.subject)
  })

  it('the text is the same facts, short, from the company the notice names, with the opt-out line a first text carries', () => {
    expect(sampleCourtesyFacts(TODAY).claimantName).toBe(PORTAL_COMPANY.name)
    const owner = sampleText('text-lien-courtesy-owner', undefined, TODAY)
    expect(owner.from).toBe(`${PORTAL_COMPANY.name} · ${PORTAL_COMPANY.phone}`)
    expect(owner.to.startsWith(SAMPLE_OWNER.name)).toBe(true)
    expect(owner.bubbles).toHaveLength(1)
    expect(owner.bubbles[0]!.text.startsWith(sampleCourtesyText('owner', TODAY))).toBe(true)
    expect(owner.bubbles[0]!.text).toContain('Reply STOP to opt out.')
    const gc = sampleText('text-lien-courtesy-gc', undefined, TODAY)
    expect(gc.bubbles[0]!.text).toContain('Pay here: my.clickplumbing.com/pay/sample')
  })
})
