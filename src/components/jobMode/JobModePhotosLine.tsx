/**
 * The Job Mode card's Photos line (punch list #244, PR 4): the field's door to the Job photos window, since field roles
 * rarely see the Pipeline. One line under the stage checklists, *Photos · 14 ▸* from one head count of the view's rows
 * for the job, *Photos · add the first ▸* with none; a press opens the same window the Pipeline row's camera opens, the
 * camera first on a phone for the field roles. The count reads again when the window closes.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { CameraGlyph } from '../materials/PhotoPress'
import { JobPhotosWindow } from '../photos/JobPhotosWindow'
import { jobModePhotosLineWords } from '../../lib/photos/jobPhotoNotes'
import { countJobUploadedPhotos, type JobPhotosWindowIo } from '../../lib/photos/jobPhotoNotesIo'

const door: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.4rem', minHeight: 44, padding: '0 0.25rem', border: 'none', background: 'none', color: 'var(--text-link)', fontWeight: 600, fontSize: '0.9375rem', cursor: 'pointer', font: 'inherit', textAlign: 'left' }

export function JobModePhotosLine({ jobId, hcpNumber, jobName, jobAddress, countIo, windowIo }: { jobId: string; hcpNumber?: string | null; jobName?: string | null; jobAddress?: string | null; countIo?: (jobId: string) => Promise<number | null>; windowIo?: JobPhotosWindowIo }) {
  const count = useMemo(() => countIo ?? countJobUploadedPhotos, [countIo])
  const [n, setN] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    count(jobId).then(
      (c) => live && setN(c),
      () => live && setN(null),
    )
    return () => {
      live = false
    }
  }, [count, jobId, tick])
  return (
    <div data-job-mode-photos={n == null ? 'unread' : n > 0 ? 'some' : 'none'}>
      <button type="button" style={door} onClick={() => setOpen(true)} aria-label={`${jobModePhotosLineWords(n)}: open the job’s photos`}>
        <CameraGlyph size={16} />
        {jobModePhotosLineWords(n)} ▸
      </button>
      {open ? (
        <JobPhotosWindow
          job={{ id: jobId, hcp_number: hcpNumber ?? null, job_name: jobName ?? null, job_address: jobAddress ?? null }}
          onClose={() => {
            setOpen(false)
            setTick((t) => t + 1)
          }}
          io={windowIo}
        />
      ) : null}
    </div>
  )
}

export default JobModePhotosLine
