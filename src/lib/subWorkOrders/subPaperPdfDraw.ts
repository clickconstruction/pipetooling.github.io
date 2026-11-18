/**
 * One sub paper drawn as a PDF in the browser (punch list #350, shared with the sub's own page for #371): the three
 * builders of `_shared/subPapersPdf.ts` over pdf-lib, loaded only when a paper is made. The office's window and the
 * sub's Statements view both call it, so the two draw one paper.
 */
import type { PdfLibLike } from '../../../supabase/functions/_shared/jobContractPdf'
import type { StatementRange } from '../../../supabase/functions/_shared/subPapers'
import { buildPaymentRecordPdf, buildStatementOfAccountPdf, buildWorkStatementPdf } from '../../../supabase/functions/_shared/subPapersPdf'
import type { SubPaper } from './subPaperSend'

export async function drawSubPaperPdf(paper: SubPaper, range: StatementRange): Promise<Blob> {
  const lib = (await import('pdf-lib')) as unknown as PdfLibLike
  const bytes = paper.kind === 'statement_of_account' ? await buildStatementOfAccountPdf(lib, paper, range) : paper.kind === 'work_statement' ? await buildWorkStatementPdf(lib, paper) : await buildPaymentRecordPdf(lib, paper)
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}
