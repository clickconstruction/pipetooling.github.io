/**
 * The lien waiver forms' words for the edge functions, a copy of the Release of Lien window's
 * (`src/lib/jobsDocuments/lienWaiverRelease.ts`): the owner-drafted forms on Texas Property Code § 53.284, their titles,
 * their paragraphs, the foot a signer signs on, and the e-sign statute line. The functions cannot import `src`, so
 * `src/lib/gc/lienWaiverWords.test.ts` holds this copy equal to the window's for each form. Copied for the trade
 * portal's signed waiver PDF (P5a-2, to-dos/gc-mode/mockups/portal-p5a.md); never edit one without the other.
 */

export type LienWaiverFormType = 'conditional_progress' | 'unconditional_progress' | 'conditional_final' | 'unconditional_final'

export function lienWaiverTitle(formType: LienWaiverFormType): string {
  switch (formType) {
    case 'conditional_progress':
      return 'Conditional Waiver and Release on Progress Payment'
    case 'unconditional_progress':
      return 'Unconditional Waiver and Release on Progress Payment'
    case 'conditional_final':
      return 'Conditional Waiver and Release on Final Payment'
    case 'unconditional_final':
      return 'Unconditional Waiver and Release on Final Payment'
    default: {
      const _e: never = formType
      return _e
    }
  }
}

export type LienWaiverFields = {
  /** Contractor / releasing party (signature block + body). */
  companyName: string
  /** Owner / payor the check comes from (conditional form only). */
  checkFrom: string
  /** Payment amount — raw user string; formatted for display via lienWaiverMoney. */
  amount: string
  /** Project name + address as one description line. */
  projectDescription: string
  /** YYYY-MM-DD — progress payments covered through (progress forms only). */
  throughDate: string
  /** YYYY-MM-DD — the date on the signature block. */
  signedDate: string
  signerName: string
  signerTitle: string
}

/** "$2,200.00" from "2200", "2,200.00", "$2200" — unparseable input passes through. */
export function lienWaiverMoney(input: string): string {
  const cleaned = (input ?? '').replace(/[$,\s]/g, '')
  if (!cleaned) return '$—'
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return input
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

/** "August 29, 2026" from "2026-08-29" — anything else passes through ('' → '—'). */
export function lienWaiverDate(ymd: string): string {
  const d = (ymd ?? '').trim()
  if (!d) return '—'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
  const parsed = new Date(d + 'T00:00:00')
  if (Number.isNaN(parsed.getTime())) return d
  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

/**
 * The document body, one string per paragraph — the owner-drafted language
 * (2026-09-01 doc), values interpolated. Signature block is separate.
 */
export function buildLienWaiverParagraphs(formType: LienWaiverFormType, f: LienWaiverFields): string[] {
  const amount = lienWaiverMoney(f.amount)
  const company = f.companyName.trim() || '—'
  const project = f.projectDescription.trim() || '—'
  const through = lienWaiverDate(f.throughDate)
  switch (formType) {
    case 'conditional_progress':
      return [
        `Upon receipt by the undersigned of a check from ${f.checkFrom.trim() || '—'} in the sum of ${amount} payable to ${company} and when the check has been properly endorsed and has cleared the bank, this document shall become effective to waive and release any lien, stop payment notice, or bond right the undersigned has on the project described as:`,
        `${project}, to the following extent:`,
        `This release covers progress payments through: ${through}, only and does not cover any retentions, unpaid changes, or items furnished after that date.`,
        `This release is conditional upon actual receipt and clearance of the above payment.`,
      ]
    case 'unconditional_progress':
      return [
        `The undersigned has been paid and has received progress payment(s) totaling ${amount} for all labor, services, equipment, or materials furnished to the property located at:`,
        `${project}, through ${through}, and does hereby waive and release any right to file a mechanic's lien, stop notice, or claim on any bond for that portion of the work.`,
        `This release does not affect any retainage, pending change orders, or disputed claims for extra work.`,
      ]
    case 'conditional_final':
      return [
        `Upon receipt by the undersigned of a check from ${f.checkFrom.trim() || '—'} in the sum of ${amount} payable to ${company} and when the check has been properly endorsed and has cleared the bank, this document shall become effective to waive and release any lien, stop payment notice, or bond right the undersigned has on the project described as:`,
        `${project}.`,
        `This is the final payment. Upon its clearance the undersigned waives, releases, and discharges any and all rights to a mechanic's lien, stop payment notice, or claim against a payment bond related to this project, for all work, labor, materials, and services provided through the date below.`,
        `This release is conditional upon actual receipt and clearance of the above payment, and does not cover disputed claims for extra work listed in writing before signing.`,
      ]
    case 'unconditional_final':
      return [
        `The undersigned has been paid in full for all work, labor, materials, and services provided on the project located at:`,
        `${project}.`,
        `In consideration of this final payment of ${amount}, the undersigned hereby fully and unconditionally waives, releases, and discharges any and all rights to a mechanic's lien, stop payment notice, or claim against a payment bond related to this project.`,
        `This release covers all amounts due through the date below and confirms all contractual obligations are satisfied.`,
      ]
    default: {
      const _e: never = formType
      return _e
    }
  }
}

/**
 * The foot of the page (v2.4285): one signature block in place of the Date / Contractor / By /
 * Title label stack. Under the rule, the signer of record and the company on one line —
 * "Malachi Whites, Click Plumbing and Electrical" — his title when one is set (never a blank
 * line), and the day he signed. Unsigned, the rule waits for ink and the date is a blank.
 */
export type LienWaiverFoot = {
  /** The signer of record — the signature's printed name once signed, else the window's Signed by. */
  name: string
  company: string
  /** "Owner · Responsible Master Plumber"; null leaves the line out. */
  title: string | null
  /** "Signed September 30, 2026"; null before signing. */
  signed: string | null
}

export function buildLienWaiverFoot(f: LienWaiverFields, signature?: { printedName: string; signedYmd?: string | null } | null): LienWaiverFoot {
  const name = (signature?.printedName ?? '').trim() || f.signerName.trim() || '—'
  const title = f.signerTitle.trim()
  const signedYmd = signature ? (signature.signedYmd ?? '').trim() || f.signedDate.trim() : ''
  return {
    name,
    company: f.companyName.trim() || '—',
    title: title || null,
    signed: signature ? `Signed ${lienWaiverDate(signedYmd)}` : null,
  }
}

/** The second grey line under every signed rendering (v2.4285) — the two statutes, once, a shade lighter. */
export const LIEN_WAIVER_ESIGN_LINE = 'Binding as a signature in ink under the ESIGN Act (15 U.S.C. § 7001) and the Texas UETA (Bus. & Com. Code ch. 322).'
