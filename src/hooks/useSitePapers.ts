import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PARTY_PAPER_SELECT } from '../lib/contracts/partyPapersIo'
import type { PartyPaperRow } from '../lib/contracts/partyPapers'
import type { PlaceAnswer } from '../lib/addresses/lookAlikes'
import { siteKeysToRead, type SiteJob } from '../lib/addresses/sitePapers'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../lib/offlineRecoveryState'
import { readAnswers } from './useAddressLookAlikes'

/**
 * The papers of a job's site (punch list #439, piece 3): the read behind the section on a job's Documents tab. The
 * answers kept in Addresses that look alike come first, so two spellings of one place read as one site. Then the
 * papers that name one of the site's keys, and the ones that name the job's development. Each table's own row security
 * answers: the office reads every paper, an estimator an outside company's, and the crew their own.
 */
const SELECT = `${PARTY_PAPER_SELECT}, party_name`
const MOST = 500

export type SitePapersRead = { rows: PartyPaperRow[] | null; answers: PlaceAnswer[]; failure: OfflineRecoveryLastError | null; reading: boolean; retry: () => void }

/** One read. Throws with the reason. The answers are a help: without them the job's own spelling still reads. */
export async function readSitePapers(job: SiteJob): Promise<{ rows: PartyPaperRow[]; answers: PlaceAnswer[] }> {
  const answers = await readAnswers().catch(() => [] as PlaceAnswer[])
  const keys = siteKeysToRead(job, answers)
  const byKey = keys.length > 0 ? supabase.from('person_contract_documents').select(SELECT).in('site_address_key', keys).not('party_contact_id', 'is', null).limit(MOST) : null
  const byDevelopment = job.development_id ? supabase.from('person_contract_documents').select(SELECT).eq('site_development_id', job.development_id).not('party_contact_id', 'is', null).limit(MOST) : null
  const [a, b] = await Promise.all([byKey, byDevelopment])
  if (a?.error) throw a.error
  if (b?.error) throw b.error
  return { rows: [...((a?.data ?? []) as unknown as PartyPaperRow[]), ...((b?.data ?? []) as unknown as PartyPaperRow[])], answers }
}

/** The read for a job, once `enabled`. A job with no address and no development has no site, and nothing is asked. */
export function useSitePapers(job: SiteJob, enabled: boolean): SitePapersRead {
  const address = job.job_address
  const developmentId = job.development_id
  const [rows, setRows] = useState<PartyPaperRow[] | null>(null)
  const [answers, setAnswers] = useState<PlaceAnswer[]>([])
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [reading, setReading] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled || (!(address ?? '').trim() && !developmentId)) {
      setRows(null)
      return
    }
    let live = true
    setReading(true)
    setFailure(null)
    readSitePapers({ job_address: address, development_id: developmentId }).then(
      (read) => {
        if (!live) return
        setRows(read.rows)
        setAnswers(read.answers)
        setReading(false)
      },
      (e: unknown) => {
        if (!live) return
        setFailure(recoveryFailureFromError(e, 'Couldn’t read the papers for this site'))
        setReading(false)
      },
    )
    return () => {
      live = false
    }
  }, [enabled, address, developmentId, attempt])
  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { rows, answers, failure, reading, retry }
}
