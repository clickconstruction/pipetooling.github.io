/**
 * The reads and writes of the Document builder's certificate check (punch list #404, step 6): a company's
 * certificates, the two presses, and the email that tells a company what its certificate did not show. A dev alone
 * may mark one good or send one back: the database's own functions say so. Browser io, not pure; the rules are
 * `certificates.ts`.
 *
 * The columns and the two functions are younger than the generated types, so the client is cast once here.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { gcTradeEmailRefusal } from '../gc/tradeEmail'
import { sendGcTradeEmail } from '../gc/tradeEmailIo'
import { certificateBackEmail, type CertRow } from './certificates'
import type { Landed } from './documentBuildersIo'

const db = supabase as unknown as SupabaseClient

const SELECT = 'id, company_id, status, expires_at, sent_at, created_at, url, sheet_project_id, sheet_revision, sheet_asks, sheet_checked_at, sheet_sent_back_at, sheet_missing'

type Row = {
  id: string
  company_id: string
  status: string
  expires_at: string | null
  sent_at: string | null
  created_at: string
  url: string | null
  sheet_project_id: string | null
  sheet_revision: number | null
  sheet_asks: string[] | null
  sheet_checked_at: string | null
  sheet_sent_back_at: string | null
  sheet_missing: string[] | null
}

export function certRowFromRow(r: Row): CertRow {
  return {
    id: r.id,
    companyId: r.company_id,
    status: r.status,
    expiresOn: r.expires_at,
    sentAt: r.sent_at,
    sentOn: r.sent_at ? calendarYmdInAppTzFromIso(r.sent_at) : null,
    createdAt: r.created_at,
    url: r.url,
    sheetProjectId: r.sheet_project_id,
    sheetRevision: r.sheet_revision,
    sheetAsks: r.sheet_asks,
    checkedAt: r.sheet_checked_at,
    sentBackAt: r.sheet_sent_back_at,
    sentBackOn: r.sheet_sent_back_at ? calendarYmdInAppTzFromIso(r.sheet_sent_back_at) : null,
    missing: r.sheet_missing,
  }
}

/** Every certificate these companies hold, the newest first. Throws with the reason. */
export async function readCertificates(companyIds: ReadonlyArray<string>): Promise<CertRow[]> {
  if (companyIds.length === 0) return []
  const rows = (await withSupabaseRetry<unknown[]>(
    () => db.from('person_contract_documents').select(SELECT).eq('doc_type', 'coi').in('company_id', [...companyIds]).order('created_at', { ascending: false }),
    'read the certificates',
  )) as Row[] | null
  return (rows ?? []).map(certRowFromRow)
}

/** Mark a certificate good against a job's published sheet: the lines ticked, and the day it is good until. */
export async function markCertificateGood(ask: { paperId: string; sheetId: string; asks: string[]; goodUntil: string }): Promise<Landed<true>> {
  try {
    const { error } = await db.rpc('document_builder_coi_mark_good', { p_paper_id: ask.paperId, p_sheet_id: ask.sheetId, p_asks: ask.asks, p_good_until: ask.goodUntil })
    if (error) return { ok: false, error: formatErrorMessage(error, 'It was not marked good.') }
    return { ok: true, value: true }
  } catch (e) {
    return { ok: false, error: formatErrorMessage(e, 'It was not marked good.') }
  }
}

/**
 * Send a certificate back: keep the lines it did not show, then email the company those lines. The record is the
 * send-back. An email that does not go leaves the record standing, and the answer says the email did not go.
 */
export async function sendCertificateBack(ask: { paperId: string; sheetId: string; projectId: string; companyId: string; job: string; missing: string[] }): Promise<Landed<{ emailed: boolean; emailWords: string }>> {
  try {
    const { error } = await db.rpc('document_builder_coi_send_back', { p_paper_id: ask.paperId, p_sheet_id: ask.sheetId, p_missing: ask.missing })
    if (error) return { ok: false, error: formatErrorMessage(error, 'It was not sent back.') }
  } catch (e) {
    return { ok: false, error: formatErrorMessage(e, 'It was not sent back.') }
  }
  const email = certificateBackEmail(ask.job, ask.missing)
  const sent = await sendGcTradeEmail({ companyId: ask.companyId, kind: 'coi', key: `${ask.paperId}:coi-back:${Date.now()}`, projectId: ask.projectId, lang: 'en', subject: email.subject, lines: email.lines })
  if (sent.ok) return { ok: true, value: { emailed: true, emailWords: '' } }
  return { ok: true, value: { emailed: false, emailWords: `It is marked as sent back. The email to them did not go. ${gcTradeEmailRefusal(sent.key)}` } }
}
