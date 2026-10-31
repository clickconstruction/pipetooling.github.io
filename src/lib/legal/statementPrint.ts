/**
 * The printed statement (punch list #220, v2.6211): the paper's HTML, the PDF's name, the text a print keeps on the
 * row, and whether the declaration still waits on the declarant's details. Pure, over `affidavitPaper.ts` and the
 * lien papers' renderers, so an affidavit from the desk prints as the Lien desk's papers do.
 *
 * The paper draws inside the window on a light sheet and prints from that sheet on every device (one path, no popup
 * for Safari to block); the sheet is `LegalStatementPrintSheet.tsx`.
 */
import { filingDocPdfBlob, filingDocPrintHtml } from '../jobsDocuments/lienFilingDocuments'
import { attachedToLine, declarantProblem, statementPaperBlocks, statementPrintTitle, statementPrintedText, type DeclarantDetails, type StatementDraft, type StatementFace } from './affidavitPaper'

/**
 * The declaration's block names the declarant: the whole paper and the signing page wait on the details and on a full
 * name of two words or more (v2.6243); the statement alone does not.
 */
export function printNeedsDeclarant(draft: Pick<StatementDraft, 'form' | 'affiant'>, face: StatementFace, details: DeclarantDetails | null): boolean {
  if (draft.form !== 'declaration' || face === 'statement') return false
  return !details || declarantProblem(details, draft.affiant.name) !== null
}

/** The paper's footer: the title, the account, and which face it is when not the whole. */
export function statementPrintFooter(draft: Pick<StatementDraft, 'title' | 'form'>, face: StatementFace, accountWords: string): string {
  const t = statementPrintTitle(draft, face)
  return accountWords ? `${t} · ${accountWords}` : t
}

/** The whole page for the sheet's frame and the print. */
export function statementPrintHtml(input: { draft: StatementDraft; face: StatementFace; declarant: DeclarantDetails | null; accountWords: string }): string {
  const blocks = statementPaperBlocks({ draft: input.draft, face: input.face, declarant: input.declarant })
  return filingDocPrintHtml(blocks, statementPrintTitle(input.draft, input.face), statementPrintFooter(input.draft, input.face, input.accountWords))
}

/** The same page as a PDF, for Save as PDF. */
export function statementPdfBlob(input: { draft: StatementDraft; face: StatementFace; declarant: DeclarantDetails | null; accountWords: string }): Promise<Blob> {
  const blocks = statementPaperBlocks({ draft: input.draft, face: input.face, declarant: input.declarant })
  return filingDocPdfBlob(blocks, { footer: statementPrintFooter(input.draft, input.face, input.accountWords) })
}

/** *affidavit-of-daniel-alvarez.pdf* · *jurat-affidavit-of-daniel-alvarez.pdf*. */
export function statementPdfFilename(draft: Pick<StatementDraft, 'title' | 'form'>, face: StatementFace): string {
  const slug = statementPrintTitle(draft, face).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `${slug || 'statement'}.pdf`
}

/** What a print keeps on the row: the paragraphs as printed, or the line the signing page carries. */
export function statementPrintRecordText(draft: StatementDraft, face: StatementFace): string {
  return face === 'signing' ? attachedToLine(draft.form, draft.affiant.name) : statementPrintedText(draft)
}
