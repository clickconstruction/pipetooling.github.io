/**
 * The trade's unconditional waiver as the app's own paper (P5c-3b): the Release of Lien window's forms, filled from the
 * draw, never new words.
 */
import { describe, expect, it } from 'vitest'
import { buildLienWaiverParagraphs, lienWaiverTitle } from '../jobsDocuments/lienWaiverRelease'
import { tradeWaiverPaper } from './tradeWaiverPaper'
import type { Draw } from './types'

const draw = (change: Partial<Draw> = {}): Draw => ({
  id: 'd1',
  number: 1,
  requestedOn: '2026-09-24',
  gross: 14580,
  retainage: 1458,
  net: 13122,
  status: 'paid',
  waiver: 'conditional',
  lines: [],
  payApp: { periodTo: '2026-09-20', address: '400 Sample St', license: 'TECL 00000', signedBy: 'Dana Ortiz', signedTitle: 'Owner', signedOn: '2026-09-24' },
  ...change,
})
const job = { name: 'Sample Dental Office', address: '1200 Main St, Boerne' }

describe('the trade’s unconditional waiver on the app’s paper', () => {
  it('fills the progress form: the company, what we paid, the job and the day its pay application ran through', () => {
    const paper = tradeWaiverPaper(draw(), job, 'Bright Line Electric', 'Dana Ortiz', '2026-10-08')
    expect(paper.formType).toBe('unconditional_progress')
    expect(paper.title).toBe(lienWaiverTitle('unconditional_progress'))
    expect(paper.paragraphs).toEqual(
      buildLienWaiverParagraphs('unconditional_progress', {
        companyName: 'Bright Line Electric',
        checkFrom: '',
        amount: '13122',
        projectDescription: 'Sample Dental Office, 1200 Main St, Boerne',
        throughDate: '2026-09-20',
        signedDate: '2026-10-08',
        signerName: 'Dana Ortiz',
        signerTitle: '',
      }),
    )
    expect(paper.paragraphs[0]).toContain('$13,122.00')
    expect(paper.paragraphs[1]).toContain('Sample Dental Office, 1200 Main St, Boerne')
    expect(paper.foot).toEqual({ name: 'Dana Ortiz', company: 'Bright Line Electric', title: null, signed: null })
  })

  it('reads the day it asked when its pay application kept no period', () => {
    const paper = tradeWaiverPaper(draw({ payApp: undefined }), job, 'Bright Line Electric', '', '2026-10-08')
    expect(paper.paragraphs[1]).toContain('through September 24, 2026')
    expect(paper.foot.name).toBe('—')
  })

  it('fills the final form on the final draw, its amount the retainage we paid back', () => {
    const paper = tradeWaiverPaper(draw({ final: true, gross: 0, retainage: -4860, net: 4860 }), job, 'Bright Line Electric', 'Dana Ortiz', '2026-10-08')
    expect(paper.formType).toBe('unconditional_final')
    expect(paper.title).toBe('Unconditional Waiver and Release on Final Payment')
    expect(paper.paragraphs.join(' ')).toContain('final payment of $4,860.00')
  })
})
