/**
 * Take from a box, read back (v2.7828): one box's last takes with their pictures, as a piece a screen places where it
 * likes. It reads the job's rows from the on-site store by itself and draws nothing for a box nobody has taken from.
 * The phone's box screen draws it under the box's parts.
 */
import { useOnSiteStoreVersion } from '../../hooks/useOnSiteStore'
import { listMovements, listPhotos } from '../../lib/materials/onSiteStore'
import { takesOf } from '../../lib/materials/takes'
import TakesPanel from './TakesPanel'

export default function BoxTakes({ jobId, containerId, containerLabel, limit = 2 }: { jobId: string; containerId: string; containerLabel: string; /** Show this many, with a press for the rest. */ limit?: number }) {
  // The store's rows change under a screen that holds only ids: read again when they do.
  useOnSiteStoreVersion()
  const takes = takesOf(listMovements(jobId), listPhotos(jobId)).filter((t) => t.containerId === containerId)
  if (takes.length === 0) return null
  return <TakesPanel heading={`Taken from ${containerLabel}`} takes={takes} labelOf={() => containerLabel} limit={limit} />
}
