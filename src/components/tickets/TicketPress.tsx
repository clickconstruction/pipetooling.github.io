import { useCallback, useEffect, useState } from 'react'
import { CameraGlyph } from '../materials/PhotoPress'
import { TicketSheet } from './TicketSheet'
import { useLedgerDisplayPrefixes } from '../../contexts/LedgerDisplayPrefixContext'
import { useToastContext } from '../../contexts/ToastContext'
import { useTicketCapture, type TicketCaptureIo } from '../../hooks/useTicketCapture'
import { ticketSavedWords } from '../../lib/tickets/ticketRowWords'
import { EMPTY_TICKET_SHEET_FACTS, type TicketSheetFacts } from '../../lib/tickets/ticketSheetIo'
import { ticketScreensIo, type TicketScreensIo } from '../../lib/tickets/ticketScreensIo'

/**
 * **Photo of a ticket** (punch list #295, PR 2; the mock-up's frame A): the one press on Tally that takes a photo of a
 * supply house ticket or a receipt at the counter. The camera opens first; the sheet that names the job comes after the
 * shot (`TicketSheet`). The small link under it takes a photo or a PDF the person already has, for a receipt the store
 * sent by email. The jobs the sheet offers are read when the press is drawn, not when it is pressed, so a counter with
 * no signal still gets the day's jobs.
 */

export function TicketPress({ userId, byName, io = ticketScreensIo, captureIo }: { userId: string; byName: string; io?: TicketScreensIo; captureIo?: TicketCaptureIo }) {
  const { prefixMap } = useLedgerDisplayPrefixes()
  const { showToast } = useToastContext()
  const capture = useTicketCapture(captureIo)
  const [facts, setFacts] = useState<TicketSheetFacts>(EMPTY_TICKET_SHEET_FACTS)
  const [saved, setSaved] = useState<string | null>(null)

  const loadFacts = useCallback(() => {
    let live = true
    void io
      .sheetFacts(userId, prefixMap)
      .then((read) => {
        if (live) setFacts(read.facts)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [io, userId, prefixMap])

  useEffect(() => loadFacts(), [loadFacts])

  const sheetOpen = capture.pages.length > 0

  return (
    <div style={{ marginBottom: '0.9rem' }} data-ticket-press="">
      <input {...capture.cameraInput} />
      <input {...capture.filesInput} />
      <button
        type="button"
        onClick={() => {
          setSaved(null)
          loadFacts()
          capture.openCamera()
        }}
        disabled={capture.busy && !sheetOpen}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, padding: '0.7rem', fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer' }}
      >
        <CameraGlyph size={16} />
        Photo of a ticket
      </button>
      <button
        type="button"
        onClick={() => {
          setSaved(null)
          loadFacts()
          capture.openFiles()
        }}
        style={{ display: 'block', margin: '0.3rem auto 0', background: 'none', border: 'none', color: 'var(--text-link)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
      >
        or choose a photo or a PDF you already have
      </button>
      {capture.busy && !sheetOpen ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.3rem' }}>Getting the photo ready…</div> : null}
      {capture.error && !sheetOpen ? (
        <div role="alert" style={{ fontSize: '0.8125rem', color: 'var(--text-red-600)', textAlign: 'center', marginTop: '0.3rem' }}>
          {capture.error}
        </div>
      ) : null}
      {saved && !sheetOpen ? (
        <div role="status" style={{ fontSize: '0.8125rem', color: 'var(--text-green-700)', textAlign: 'center', marginTop: '0.3rem' }}>
          {saved}
        </div>
      ) : null}
      {sheetOpen ? (
        <TicketSheet
          capture={capture}
          facts={facts}
          userId={userId}
          byName={byName}
          io={io}
          onSaved={(outcome, words) => {
            const line = ticketSavedWords(outcome, words)
            setSaved(line)
            showToast(line, outcome.kind === 'kept' ? 'info' : 'success')
          }}
          onClose={capture.discard}
        />
      ) : null}
    </div>
  )
}
