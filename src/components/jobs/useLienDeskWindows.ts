import { useEffect, useState } from 'react'

/** The six windows the Lien desk's Board raises, each with its setter (`useLienDeskWindows`). */
export type LienDeskWindowFlags = ReturnType<typeof useLienDeskWindows>

/**
 * Which of the Board's windows is up (its own file since v2.7588, out of `LienDesk.tsx` as it stood). `openScansDoor`
 * is the host's door to Add the stamped scans: the window opens each time the host hands a new one.
 */
export function useLienDeskWindows(openScansDoor: { key: number } | null | undefined) {
  // Off the lien path (v2.7526): the job whose window is open, to take it off or to put it back.
  const [jobPath, setJobPath] = useState<string | null>(null)
  // The properties left to review, one window at a time; and the property being put back on the lien path.
  const [publicReview, setPublicReview] = useState<string[] | null>(null)
  // Serve the filed liens (punch list #366): one window prints every filed lien's copies and takes their mail numbers.
  const [serveOpen, setServeOpen] = useState(false)
  // Add the stamped scans (punch list #366): several filed liens' scans in one sitting, each saved to its own job.
  const [scansOpen, setScansOpen] = useState(false)
  useEffect(() => {
    if (openScansDoor) setScansOpen(true)
  }, [openScansDoor])
  const [publicPutBack, setPublicPutBack] = useState<string | null>(null)
  // Back from the clerk (v2.7856): the liens in Ready to file, each recorded as filed as its document number is typed.
  const [filingsOpen, setFilingsOpen] = useState(false)
  return { jobPath, setJobPath, publicReview, setPublicReview, serveOpen, setServeOpen, scansOpen, setScansOpen, publicPutBack, setPublicPutBack, filingsOpen, setFilingsOpen }
}
