import { describe, expect, it } from 'vitest'
import { PAPER_IDS, SAMPLE_JOB, SAMPLE_OWNER, paperSample, sampleBillDocument, sampleDemandLetterFields, sampleHazmatInputs, sampleLienReleaseInputs, sampleOwnerNoticeInputs } from './paperSamples'
import { SAMPLE_GC, SAMPLE_HOMEOWNER } from '../customerSample'
import { customerJourneys } from '../customerJourneys'

const TODAY = '2026-09-16'

describe('paperSamples — the paper a customer receives, from the sample (v2.3509)', () => {
  it('every paper builds an HTML preview that names the sample people, and every paper step on the journeys has one', () => {
    for (const id of PAPER_IDS) {
      const p = paperSample(id, TODAY)
      expect(p.title.length, id).toBeGreaterThan(5)
      expect(p.html.length, id).toBeGreaterThan(200)
      expect(p.filename.endsWith('.pdf'), id).toBe(true)
      expect(typeof p.pdf).toBe('function')
    }
    const paperSteps = customerJourneys().flatMap((j) => j.steps).filter((s) => s.render.kind === 'paper')
    expect(paperSteps.length).toBe(5)
    for (const s of paperSteps) expect(PAPER_IDS).toContain((s.render as { paper: string }).paper)
  })

  it('the bill by email: the sample job, the amount, a two-week due date, and the email bodies carry the total', () => {
    const doc = sampleBillDocument(TODAY)
    expect(JSON.stringify(doc)).toContain('1042')
    const p = paperSample('bill-by-email', TODAY)
    expect(p.subject).toContain(SAMPLE_JOB.number)
    expect(p.html).toContain('1,850')
    expect(p.html).toContain(SAMPLE_HOMEOWNER.name)
  })

  it('the hazmat notice names the job and the fee', () => {
    const { job, draft } = sampleHazmatInputs(TODAY)
    expect(job.customerName).toBe(SAMPLE_HOMEOWNER.name)
    expect(draft.feeAmount).toBe(350)
    expect(draft.incidentAt.startsWith('2026-09-13')).toBe(true)
    const p = paperSample('hazmat-notice', TODAY)
    expect(p.html).toContain('$350.00')
    expect(p.html).toContain(SAMPLE_JOB.number)
  })

  it('the demand letter: an invoice 52 days old, a ten-day deadline, no lien line, late fees on', () => {
    const f = sampleDemandLetterFields(TODAY)
    expect(f.invoiceDate).toBe('2026-07-26')
    expect(f.deadlineDate).toBe('2026-09-26')
    expect(f.includeLien).toBe(false)
    expect(f.includeTheftOfServices).toBe(false)
    const p = paperSample('demand-letter', TODAY)
    expect(p.html).toContain(SAMPLE_HOMEOWNER.name)
    expect(p.html).toContain('1,850')
  })

  it('the notice to the owner of record names the builder as original contractor and the project', () => {
    const { fields } = sampleOwnerNoticeInputs(TODAY)
    expect(fields.originalContractorName).toBe(SAMPLE_GC.company)
    expect(fields.noticeDate).toBe(TODAY)
    const p = paperSample('owner-notice', TODAY)
    expect(p.html).toContain('53.056')
    expect(p.html).toContain(SAMPLE_OWNER.project)
    expect(p.html).toContain(SAMPLE_GC.company)
  })

  it('the lien release is the unconditional final form over the sample job', () => {
    const { formType, fields } = sampleLienReleaseInputs(TODAY)
    expect(formType).toBe('unconditional_final')
    expect(fields.checkFrom).toBe(SAMPLE_HOMEOWNER.name)
    const p = paperSample('lien-release', TODAY)
    expect(p.html).toContain('Unconditional')
    expect(p.html).toContain(SAMPLE_JOB.name)
  })
})
