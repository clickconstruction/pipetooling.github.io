import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { ownerRecordsSignedWaiting, type OwnerRecordsSigned, type OwnerRecordsSignedRow } from '../lib/jobs/ownerRecords'

const db = supabase as unknown as SupabaseClient

/**
 * The office's "<owner> signed for the records on <address>" line (punch list #86): open
 * owner-records requests the owner signed on their portal. The table is read by the office set
 * that works the Lien desk (RLS: dev, assistant, master), so the hosts pass that audience.
 * Refetches on focus; a failed read shows no line.
 */
export function useOwnerRecordsSignedNudge(enabled: boolean): { signed: OwnerRecordsSigned | null; reload: () => void } {
  const [signed, setSigned] = useState<OwnerRecordsSigned | null>(null)
  const load = useCallback(async () => {
    if (!enabled) {
      setSigned(null)
      return
    }
    try {
      const rows = await withSupabaseRetry<OwnerRecordsSignedRow[]>(
        () => db.from('lien_owner_record_requests').select('id, seed_job_id, job_ids, property_address, file').is('sent_at', null).order('updated_at', { ascending: false }).limit(200),
        'owner records: signed on the portal',
      )
      setSigned(ownerRecordsSignedWaiting(rows ?? []))
    } catch {
      setSigned(null)
    }
  }, [enabled])
  useEffect(() => {
    void load()
    if (!enabled) return
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [enabled, load])
  return { signed, reload: () => void load() }
}
