/**
 * The sheets a trade partner's own page shows (punch list #404, step 5): each job's published sheet that was sent to
 * the company and is still on its page. Read as the service role by `gc-trade-portal`, for the company its link names
 * and no other. A sheet shows as published, never as a draft, and a send taken off the page shows nothing.
 */
import { sheetLinkCodeFor } from './documentBuilderLinkCode.ts'
import type { TradePageSheet } from './documentBuilderSend.ts'

// deno-lint-ignore no-explicit-any
type Admin = any

export async function tradePageSheets(admin: Admin, companyId: string): Promise<TradePageSheet[]> {
  const { data: sendRows, error } = await admin.from('document_builder_sends').select('sheet_id, builder_key, opened_revision').eq('company_id', companyId).is('taken_off_at', null).not('sheet_id', 'is', null)
  if (error) throw new Error(`the sheets sent: ${error.message}`)
  const sends = (sendRows ?? []) as Array<{ sheet_id: string; builder_key: string; opened_revision: number | null }>
  if (sends.length === 0) return []
  const { data: sheetRows, error: sheetError } = await admin.from('document_builder_sheets').select('id, builder_key, project_id, revision, published_sheet').in('id', sends.map((s) => s.sheet_id))
  if (sheetError) throw new Error(`the sheets: ${sheetError.message}`)
  const sheets = ((sheetRows ?? []) as Array<{ id: string; builder_key: string; project_id: string; revision: number; published_sheet: unknown }>).filter((s) => s.revision >= 1 && s.published_sheet)
  if (sheets.length === 0) return []
  const { data: projectRows } = await admin.from('projects').select('id, name').in('id', sheets.map((s) => s.project_id))
  const jobName = new Map(((projectRows ?? []) as Array<{ id: string; name: string | null }>).map((p) => [p.id, String(p.name ?? '')]))
  const out: TradePageSheet[] = []
  for (const sheet of sheets) {
    const send = sends.find((s) => s.sheet_id === sheet.id)
    // A sheet's link is handed on only while it is on. It is never made from a trade's page.
    const linkCode = await sheetLinkCodeFor(admin, sheet.builder_key, sheet.id, null, { mintIfNone: false })
    const openedRevision = send?.opened_revision ?? null
    out.push({ sheetId: sheet.id, projectId: sheet.project_id, job: jobName.get(sheet.project_id) ?? '', revision: sheet.revision, sheet: sheet.published_sheet, linkCode, opened: openedRevision === sheet.revision, changed: openedRevision != null && openedRevision < sheet.revision })
  }
  return out.sort((a, b) => a.job.localeCompare(b.job))
}

/** The same, and an empty list when the read fails: a page that cannot read its sheets still draws everything else. */
export async function tradePageSheetsOrNone(admin: Admin, companyId: string): Promise<TradePageSheet[]> {
  try {
    return await tradePageSheets(admin, companyId)
  } catch (e) {
    console.error('document builder sheets', e)
    return []
  }
}
