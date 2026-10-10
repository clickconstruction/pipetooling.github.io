import { buildLienWaiverFoot, buildLienWaiverParagraphs, lienWaiverTitle, type LienWaiverFields, type LienWaiverFoot, type LienWaiverFormType } from '../jobsDocuments/lienWaiverRelease'
import { GC_COMPANY_NAME } from './building'
import type { Draw, GcProject } from './types'

/**
 * GC mode, the trade partner portal (P5c-3b, to-dos/gc-mode/mockups/portal-p5.md): the lien waivers a trade signs, as the
 * app's own paper. Their words are the Release of Lien window's, the owner-drafted forms on Texas Property Code § 53.284
 * (`lienWaiverRelease.ts`), never new ones. The unconditional waiver on a draw we paid (P5c-3b): the progress form, or
 * the final form on the final draw. The conditional waiver a pay application signs (P5c-3c-ii): the progress form, or
 * the final form on the final pay application, on our check for what it asks. Each is filled from the draw or the draft:
 * the company releasing, the amount, the job, the day a progress waiver runs through, and the signer the company types.
 * Pure, so its test holds it.
 */
export interface TradeWaiverPaper {
  formType: LienWaiverFormType
  title: string
  paragraphs: string[]
  foot: LienWaiverFoot
}

function paperOf(
  formType: LienWaiverFormType,
  fill: { amount: number; through: string; checkFrom: string },
  project: Pick<GcProject, 'name' | 'address'>,
  company: string,
  signerName: string,
  today: string,
): TradeWaiverPaper {
  const fields: LienWaiverFields = {
    companyName: company,
    checkFrom: fill.checkFrom,
    amount: String(fill.amount),
    projectDescription: [project.name, project.address]
      .map((s) => s.trim())
      .filter((s) => s !== '')
      .join(', '),
    throughDate: fill.through,
    signedDate: today,
    signerName,
    signerTitle: '',
  }
  return { formType, title: lienWaiverTitle(formType), paragraphs: buildLienWaiverParagraphs(formType, fields), foot: buildLienWaiverFoot(fields, null) }
}

/** The unconditional waiver on a draw we paid: what we paid it (the draw's net), through the day its pay application ran to. */
export function tradeWaiverPaper(draw: Draw, project: Pick<GcProject, 'name' | 'address'>, company: string, signerName: string, today: string): TradeWaiverPaper {
  const formType: LienWaiverFormType = draw.final ? 'unconditional_final' : 'unconditional_progress'
  return paperOf(formType, { amount: draw.net, through: draw.payApp?.periodTo || draw.requestedOn, checkFrom: '' }, project, company, signerName, today)
}

/**
 * The conditional waiver a pay application signs, before the draw is made: on our check for what it asks (the G702's
 * current payment due), through the last day it covers; the final form on the final one.
 */
export function tradePayAppWaiverPaper(
  app: { final: boolean; amount: number; periodTo: string },
  project: Pick<GcProject, 'name' | 'address'>,
  company: string,
  signerName: string,
  today: string,
): TradeWaiverPaper {
  const formType: LienWaiverFormType = app.final ? 'conditional_final' : 'conditional_progress'
  return paperOf(formType, { amount: app.amount, through: app.periodTo, checkFrom: GC_COMPANY_NAME }, project, company, signerName, today)
}
