/**
 * The calls behind a hours statement's signing (punch list #212, PR 3): `hours-statement-signing` (prepare the form,
 * file a signed scan), `send-contract-for-signature` (the email, or the link alone), `open-contract-form-pdf` (the
 * signed PDF through its gate), and the one row update that moves a statement to sent. One interface, so the window's
 * smoke hands it a fake; one implementation on the app's client.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { HoursStatementRecordRow } from './hoursStatementsIo'
import type { HoursStatementChannel } from './hoursStatementSigning'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export type PreparedSigning = {
  documentId: string
  documentStatus: string
  recordId: string
  documentName: string
  worker: { name: string; email: string | null; phone: string | null }
}

export type SendResult = { acceptUrl: string; emailed: boolean; emailError: string | null }

export type ScanFiling = {
  statementId: string
  scan: { base64: string; mime: string; filename: string }
  signedOnYmd: string
  signerPrintedName: string
  statedDays: Array<{ day: string; hours: string | null; note: string }>
}

export interface HoursStatementSigningIo {
  /** Draw the statement as its form and write (or refresh) its copy; the worker's contact comes back for the channels. */
  prepare(statementId: string, how: HoursStatementChannel): Promise<PreparedSigning>
  /** Mint the signing link: emailed for `email`, handed back alone for the other channels. */
  send(documentId: string, args: { channel: HoursStatementChannel; email: string | null }): Promise<SendResult>
  /** Move the statement to sent once its link is out. */
  markSent(statementId: string): Promise<HoursStatementRecordRow>
  /** The paper path: file the scan and the days the office keyed; the statement reads signed. */
  fileScan(filing: ScanFiling): Promise<{ documentId: string }>
  /** A short-lived link to the signed PDF, through `open-contract-form-pdf`'s gate; the open is logged. */
  openSignedPdf(documentId: string, which?: 'pdf' | 'scan'): Promise<string>
}

async function jwt(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not signed in.')
  return token
}

async function callFunction<T>(name: string, body: unknown): Promise<T & { error?: string }> {
  const res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await jwt()}`, apikey: anonKey },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as T & { error?: string; ok?: boolean }
  if (!res.ok || json.ok === false) throw new Error(json.error || `${name} answered ${res.status}`)
  return json
}

const STATEMENTS = 'hours_statements' as never
// Every column, as hoursStatementsIo reads them, so a column a pending migration adds is absent before the push instead of refusing the read.
const COLUMNS = '*, worker:users!hours_statements_user_id_fkey(name), prepared_by_user:users!hours_statements_prepared_by_fkey(name), job:jobs_ledger!hours_statements_job_ledger_id_fkey(hcp_number, click_number, job_name)'

export const supabaseHoursStatementSigningIo: HoursStatementSigningIo = {
  async prepare(statementId, how) {
    const j = await callFunction<{ document_id: string; document_status: string; record_id: string; document_name: string; worker: { name: string; email: string | null; phone: string | null } }>('hours-statement-signing', { action: 'prepare', statement_id: statementId, how })
    return { documentId: j.document_id, documentStatus: j.document_status, recordId: j.record_id, documentName: j.document_name, worker: j.worker }
  },
  async send(documentId, args) {
    const body: Record<string, unknown> = { person_contract_document_id: documentId, public_origin: typeof window !== 'undefined' ? window.location.origin : undefined }
    if (args.channel === 'email') body.signer_email = (args.email ?? '').trim()
    else body.mode = 'link'
    const j = await callFunction<{ accept_url?: string; emailed?: boolean; email_error?: string; warning?: string }>('send-contract-for-signature', body)
    if (!j.accept_url) throw new Error('The signing link did not come back.')
    return { acceptUrl: j.accept_url, emailed: j.emailed === true, emailError: j.email_error ?? j.warning ?? null }
  },
  async markSent(statementId) {
    const row = await withSupabaseRetry(() => supabase.from(STATEMENTS).update({ state: 'sent', updated_at: new Date().toISOString() } as never).eq('id', statementId).select(COLUMNS).single(), 'mark the statement sent')
    return row as unknown as HoursStatementRecordRow
  },
  async fileScan(filing) {
    const j = await callFunction<{ document_id: string }>('hours-statement-signing', {
      action: 'file_scan',
      statement_id: filing.statementId,
      scan: filing.scan,
      signed_on_ymd: filing.signedOnYmd,
      signer_printed_name: filing.signerPrintedName,
      attested: true,
      stated_days: filing.statedDays,
    })
    return { documentId: j.document_id }
  },
  async openSignedPdf(documentId, which = 'pdf') {
    const j = await callFunction<{ url?: string }>('open-contract-form-pdf', { person_contract_document_id: documentId, which })
    if (!j.url) throw new Error('Could not open the PDF.')
    return j.url
  },
}

/** A file as a base64 string, for the scan the paper path posts. */
export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      resolve(result.replace(/^data:[^;]+;base64,/i, ''))
    }
    reader.onerror = () => reject(reader.error ?? new Error('The file could not be read.'))
    reader.readAsDataURL(file)
  })
}
