/**
 * Materials on site (punch list #209): the Tally's address and its open box, kept in step (v2.6904).
 * The address names the job and the box while that box's screen is open, so a reload, Back and a
 * shared link come back to it; the rule is `onSiteAddressStep` in `src/lib/materials/onSiteAddress.ts`.
 * The page hands in its jobs and its chosen job, passes `asked` to the On site tab and hears from the
 * tab which box is open.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { onSiteAddressStep, readOnSiteAddress, withOnSiteBox } from '../lib/materials/onSiteAddress'

export type OnSiteAsk = {
  /** The box the address asked for; null when it named none, or once the person chose another job. */
  containerId: string | null
  /** Goes up on every read of the address, so the tab opens a box that is asked for a second time. */
  seq: number
}

export function useOnSiteAddress(input: {
  /** The jobs this person can open; empty until they load. */
  jobIds: ReadonlyArray<string>
  /** The On site tab is the one drawn. */
  onTab: boolean
  selectedJobId: string | null
  selectJob: (jobId: string) => void
}): {
  asked: OnSiteAsk
  /** The tab says which box's screen is open; null on the list. */
  reportOpen: (containerId: string | null) => void
  /** A job chosen by hand: the box the address asked for belongs to the job before it, so it is forgotten. */
  pickJob: (jobId: string) => void
} {
  const { jobIds, onTab, selectedJobId, selectJob } = input
  const [searchParams, setSearchParams] = useSearchParams()
  const [asked, setAsked] = useState<OnSiteAsk>(() => ({ containerId: readOnSiteAddress(searchParams).containerId, seq: 0 }))
  const [openContainerId, setOpenContainerId] = useState<string | null>(() => readOnSiteAddress(searchParams).containerId)
  /** The address this page last read or wrote: any other address was moved by a scan, a link or Back. */
  const lastKeyRef = useRef<string | null>(null)
  const jobsLoaded = jobIds.length > 0

  useEffect(() => {
    const step = onSiteAddressStep({ address: readOnSiteAddress(searchParams), lastKey: lastKeyRef.current, jobsLoaded, onTab, selectedJobId, openContainerId })
    if (step.kind === 'wait') return
    lastKeyRef.current = step.key
    if (step.kind === 'read') {
      if (jobIds.includes(step.jobId)) selectJob(step.jobId)
      setAsked((a) => ({ containerId: step.containerId, seq: a.seq + 1 }))
      // The tab opens the asked box on its next pass; said here so the address is not taken off in between.
      setOpenContainerId(step.containerId)
    } else if (step.kind === 'write') {
      setSearchParams((p) => withOnSiteBox(p, step.box), { replace: true })
    }
    // `asked.seq` is a dependency so the step runs once more after a read, even when the read changed
    // nothing else (a link to the job already chosen): the address then settles on what the screen shows.
  }, [searchParams, setSearchParams, jobsLoaded, jobIds, onTab, selectedJobId, openContainerId, selectJob, asked.seq])

  const reportOpen = useCallback((containerId: string | null) => setOpenContainerId(containerId), [])
  const pickJob = useCallback(
    (jobId: string) => {
      if (jobId !== selectedJobId) setAsked((a) => (a.containerId == null ? a : { containerId: null, seq: a.seq }))
      selectJob(jobId)
    },
    [selectedJobId, selectJob],
  )
  return { asked, reportOpen, pickJob }
}
