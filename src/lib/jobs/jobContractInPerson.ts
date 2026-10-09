/**
 * Hand the phone to the customer (the Contract window train, PR 5, v2.4159): the technician who is
 * clocked in on a job has the customer in front of them, so Job Mode's card offers one tap that
 * opens the job's agreement on this phone, in person — the same signing page the office's
 * Contract window opens with *Sign here, now*. It reuses the job's live agreement (a draft gets
 * the Book's current wording first; a sent one keeps its link), mints a fresh one from the job's
 * own facts when there is none, and never sends an email. Pure helpers here; one async door.
 */
import { supabase } from '../supabase'
import { fetchJobWithDetailsById } from '../fetchJobWithDetailsById'
import { normalizeEstimateLineItemsFromJson } from '../estimateLineItemNormalize'
import { buildJobContractPrefill } from './jobContractDocument'
import { buildJobContractDraftPayload, refreshJobContractDraftTerms, saveJobContractDraft } from './jobContractDraftWrite'
import type { QuickSendTemplate } from './jobContractQuickSend'
import { jobContractLinkOnRow, type JobContractRow } from './jobContractLifecycle'

/** Who may put our agreement in front of a customer at the job: the roles that speak for the company on site. */
export const HAND_PHONE_ROLES: ReadonlySet<string> = new Set(['dev', 'master_technician', 'primary', 'superintendent', 'estimator'])

export function canHandThePhone(role: string | null | undefined): boolean {
  return Boolean(role) && HAND_PHONE_ROLES.has(role as string)
}

/** The signing link with the in-person flag the page reads (`?inperson=1`), whatever the link already carries. */
export function inPersonSigningUrl(signUrl: string): string {
  try {
    const u = new URL(signUrl)
    u.searchParams.set('inperson', '1')
    return u.toString()
  } catch {
    return signUrl.includes('?') ? `${signUrl}&inperson=1` : `${signUrl}?inperson=1`
  }
}

export type HandPhoneState = 'signed' | 'sent' | 'draft' | 'none'

/** What the job's contract rows say: a signed one hides the door; a live one is reused. */
export function handPhoneState(rows: ReadonlyArray<Pick<JobContractRow, 'status' | 'voided_at'>>): HandPhoneState {
  const live = rows.filter((r) => !r.voided_at)
  if (live.some((r) => r.status === 'signed')) return 'signed'
  if (live.some((r) => r.status === 'sent')) return 'sent'
  if (live.some((r) => r.status === 'draft')) return 'draft'
  return 'none'
}

/** The door's label and title, by state. */
export function handPhoneDoorText(state: HandPhoneState): { label: string; title: string } | null {
  if (state === 'signed') return null
  if (state === 'sent') return { label: 'Hand the phone to the customer to sign', title: 'Their agreement is already out — this opens it here, in person, on the same link' }
  return { label: 'Hand the phone to the customer to sign', title: "Opens this job's agreement on this phone for the customer to read and sign in person — nothing is emailed" }
}

/** Leave for the signing page on this phone (same tab — the customer takes the phone from here). */
export function goToSigningPage(url: string): void {
  window.location.assign(url)
}

export type OpenInPersonResult = { ok: true; url: string } | { ok: false; error: string }

/**
 * Open the job's agreement in person: reuse the live row (a draft takes the Book's current wording
 * first), or mint a draft from the job's own facts, then ask send-job-contract for the link only
 * (`mode: 'link'` — nothing is emailed) and add the in-person flag. A sent row with a live link
 * hands out its own and calls nothing (v2.5119).
 */
export async function openInPersonSigning(input: { jobId: string; authUserId: string | null; origin: string }): Promise<OpenInPersonResult> {
  try {
    const job = await fetchJobWithDetailsById(input.jobId)
    if (!job) return { ok: false, error: 'Could not load the job.' }
    const { data: rowsData } = await supabase.from('job_contracts').select('*').eq('job_id', job.id).is('voided_at', null).order('created_at', { ascending: false })
    const rows = (rowsData ?? []) as JobContractRow[]
    if (rows.some((r) => r.status === 'signed')) return { ok: false, error: 'This job’s agreement is already signed.' }
    const { data: tpl } = await supabase.from('contract_template_documents').select('id, document_name, book_body_html, book_body_format, book_version_date').eq('audience', 'customer').order('document_name').limit(1).maybeSingle()
    const template = (tpl ?? null) as QuickSendTemplate
    let row = rows.find((r) => r.status === 'sent') ?? rows.find((r) => r.status === 'draft') ?? null
    if (row && row.status === 'draft') {
      row = await refreshJobContractDraftTerms({ existing: row, template })
    } else if (!row) {
      let estimateLines: { line_item: string; description: string; quantity: number }[] = []
      let acceptedTotal: number | null = null
      try {
        const { data: est } = await supabase.from('estimates').select('line_items_snapshot, total_cents').eq('job_ledger_id', job.id).eq('status', 'customer_accepted').limit(1).maybeSingle()
        if (est) {
          estimateLines = normalizeEstimateLineItemsFromJson((est as { line_items_snapshot: unknown }).line_items_snapshot).map((l) => ({ line_item: l.line_item, description: l.description, quantity: l.quantity }))
          acceptedTotal = (est as { total_cents: number }).total_cents
        }
      } catch {
        /* the job's own facts will do */
      }
      const fields = buildJobContractPrefill({ job, estimateLines, acceptedTotalCents: acceptedTotal })
      row = await saveJobContractDraft({
        existing: null,
        payload: buildJobContractDraftPayload({ jobId: job.id, fields, template, recipientName: (job.customer_name ?? '').trim(), recipientEmail: (job.customer_email ?? '').trim(), recipientPhone: job.customer_phone ?? null }),
        authUserId: input.authUserId,
      })
    }
    if (!row) return { ok: false, error: 'Could not prepare the agreement.' }
    // v2.5119 (punch list #104): a sent row hands out the link it already carries and records nothing,
    // so a PDF emailed to sign stays a PDF send. A draft, or a link near its end, still goes through the send.
    const own = jobContractLinkOnRow(row, input.origin)
    if (own) return { ok: true, url: inPersonSigningUrl(own) }
    const { data, error } = await supabase.functions.invoke('send-job-contract', {
      body: { contract_id: row.id, mode: 'link', recipient_email: row.recipient_email ?? '', recipient_name: row.recipient_name ?? '', public_origin: input.origin },
    })
    const res = (data ?? {}) as { ok?: boolean; sign_url?: string; error?: string }
    if (error || !res.ok || !res.sign_url) return { ok: false, error: res.error || error?.message || 'Could not open the agreement.' }
    return { ok: true, url: inPersonSigningUrl(res.sign_url) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not open the agreement.' }
  }
}
