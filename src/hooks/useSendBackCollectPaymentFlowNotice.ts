import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { paragraphForSendBackCollectPaymentFlow } from '../lib/collectPaymentFlowSendBackNotice'
import { withSupabaseRetry } from '../utils/errorHandling'

type SendBackJobLike = { id: string; toStatus: 'working' | 'ready_to_bill' } | null

/** Loads `job_collect_payment_flows.status` when the send-back modal targets Working; returns a notice paragraph or null. */
export function useSendBackCollectPaymentFlowNotice(sendBackJob: SendBackJobLike): string | null {
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!sendBackJob || sendBackJob.toStatus !== 'working') {
      setNotice(null)
      return
    }
    const jobId = sendBackJob.id
    let cancelled = false
    void (async () => {
      try {
        const row = await withSupabaseRetry(
          async () =>
            supabase.from('job_collect_payment_flows').select('status').eq('job_id', jobId).maybeSingle(),
          'send back modal job_collect_payment_flows status',
        )
        if (cancelled) return
        const st =
          row && typeof row === 'object' && 'status' in row && typeof (row as { status: unknown }).status === 'string'
            ? (row as { status: string }).status
            : null
        setNotice(paragraphForSendBackCollectPaymentFlow(st))
      } catch {
        if (!cancelled) setNotice(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sendBackJob?.id, sendBackJob?.toStatus])

  return notice
}
