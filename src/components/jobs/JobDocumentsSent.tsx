import { useEffect, useMemo, useState } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { type SentCopy, sentCopyLines } from '../../lib/sent/sentCopies'
import { loadSentCopiesForJob } from '../../lib/sent/sentCopiesIo'
import { SentCopyRows } from '../documents/SentCopyRows'
import { documentsHeading, documentsQuietButton } from './jobDocumentsStyles'

/**
 * The Documents tab's "Sent from this job" (v2.4554): each thing that went out about this job,
 * newest first, with the copy as it went. The other sections list a paper by its kind and draw
 * it from today's records; this one is the record of the sends themselves.
 */

/** The list starts short; the rest are one press away. */
const SHOWN_AT_FIRST = 8

export function JobDocumentsSent({ job }: { job: JobWithDetails }) {
  const [rows, setRows] = useState<SentCopy[] | null>(null)
  const [all, setAll] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadSentCopiesForJob(job.id).then((list) => {
      if (!cancelled) setRows(list)
    })
    return () => {
      cancelled = true
    }
  }, [job.id])

  const lines = useMemo(() => sentCopyLines(rows ?? []), [rows])
  const shown = all ? lines : lines.slice(0, SHOWN_AT_FIRST)

  return (
    <section aria-labelledby="job-documents-sent" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <h3 id="job-documents-sent" style={documentsHeading}>
        Sent from this job
      </h3>
      {rows == null ? (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
      ) : lines.length === 0 ? (
        <p data-testid="job-documents-sent-empty" style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          No copy is on file for this job yet. A copy is kept each time something about the job is printed or sent.
        </p>
      ) : (
        <>
          <SentCopyRows lines={shown} rowTestId="job-documents-sent-row" />
          {lines.length > SHOWN_AT_FIRST ? (
            <div>
              <button type="button" style={documentsQuietButton} onClick={() => setAll((v) => !v)}>
                {all ? 'Show the newest only' : `Show all ${lines.length}`}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}

export default JobDocumentsSent
