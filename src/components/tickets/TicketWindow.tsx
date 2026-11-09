import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { PhoneSheet } from '../PhoneSheet'
import { TallyChooseJobSheet } from '../tally/TallyChooseJobSheet'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useTicketCapture } from '../../hooks/useTicketCapture'
import type { ChooseJobRow } from '../../lib/tally/chooseJobSearch'
import { takerMayChange, ticketStateWords } from '../../lib/tickets/ticket'
import { announceTickets } from '../../lib/tickets/ticketEvents'
import type { TicketJobFacts } from '../../lib/tickets/ticketJobs'
import { TICKET_USED_WORDS, ticketJobLine, ticketWhenLine } from '../../lib/tickets/ticketRowWords'
import type { TicketScreensIo } from '../../lib/tickets/ticketScreensIo'
import type { TicketWithPages } from '../../lib/tickets/ticketsIo'
import { formatErrorMessage } from '../../utils/errorHandling'

/**
 * A person's own ticket (punch list #295, PR 2; the mock-up's frame G): its pages, its job, where it stands, and the
 * three things its taker may still do until the office has used it: **Change the job**, **Add a page**, **Remove this
 * ticket**. Change the job opens Tally's job search in this window's place. A removed ticket is hidden, never deleted.
 * Once the office has used the ticket the first and the last are gone, and the window says why.
 */

const pressStyle: CSSProperties = { width: '100%', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }

export function TicketWindow({
  ticket,
  jobs,
  userId,
  io,
  onClose,
  onChanged,
}: {
  ticket: TicketWithPages
  jobs: ReadonlyMap<string, TicketJobFacts>
  userId: string
  io: TicketScreensIo
  onClose: () => void
  onChanged: () => void
}) {
  const confirmDialog = useConfirmDialog()
  const capture = useTicketCapture()
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [pickerJobs, setPickerJobs] = useState<ChooseJobRow[] | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const sending = useRef(false)
  const mayChange = takerMayChange(ticket) && ticket.taken_by === userId

  useEffect(() => {
    let live = true
    for (const p of ticket.counter_ticket_pages) {
      if (!p.storage_path) continue
      void io.pageUrl(p.storage_path).then((url) => {
        if (live && url) setUrls((cur) => ({ ...cur, [p.id]: url }))
      })
    }
    return () => {
      live = false
    }
  }, [ticket.counter_ticket_pages, io])

  // Add a page: the shot the camera hands back goes straight onto the ticket.
  useEffect(() => {
    if (capture.pages.length === 0 || sending.current) return
    sending.current = true
    setBusy('Adding the page…')
    setError(null)
    const next = ticket.counter_ticket_pages.reduce((n, p) => Math.max(n, p.page_no), 0) + 1
    void (async () => {
      try {
        let n = next
        for (const p of capture.pages) await io.addPage({ id: ticket.id, uploaderId: userId }, { id: p.id, pageNo: n++, blob: p.blob, mime: p.mime, originalBytes: p.originalBytes, width: p.width, height: p.height, takenAt: p.takenAt })
        announceTickets([ticket.id])
        onChanged()
      } catch (e) {
        setError(formatErrorMessage(e, 'The page did not send.'))
      } finally {
        capture.discard()
        sending.current = false
        setBusy(null)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture.pages])

  const run = async (words: string, act: () => Promise<void>, after?: () => void) => {
    setBusy(words)
    setError(null)
    try {
      await act()
      announceTickets([ticket.id])
      onChanged()
      after?.()
    } catch (e) {
      setError(formatErrorMessage(e, 'That did not save.'))
    } finally {
      setBusy(null)
    }
  }

  if (pickerOpen) {
    return (
      <TallyChooseJobSheet
        jobs={pickerJobs ?? []}
        onlyIds={null}
        selectedJobId={ticket.job_id}
        viewerUserId={userId}
        onPick={(id) => {
          setPickerOpen(false)
          // The PO code names its own job, so a ticket moved to another job no longer carries it.
          void run('Changing the job…', () => io.changeJob(ticket.id, { job_id: id, also_job_ids: [], no_one_job: false, po_entry_id: id === ticket.job_id ? ticket.po_entry_id : null }))
        }}
        onClose={() => setPickerOpen(false)}
      />
    )
  }

  return (
    <PhoneSheet label="Your ticket" title={ticketJobLine(ticket, jobs)} width={480} onClose={onClose} dataAttrs={{ 'data-ticket-window': ticket.id }}>
      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0.5rem 1rem 1rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.5rem', alignContent: 'start' }}>
        <input {...capture.cameraInput} />
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{ticketWhenLine(ticket, ticket.counter_ticket_pages.length)}</div>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)' }}>{ticketStateWords(ticket)}</div>
        {ticket.total !== null ? <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Total you typed: ${ticket.total.toFixed(2)}</div> : null}
        {ticket.note ? <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', wordBreak: 'break-word' }}>{ticket.note}</div> : null}
        {ticket.counter_ticket_pages.map((p) =>
          p.mime === 'application/pdf' ? (
            urls[p.id] ? (
              <a key={p.id} href={urls[p.id]} target="_blank" rel="noopener noreferrer" style={{ ...pressStyle, textAlign: 'center', textDecoration: 'none', display: 'block', boxSizing: 'border-box' }}>
                Open page {p.page_no}, a PDF
              </a>
            ) : (
              <div key={p.id} style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Page {p.page_no}, a PDF</div>
            )
          ) : urls[p.id] ? (
            <img key={p.id} src={urls[p.id]} alt={`Page ${p.page_no} of the ticket`} style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
          ) : (
            <div key={p.id} style={{ height: 120, borderRadius: 8, border: '1px solid var(--border)', display: 'grid', placeItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Page {p.page_no}
            </div>
          ),
        )}
        {error ? (
          <div role="alert" style={{ fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>
            {error}
          </div>
        ) : null}
        {busy ? <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{busy}</div> : null}
        {mayChange ? (
          <button
            type="button"
            disabled={busy !== null}
            style={pressStyle}
            onClick={() => {
              setPickerOpen(true)
              if (pickerJobs === null) void io.allJobs().then(setPickerJobs)
            }}
          >
            Change the job
          </button>
        ) : null}
        {ticket.taken_by === userId && !ticket.removed_at ? (
          <button type="button" disabled={busy !== null || capture.busy} style={pressStyle} onClick={capture.openCamera}>
            Add a page
          </button>
        ) : null}
        {mayChange ? (
          <button
            type="button"
            disabled={busy !== null}
            style={{ ...pressStyle, color: 'var(--text-red-600)' }}
            onClick={async () => {
              if (!(await confirmDialog({ title: 'Remove this ticket?', message: 'The ticket leaves your list and the office’s. Its photo is kept, and the office can still find it.', confirmLabel: 'Remove the ticket', danger: true }))) return
              void run('Removing the ticket…', () => io.remove(ticket.id), onClose)
            }}
          >
            Remove this ticket
          </button>
        ) : null}
        {!takerMayChange(ticket) && ticket.used_at ? <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{TICKET_USED_WORDS}</div> : null}
      </div>
    </PhoneSheet>
  )
}
