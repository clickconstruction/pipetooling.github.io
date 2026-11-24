/**
 * The Signed contract window's words about what a reader is answered (punch list #403, the owner's second decision of
 * 2026-11-22). The window makes three reads past the paper's own row: the form's layout, which names each answer, the
 * signature's image, and the signed file. The office's four roles are answered the first two. So is an estimator on
 * an outside company's paper, since `20261123184149_estimator_reach.sql`. So a layout or an image that does not come
 * back is a failure the window says in words, where before it was a rule for an estimator.
 *
 * The signed file has its own gate (`open-contract-form-pdf`, `_shared/contractFormPdfGate.ts`), and the window says
 * who it opens for.
 */

/** Under **Form answers**, when the layout did not come back: the answers cannot be named, and the PDF still holds them. */
export const SIGNED_RECORD_LAYOUT_DID_NOT_READ = 'The form’s layout did not read, so its answers are not listed here. The PDF holds them.'

/** Under **Signature**, when the image did not open. It says who it opens for, so a reader knows whether to try again. */
export const SIGNED_RECORD_SIGNATURE_DID_NOT_OPEN = 'The signature’s image did not open. It opens for the office, and for an estimator on an outside company’s paper.'

/** The foot of **Form answers**: where the sensitive answers are, and who opens the signed PDF. */
export const SIGNED_RECORD_PDF_RULE =
  'Sensitive answers are never stored on the row. Opening the signed PDF is limited to devs, controllers, and pay-approved masters, and each open is logged. An estimator opens an outside company’s. A training estimator opens none.'
