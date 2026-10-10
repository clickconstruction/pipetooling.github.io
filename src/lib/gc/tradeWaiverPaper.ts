import { buildLienWaiverFoot, buildLienWaiverParagraphs, lienWaiverTitle, type LienWaiverFields, type LienWaiverFoot, type LienWaiverFormType } from '../jobsDocuments/lienWaiverRelease'
import type { Draw, GcProject } from './types'

/**
 * GC mode, the trade partner portal (P5c-3b, to-dos/gc-mode/mockups/portal-p5.md): the unconditional waiver a trade signs
 * on a draw we paid, as the app's own paper. Its words are the Release of Lien window's, the owner-drafted forms on Texas
 * Property Code § 53.284 (`lienWaiverRelease.ts`), never new ones: the progress form on a draw, the final form on the final
 * draw. This fills the form from the draw: the company releasing, what we paid it (the draw's net), the job, the day its
 * pay application ran through on a progress waiver, and the signer the company types. Pure, so its test holds it.
 */
export interface TradeWaiverPaper {
  formType: LienWaiverFormType
  title: string
  paragraphs: string[]
  foot: LienWaiverFoot
}

export function tradeWaiverPaper(draw: Draw, project: Pick<GcProject, 'name' | 'address'>, company: string, signerName: string, today: string): TradeWaiverPaper {
  const formType: LienWaiverFormType = draw.final ? 'unconditional_final' : 'unconditional_progress'
  const fields: LienWaiverFields = {
    companyName: company,
    checkFrom: '',
    amount: String(draw.net),
    projectDescription: [project.name, project.address]
      .map((s) => s.trim())
      .filter((s) => s !== '')
      .join(', '),
    throughDate: draw.payApp?.periodTo || draw.requestedOn,
    signedDate: today,
    signerName,
    signerTitle: '',
  }
  return { formType, title: lienWaiverTitle(formType), paragraphs: buildLienWaiverParagraphs(formType, fields), foot: buildLienWaiverFoot(fields, null) }
}
