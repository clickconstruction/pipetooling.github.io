import { useEffect, useMemo } from 'react'
import { flowNowOf, type FlowNow } from '../lib/flows/now'
import { useFlowPerson } from './useFlowPerson'

/**
 * Where one person is on their flow, for a screen beside the thread (Messages cut 4, read by cut 3's quick replies and
 * Find a reply): `undefined` while it reads, null when nothing is on now. It shares its read with the side's flow
 * panel, and reads again after any press there.
 */
export function useFlowNow(contactId: string | null): FlowNow | null | undefined {
  const { got } = useFlowPerson({ contactId })
  return useMemo(() => (got.state === 'loading' ? undefined : got.state === 'ready' ? flowNowOf(got.person) : null), [got])
}

type StepAsk = { contactId: string; stepId: string; jobId: string | null }
const askers = new Set<(ask: StepAsk) => void>()

/** Opens a step's card in the thread window's flow panel (the side) for that person, unfolding its rail. */
export function openFlowStep(contactId: string, stepId: string, jobId: string | null): void {
  for (const open of askers) open({ contactId, stepId, jobId })
}

/** The side's flow panel hears `openFlowStep` for its person. */
export function useOpenFlowStep(contactId: string | null, open: (stepId: string, jobId: string | null) => void): void {
  useEffect(() => {
    if (!contactId) return
    const hear = (ask: StepAsk) => {
      if (ask.contactId === contactId) open(ask.stepId, ask.jobId)
    }
    askers.add(hear)
    return () => {
      askers.delete(hear)
    }
  }, [contactId, open])
}
