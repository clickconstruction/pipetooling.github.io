/**
 * The edge functions' copy of the lien waiver forms (`_shared/lienWaiverWords.ts`, P5a-2) reads word for word as the
 * Release of Lien window's (`src/lib/jobsDocuments/lienWaiverRelease.ts`): the title, the paragraphs, the foot, the money,
 * the date and the statute line, for each of the four forms.
 */
import { describe, expect, it } from 'vitest'
import * as copy from '../../../supabase/functions/_shared/lienWaiverWords'
import * as window from '../jobsDocuments/lienWaiverRelease'

const FORMS = ['conditional_progress', 'unconditional_progress', 'conditional_final', 'unconditional_final'] as const
const FIELDS: window.LienWaiverFields[] = [
  { companyName: 'Bright Line Electric', checkFrom: 'Click Construction', amount: '13122', projectDescription: 'Sample Dental Office, 3 Sample Ln', throughDate: '2026-09-24', signedDate: '2026-10-10', signerName: 'Dana Ortiz', signerTitle: 'Owner' },
  { companyName: '', checkFrom: '', amount: '', projectDescription: '', throughDate: '', signedDate: '', signerName: '', signerTitle: '' },
  { companyName: 'Iron Horse', checkFrom: ' ', amount: '$2,200.50', projectDescription: 'Clinic', throughDate: '10/05/2026', signedDate: 'not a day', signerName: ' Ray ', signerTitle: '' },
]

describe('the functions’ copy of the lien waiver forms (P5a-2)', () => {
  it('reads as the Release of Lien window for each form', () => {
    for (const form of FORMS) {
      expect(copy.lienWaiverTitle(form), form).toBe(window.lienWaiverTitle(form))
      for (const f of FIELDS) expect(copy.buildLienWaiverParagraphs(form, f), `${form} ${f.companyName}`).toEqual(window.buildLienWaiverParagraphs(form, f))
    }
  })

  it('signs the same foot, and reads money, days and the statute line the same', () => {
    for (const f of FIELDS) {
      expect(copy.buildLienWaiverFoot(f, null)).toEqual(window.buildLienWaiverFoot(f, null))
      expect(copy.buildLienWaiverFoot(f, { printedName: 'Dana Ortiz', signedYmd: '2026-10-10' })).toEqual(window.buildLienWaiverFoot(f, { printedName: 'Dana Ortiz', signedYmd: '2026-10-10' }))
    }
    for (const m of ['2200', '$2,200.50', '', 'abc', '0']) expect(copy.lienWaiverMoney(m)).toBe(window.lienWaiverMoney(m))
    for (const d of ['2026-10-10', '', 'soon']) expect(copy.lienWaiverDate(d)).toBe(window.lienWaiverDate(d))
    expect(copy.LIEN_WAIVER_ESIGN_LINE).toBe(window.LIEN_WAIVER_ESIGN_LINE)
  })
})
