import { useEffect, useMemo, useState } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { useToastContext } from '../../contexts/ToastContext'
import { formatDenverCalendarDayWithYear, formatDenverTimeOnly } from '../../utils/dateUtils'
import { type SentCopy, type SentCopyLine, sentCopyDoor, sentCopyLines, sentCopyWords } from '../../lib/sent/sentCopies'
import { loadSentCopiesForJob, openSentCopy, openSentFile } from '../../lib/sent/sentCopiesIo'
import { documentsHeading, documentsLinkButton, documentsQuietButton, documentsTd } from './jobDocumentsStyles'

/**
 * The Documents tab's "Sent from this job" (v2.4554): each thing that went out about this job,
 * newest first, with the copy as it went. The other sections list a paper by its kind and draw
 * it from today's records; this one is the record of the sends themselves.
 */

/** The list starts short; the rest are one press away. */
const SHOWN_AT_FIRST = 8

const when = (iso: string): string => {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? `${formatDenverCalendarDayWithYear(ms)}, ${formatDenverTimeOnly(ms)}` : ''
}

export function JobDocumentsSent({ job }: { job: JobWithDetails }) {
  const { showToast } = useToastContext()
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

  const open = async (line: SentCopyLine) => {
    const ok = await openSentCopy(line.row, `Copy as it went out · ${line.row.title} · ${sentCopyWords(line, when)}`)
    if (!ok) showToast('Could not open the copy. Allow pop-ups for this site and press it again.', 'error')
  }
  const openAttachment = async (path: string) => {
    if (!(await openSentFile(path))) showToast('Could not open the attachment.', 'error')
  }

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
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              {shown.map((line) => {
                const kept = sentCopyDoor(line.row) !== 'none'
                return (
                  <tr key={line.row.id} data-testid="job-documents-sent-row">
                    <td style={documentsTd}>
                      {kept ? (
                        <button type="button" onClick={() => void open(line)} style={documentsLinkButton} title="Open the copy as it went out">
                          {line.row.title}
                        </button>
                      ) : (
                        <span style={{ fontWeight: 600 }}>{line.row.title}</span>
                      )}
                      <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.8125rem' }}>{sentCopyWords(line, when)}</span>
                      {kept ? null : (
                        <span data-testid="job-documents-sent-no-copy" style={{ color: 'var(--text-amber-800)', marginLeft: '0.5rem', fontSize: '0.8125rem' }}>
                          The copy was not kept.
                        </span>
                      )}
                      {line.row.attachments.map((a) => (
                        <button key={a.path} type="button" onClick={() => void openAttachment(a.path)} style={{ ...documentsLinkButton, fontWeight: 400, marginLeft: '0.6rem', fontSize: '0.8125rem' }}>
                          {a.name}
                        </button>
                      ))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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
