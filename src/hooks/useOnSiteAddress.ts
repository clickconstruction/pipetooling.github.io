/**
 * Materials on site (punch list #209): the Tally's address and its open box, kept in step (v2.6904).
 * The address names the job and the box while that box's screen is open, so a reload, Back and a
 * shared link come back to it; the rule is `onSiteAddressStep` in `src/lib/materials/onSiteAddress.ts`.
 * The page hands in its jobs and its chosen job, passes `asked` to the On site tab and hears from the
 * tab which box is open. Since v2.7298 (punch list #329, PR 3) the address also carries a blank
 * sticker's code while its sheet is open, and the tab says which sticker it holds.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { onSiteAddressStep, readOnSiteAddress, withOnSiteAddress } from '../lib/materials/onSiteAddress'

export type OnSiteAsk = {
  /** The box the address asked for; null when it named none, or once the person chose another job. */
  containerId: string | null
  /** The blank sticker the address asked for, by its code; null when it named none. It outlives a change of job. */
  stickerCode: string | null
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
  /** The tab says which sticker's sheet is open; null once it closes. */
  reportSticker: (code: string | null) => void
  /** A job chosen by hand: the box the address asked for belongs to the job before it, so it is forgotten. */
  pickJob: (jobId: string) => void
  /** The box whose screen is open, null on the list: the page folds its own tabs away while one is (Take from a box). */
  openContainerId: string | null
} {
  const { jobIds, onTab, selectedJobId, selectJob } = input
  const [searchParams, setSearchParams] = useSearchParams()
  const [asked, setAsked] = useState<OnSiteAsk>(() => {
    const a = readOnSiteAddress(searchParams)
    return { containerId: a.containerId, stickerCode: a.stickerCode, seq: 0 }
  })
  const [openContainerId, setOpenContainerId] = useState<string | null>(() => readOnSiteAddress(searchParams).containerId)
  const [openStickerCode, setOpenStickerCode] = useState<string | null>(() => readOnSiteAddress(searchParams).stickerCode)
  /** The address this page last read or wrote: any other address was moved by a scan, a link or Back. */
  const lastKeyRef = useRef<string | null>(null)
  const jobsLoaded = jobIds.length > 0

  useEffect(() => {
    const step = onSiteAddressStep({ address: readOnSiteAddress(searchParams), lastKey: lastKeyRef.current, jobsLoaded, onTab, selectedJobId, openContainerId, openStickerCode })
    if (step.kind === 'wait') return
    lastKeyRef.current = step.key
    if (step.kind === 'read') {
      if (step.jobId && jobIds.includes(step.jobId)) selectJob(step.jobId)
      setAsked((a) => ({ containerId: step.containerId, stickerCode: step.stickerCode, seq: a.seq + 1 }))
      // The tab opens the asked box or sheet on its next pass; said here so the address is not taken off in between.
      setOpenContainerId(step.containerId)
      setOpenStickerCode(step.stickerCode)
    } else if (step.kind === 'write') {
      setSearchParams((p) => withOnSiteAddress(p, step.box ? { jobId: step.box.jobId, containerId: step.box.containerId, stickerCode: null } : { jobId: step.stickerCode ? selectedJobId : null, containerId: null, stickerCode: step.stickerCode }), { replace: true })
    }
    // `asked.seq` is a dependency so the step runs once more after a read, even when the read changed
    // nothing else (a link to the job already chosen): the address then settles on what the screen shows.
  }, [searchParams, setSearchParams, jobsLoaded, jobIds, onTab, selectedJobId, openContainerId, openStickerCode, selectJob, asked.seq])

  const reportOpen = useCallback((containerId: string | null) => setOpenContainerId(containerId), [])
  const reportSticker = useCallback((code: string | null) => setOpenStickerCode(code), [])
  const pickJob = useCallback(
    (jobId: string) => {
      if (jobId !== selectedJobId) setAsked((a) => (a.containerId == null ? a : { ...a, containerId: null }))
      selectJob(jobId)
    },
    [selectedJobId, selectJob],
  )
  return { asked, reportOpen, reportSticker, pickJob, openContainerId }
}
