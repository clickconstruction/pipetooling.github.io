/**
 * Electronic-signature consent ledger, server side (v2.3100). The signing
 * functions (accept-estimate, accept-contract, sign-job-contract,
 * sign-bid-room, submit-sub-portal) receive the exact consent words the client
 * rendered (`esignConsent` on the body — see src/lib/esignConsent.ts) and
 * store them on `esign_consents` after the signature row commits. Best-effort
 * on purpose: the signed row's consented_at / ip / ua stay the record of the
 * act; this row is the record of the words. A client older than v2.3100 sends
 * no consent, and the signature still lands.
 *
 * Statutes: 15 U.S.C. § 7001 (ESIGN); Tex. Bus. & Com. Code ch. 322 (UETA).
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type EsignConsentInput = {
  version: number
  lang: 'en' | 'es'
  audience: 'customer' | 'sub' | 'gc'
  documentNoun: string
  clauseText: string
}

export type EsignConsentRecordType = 'estimate' | 'job_contract' | 'person_contract_document' | 'step_commitment' | 'bid_proposal_room'

const MAX_CLAUSE = 4000

/** Parse `body.esignConsent`; null when absent or malformed (never throws). */
export function parseEsignConsent(raw: unknown): EsignConsentInput | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const version = typeof r.version === 'number' && Number.isInteger(r.version) && r.version >= 1 ? r.version : null
  const lang = r.lang === 'es' ? 'es' : r.lang === 'en' ? 'en' : null
  const audience = r.audience === 'customer' || r.audience === 'sub' || r.audience === 'gc' ? r.audience : null
  const documentNoun = typeof r.documentNoun === 'string' ? r.documentNoun.trim().slice(0, 200) : ''
  const clauseText = typeof r.clauseText === 'string' ? r.clauseText.trim() : ''
  if (version == null || !lang || !audience || !clauseText || clauseText.length > MAX_CLAUSE) return null
  return { version, lang, audience, documentNoun, clauseText }
}

export type RecordEsignConsentArgs = {
  recordType: EsignConsentRecordType
  recordId: string
  consent: EsignConsentInput | null
  printedName: string | null
  method: 'type' | 'draw' | 'in_person'
  consentedAt: string
  ip: string | null
  userAgent: string | null
}

/** Insert the ledger row. Logs and returns false on failure; never throws. */
export async function recordEsignConsent(admin: SupabaseClient, args: RecordEsignConsentArgs): Promise<boolean> {
  if (!args.consent) return false
  const { error } = await admin.from('esign_consents').insert({
    record_type: args.recordType,
    record_id: args.recordId,
    consent_version: args.consent.version,
    lang: args.consent.lang,
    audience: args.consent.audience,
    document_noun: args.consent.documentNoun,
    clause_text: args.consent.clauseText,
    printed_name: args.printedName,
    method: args.method,
    consented_at: args.consentedAt,
    ip: args.ip,
    user_agent: args.userAgent,
  })
  if (error) {
    console.error('esign_consents insert failed', args.recordType, args.recordId, error)
    return false
  }
  return true
}
