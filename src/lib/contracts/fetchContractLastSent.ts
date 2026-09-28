/**
 * The rows behind "last sent" on Settings → Contracts & terms (`contractLastSent.ts` decides
 * what they mean). Four small reads. Each stands alone: last sent is a second opinion on the
 * card, so a read that fails, or that the viewer's role may not make, leaves its cards without
 * the line and the tab otherwise whole.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { EMPTY_LAST_SENT, type BidRevisionSentRow, type ConsentSentRow, type ContractLastSentData, type EstimateSentRow, type JobContractSentRow } from './contractLastSent'

/** Newest first; enough to cover every live draft and agreement out for signature. */
const JOB_CONTRACT_LIMIT = 300

async function quiet<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read()
  } catch {
    return fallback
  }
}

export async function fetchContractLastSent(): Promise<ContractLastSentData> {
  const [jobContracts, bidRevision, estimate, consent] = await Promise.all([
    quiet(
      async () =>
        ((await withSupabaseRetry(
          () =>
            supabase
              .from('job_contracts')
              .select('id, status, body_html, body_format, template_document_id, template_version_date, last_sent_at, sent_at, signed_at, voided_at')
              .in('status', ['draft', 'sent', 'signed'])
              .is('voided_at', null)
              .order('updated_at', { ascending: false })
              .limit(JOB_CONTRACT_LIMIT),
          'contracts tab: agreements sent',
        )) ?? []) as JobContractSentRow[],
      EMPTY_LAST_SENT.jobContracts as JobContractSentRow[],
    ),
    quiet(
      async () =>
        ((await withSupabaseRetry(
          () => supabase.from('bid_proposal_room_revisions').select('payload, published_at, rev_number').order('published_at', { ascending: false }).limit(1),
          'contracts tab: newest bid room revision',
        )) ?? [])[0] as BidRevisionSentRow | undefined,
      undefined,
    ),
    quiet(
      async () =>
        ((await withSupabaseRetry(
          () => supabase.from('estimates').select('terms_snapshot, customer_experience_sent, sent_at, estimate_number, title').eq('doc_kind', 'estimate').not('sent_at', 'is', null).order('sent_at', { ascending: false }).limit(1),
          'contracts tab: newest estimate sent',
        )) ?? [])[0] as EstimateSentRow | undefined,
      undefined,
    ),
    quiet(
      async () =>
        ((await withSupabaseRetry(
          () => supabase.from('esign_consents').select('clause_text, consent_version, lang, audience, document_noun, consented_at').in('audience', ['customer', 'gc']).order('consented_at', { ascending: false }).limit(1),
          'contracts tab: newest consent',
        )) ?? [])[0] as ConsentSentRow | undefined,
      undefined,
    ),
  ])
  return { jobContracts, bidRevision: bidRevision ?? null, estimate: estimate ?? null, consent: consent ?? null }
}
