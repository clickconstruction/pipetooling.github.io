/**
 * Who may open a signed form's PDF or its paper scan (`open-contract-form-pdf`). That file is the one place a form's
 * whole answers live, a tax number among them, so the function says who its caller may be itself and writes with the
 * service role only after. Pure: the handler reads the facts and asks here.
 *
 * - A dev and the controller open every signed form.
 * - A leader opens every signed form but a signed hours statement, once they are pay-approved.
 * - An estimator opens a signed form whose paper is with an outside company, a signed W-9 among them (punch list #403,
 *   the owner's calls 10 and 11 of 2026-11-20). The database says which papers those are: `estimator_reads_paper`,
 *   the same rule the estimator's read policy follows. A digital twin reads as an estimator and opens none.
 * - An estimator in training opens none either (punch list #403, the owner's second decision of 2026-11-22): a
 *   training account reads the line and is refused the signed file. The other openers are as they were.
 * - Everyone else is refused, an assistant among them, who reads the row and not the file.
 * - A signed hours statement is payroll data and opens for a dev and the controller alone (the call of 2026-11-02).
 */

/** The caller's account row, as far as the gate reads it. */
export interface FormPdfCaller {
  role?: string | null
  is_digital_twin?: boolean | null
  /** Training mode (`users.read_only`). */
  read_only?: boolean | null
}

/** A refusal, in the words the caller reads. */
export interface FormPdfRefusal {
  status: number
  error: string
  code: 'forbidden'
}

/**
 * What the caller is to the gate, from their account row alone: `always` opens every signed form, `master` needs the
 * pay-approved list, `estimator` needs the paper to be an outside company's, and `none` is refused whatever the paper.
 */
export type FormPdfOpener = 'always' | 'master' | 'estimator' | 'none'

export const FORM_PDF_REFUSALS = {
  role: 'Only a dev, controller, or pay-approved master can open a signed form.',
  twin: 'A digital twin cannot open a signed form.',
  hoursStatement: 'A signed hours statement opens for a dev or the controller alone.',
  estimator: 'An estimator opens a signed form of an outside company, and no other.',
  training: 'A training account does not open a signed form.',
} as const

const refuse = (error: string): FormPdfRefusal => ({ status: 403, error, code: 'forbidden' })

/** What the caller is to the gate. A twin is `none` whatever its role says, and so is an estimator in training. */
export function formPdfOpener(caller: FormPdfCaller | null | undefined): FormPdfOpener {
  const role = caller?.role ?? ''
  if (role === 'dev' || role === 'controller') return 'always'
  if (role === 'master_technician') return 'master'
  if (role === 'estimator' && !caller?.is_digital_twin && !caller?.read_only) return 'estimator'
  return 'none'
}

/** The facts the handler reads before it opens a file. Each is asked only for the opener it matters to. */
export interface FormPdfFacts {
  /** A leader is on the pay-approved list. */
  payApprovedMaster?: boolean
  /** The paper is a signed hours statement's copy. */
  hoursStatement?: boolean
  /** The database's answer for an estimator: the paper is with an outside company (`estimator_reads_paper`). */
  estimatorReads?: boolean
}

/**
 * The refusal, or null when the file may open. An estimator's refusal says the same thing whether the paper is a
 * person's or is not there, so it tells them nothing about a paper they cannot read.
 */
export function formPdfRefusal(caller: FormPdfCaller | null | undefined, facts: FormPdfFacts): FormPdfRefusal | null {
  const opener = formPdfOpener(caller)
  if (opener === 'always') return null
  if (opener === 'none') {
    if (caller?.role !== 'estimator') return refuse(FORM_PDF_REFUSALS.role)
    // An estimator the gate turned away before it asked about the paper: a twin first, then a training account.
    return refuse(caller.is_digital_twin ? FORM_PDF_REFUSALS.twin : caller.read_only ? FORM_PDF_REFUSALS.training : FORM_PDF_REFUSALS.role)
  }
  if (opener === 'master') {
    if (!facts.payApprovedMaster) return refuse(FORM_PDF_REFUSALS.role)
    return facts.hoursStatement ? refuse(FORM_PDF_REFUSALS.hoursStatement) : null
  }
  // An estimator: only a paper the database says is an outside company's, and never a signed hours statement. The
  // paper's own refusal comes first, so a paper they cannot read is never named as a statement.
  if (facts.estimatorReads !== true) return refuse(FORM_PDF_REFUSALS.estimator)
  return facts.hoursStatement ? refuse(FORM_PDF_REFUSALS.hoursStatement) : null
}
