import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  suggestDevelopmentByAddress,
  type DevelopmentAddressSuggestion,
  type DevelopmentMember,
  type DevelopmentNameRow,
} from '../lib/developments/notInIt'

/** The members read: every bid and job that is in a development, with the address the match reads. */
async function loadDevelopmentMembers(): Promise<DevelopmentMember[]> {
  const [bidsRes, jobsRes] = await Promise.all([
    supabase.from('bids').select('id, address, development_id').not('development_id', 'is', null).limit(2000),
    supabase.from('jobs_ledger').select('id, job_address, development_id').not('development_id', 'is', null).limit(2000),
  ])
  const bids = ((bidsRes.data ?? []) as unknown as Array<{ id: string; address: string | null; development_id: string | null }>).map(
    (b): DevelopmentMember => ({ kind: 'bid', id: b.id, address: b.address, developmentId: b.development_id }),
  )
  const jobs = ((jobsRes.data ?? []) as unknown as Array<{ id: string; job_address: string | null; development_id: string | null }>).map(
    (j): DevelopmentMember => ({ kind: 'job', id: j.id, address: j.job_address, developmentId: j.development_id }),
  )
  return [...bids, ...jobs]
}

/**
 * The suggestion by address on Edit Bid and Edit Job (punch list #208, v2.6019): a saved record
 * with no development, whose address other members of one development share, gets one line,
 * *4 bids and 6 jobs at this address are in Harlow Ranch*, with **Put it in Harlow Ranch**. The
 * members (every bid and job that is in a development, with its address) load once each time
 * the form opens on a record with no development and an address; a read a role cannot make (an
 * estimator reads no jobs) comes back empty and the suggestion counts what it can see. The match
 * itself is `suggestDevelopmentByAddress`, pure, so the Development page's own line (PR 3)
 * reads the same rule.
 */
export function useDevelopmentAddressSuggestion(args: {
  /** The form is open on a saved record. */
  enabled: boolean
  address: string
  developmentId: string | null
  /** The record itself, never counted among the members. */
  self: { kind: 'bid' | 'job'; id: string } | null
  developments: readonly DevelopmentNameRow[]
}): DevelopmentAddressSuggestion | null {
  const wanted = args.enabled && !args.developmentId && args.address.trim() !== ''
  const [members, setMembers] = useState<DevelopmentMember[] | null>(null)

  useEffect(() => {
    if (!args.enabled) {
      setMembers(null)
      return
    }
    if (!wanted || members !== null) return
    let cancelled = false
    void loadDevelopmentMembers()
      .then((rows) => {
        if (!cancelled) setMembers(rows)
      })
      .catch(() => {
        if (!cancelled) setMembers([])
      })
    return () => {
      cancelled = true
    }
  }, [args.enabled, wanted, members])

  return useMemo(() => {
    if (!wanted || !members) return null
    return suggestDevelopmentByAddress({
      address: args.address,
      developmentId: args.developmentId,
      selfId: args.self?.id ?? null,
      members,
      developments: args.developments,
    })
  }, [wanted, members, args.address, args.developmentId, args.self?.id, args.developments])
}
