/**
 * The consent ledger row behind a signed record (v2.3100) — version + language
 * for the signed-record facts line, and the exact clause text for a hover.
 * Office views only (RLS: office roles read); public signing pages never call
 * this. Best-effort: a missing row (signed before the ledger, or the anon
 * client) is `null`, and the block simply omits the version.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type EsignConsentRecordType = 'estimate' | 'job_contract' | 'person_contract_document' | 'step_commitment' | 'bid_proposal_room'

export type EsignConsentRow = {
  consent_version: number
  lang: string
  clause_text: string
  consented_at: string
}

export function useEsignConsent(recordType: EsignConsentRecordType | null, recordId: string | null | undefined): EsignConsentRow | null {
  const [row, setRow] = useState<EsignConsentRow | null>(null)
  useEffect(() => {
    let cancelled = false
    setRow(null)
    if (!recordType || !recordId) return
    void (async () => {
      const { data } = await supabase
        .from('esign_consents')
        .select('consent_version, lang, clause_text, consented_at')
        .eq('record_type', recordType)
        .eq('record_id', recordId)
        .order('consented_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!cancelled && data) setRow(data)
    })()
    return () => {
      cancelled = true
    }
  }, [recordType, recordId])
  return row
}
