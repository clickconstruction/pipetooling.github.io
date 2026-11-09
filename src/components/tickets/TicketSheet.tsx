import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { PhoneSheet } from '../PhoneSheet'
import { TallyChooseJobSheet } from '../tally/TallyChooseJobSheet'
import { useLedgerDisplayPrefixes } from '../../contexts/LedgerDisplayPrefixContext'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import type { ChooseJobRow } from '../../lib/tally/chooseJobSearch'
import {
  EMPTY_TICKET_CHOICE,
  SECOND_JOB_WORDS,
  chosenOptions,
  firstTicketChoice,
  tapJobLater,
  tapNoOneJob,
  tapTicketJob,
  ticketChoiceReady,
  ticketChoiceWrite,
  ticketJobOptions,
  ticketJobWhyWords,
  ticketSaveLabel,
  withPickedJob,
  type TicketChoice,
  type TicketJobFacts,
} from '../../lib/tickets/ticketJobs'
import { ticketJobFactsOf, type TicketSheetFacts } from '../../lib/tickets/ticketSheetIo'
import type { TicketScreensIo } from '../../lib/tickets/ticketScreensIo'
import type { TicketCapture, TicketSaveOutcome } from '../../hooks/useTicketCapture'

/**
 * The sheet a ticket opens after its photo (punch list #295, PR 2; the mock-up's frames B and C): *Which job is this
 * ticket for?* The pages sit on top with **Retake** and **+ Another page**. The chips come from `ticketJobs.ts`: a PO
 * code made for this person today, the job clocked in now, the day's other jobs. The first is picked already, a second
 * tap adds a second job, and **Another job…** opens Tally's own job search in this sheet's place. The total and a note
 * sit behind two small links, since the match reads the minute of the swipe and needs neither. Save says exactly what
 * it will do.
 */

const chipStyle = (on: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
  width: '100%',
  textAlign: 'left',
  background: 'var(--surface)',
  border: on ? '2px solid #2563eb' : '1px solid var(--border)',
  borderRadius: 10,
  padding: on ? 'calc(0.6rem - 1px) calc(0.7rem - 1px)' : '0.6rem 0.7rem',
  cursor: 'pointer',
  color: 'var(--text-strong)',
})

const linkStyle: CSSProperties = { background: 'none', border: 'none', color: 'var(--text-link)', fontSize: '0.8125rem', cursor: 'pointer', padding: '0.25rem 0' }

function parseTotal(raw: string): number | null {
  const n = Number(raw.replace(/[$,\s]/g, ''))
  return raw.trim() !== '' && Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

export function TicketSheet({
  capture,
  facts,
  userId,
  byName,
  io,
  onSaved,
  onClose,
}: {
  capture: TicketCapture
  facts: TicketSheetFacts
  userId: string
  byName: string
  io: TicketScreensIo
  onSaved: (outcome: TicketSaveOutcome, words: { label: string | null; noOneJob: boolean }) => void
  onClose: () => void
}) {
  const { prefixMap } = useLedgerDisplayPrefixes()
  const [picked, setPicked] = useState<TicketJobFacts[]>([])
  const options = useMemo(() => ticketJobOptions({ ...facts, picked }), [facts, picked])
  const [choice, setChoice] = useState<TicketChoice>(EMPTY_TICKET_CHOICE)
  const touched = useRef(false)
  const [showTotal, setShowTotal] = useState(false)
  const [totalText, setTotalText] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [note, setNote] = useState('')
  const [pickerJobs, setPickerJobs] = useState<ChooseJobRow[] | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // The first choice is made for the person until they tap; the facts may arrive after the sheet is up.
  useEffect(() => {
    if (!touched.current) setChoice(firstTicketChoice(options))
  }, [options])

  const tap = (next: TicketChoice) => {
    touched.current = true
    setChoice(next)
  }

  const openPicker = () => {
    setPickerOpen(true)
    if (pickerJobs === null) void io.allJobs().then(setPickerJobs)
  }

  const chosen = chosenOptions(choice, options)
  const ready = ticketChoiceReady(choice, options) && capture.pages.length > 0
  const dead = !ready || saving || capture.busy

  const save = async () => {
    if (dead) return
    setSaving(true)
    try {
      const write = ticketChoiceWrite(choice, options)
      const label = chosen[0]?.label ?? null
      const outcome = await capture.save({ userId, byName, write, total: showTotal ? parseTotal(totalText) : null, note: showNote ? note.trim().slice(0, 500) : '', about: label ?? (choice.noOneJob ? 'no one job' : 'no job yet') })
      onSaved(outcome, { label, noOneJob: choice.noOneJob })
    } catch {
      // the hook holds the reason and the sheet draws it
    } finally {
      setSaving(false)
    }
  }

  if (pickerOpen) {
    return (
      <TallyChooseJobSheet
        jobs={pickerJobs ?? []}
        onlyIds={null}
        selectedJobId={null}
        viewerUserId={userId}
        onPick={(id) => {
          const row = (pickerJobs ?? []).find((j) => j.id === id)
          if (row) {
            const job = ticketJobFactsOf({ id: row.id, hcp_number: row.hcp_number, click_number: row.click_number ?? null, job_name: row.job_name, service_type_id: row.service_type_id ?? null }, prefixMap)
            setPicked((cur) => (cur.some((p) => p.jobId === job.jobId) ? cur : [...cur, job]))
            tap(withPickedJob(choice, job.jobId))
          }
          setPickerOpen(false)
        }}
        onClose={() => setPickerOpen(false)}
      />
    )
  }

  const last = capture.pages[capture.pages.length - 1]

  return (
    <PhoneSheet label="Which job is this ticket for?" title="Which job is this ticket for?" width={480} onClose={onClose} dataAttrs={{ 'data-ticket-sheet': 'open' }}>
      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0.5rem 1rem 1rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.5rem', alignContent: 'start' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', overflowX: 'auto', paddingBottom: 2 }}>
          {capture.pages.map((p, i) => (
            <div key={p.id} style={{ flex: 'none', textAlign: 'center' }}>
              {p.previewUrl ? (
                <img src={p.previewUrl} alt={`Page ${i + 1} of the ticket`} style={{ width: 64, height: 84, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
              ) : (
                <div style={{ width: 64, height: 84, borderRadius: 8, border: '1px solid var(--border)', display: 'grid', placeItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--surface)' }}>PDF</div>
              )}
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>Page {i + 1}</div>
            </div>
          ))}
          <div style={{ display: 'grid', gap: 2, paddingBottom: '1rem' }}>
            <button type="button" onClick={capture.openCamera} disabled={capture.busy} style={linkStyle}>
              + Another page
            </button>
            {last && last.source === 'camera' ? (
              <button type="button" onClick={() => capture.retake(last.id)} disabled={capture.busy} style={linkStyle}>
                Retake
              </button>
            ) : null}
          </div>
        </div>
        {capture.busy && !saving ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Getting the photo ready…</div> : null}

        {options.map((o) => {
          const on = choice.keys.includes(o.key)
          return (
            <button key={o.key} type="button" aria-pressed={on} onClick={() => tap(tapTicketJob(choice, o.key))} style={chipStyle(on)}>
              <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {o.why === 'po' && o.poCode ? `PO ${o.poCode}, ` : ''}
                  {o.label}
                  {o.name ? `, ${o.name}` : ''}
                </span>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ticketJobWhyWords(o)}</span>
              </span>
              {on ? (
                <span aria-hidden style={{ flex: 'none', color: 'var(--text-link)', fontWeight: 700 }}>
                  ✓
                </span>
              ) : null}
            </button>
          )
        })}
        <button type="button" onClick={openPicker} style={chipStyle(false)}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Another job…</span>
        </button>
        <button type="button" aria-pressed={choice.noOneJob} onClick={() => tap(tapNoOneJob(choice))} style={chipStyle(choice.noOneJob)}>
          <span style={{ flex: '1 1 auto' }}>
            <span style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem' }}>Not for one job</span>
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Stock, the shop or a tool. The office places it.</span>
          </span>
          {choice.noOneJob ? (
            <span aria-hidden style={{ flex: 'none', color: 'var(--text-link)', fontWeight: 700 }}>
              ✓
            </span>
          ) : null}
        </button>
        {chosen.length === 1 && options.length > 1 ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{SECOND_JOB_WORDS}</div> : null}

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {!showTotal ? (
            <button type="button" onClick={() => setShowTotal(true)} style={linkStyle}>
              + total
            </button>
          ) : null}
          {!showNote ? (
            <button type="button" onClick={() => setShowNote(true)} style={linkStyle}>
              + note
            </button>
          ) : null}
          <button type="button" aria-pressed={choice.later === true} onClick={() => tap(tapJobLater(choice))} style={{ ...linkStyle, fontWeight: choice.later ? 700 : 400 }}>
            {choice.later ? '✓ Pick the job later' : 'Pick the job later'}
          </button>
        </div>
        {showTotal ? (
          <label style={{ display: 'grid', gap: 4, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            The total on the ticket
            <input
              type="text"
              inputMode="decimal"
              value={totalText}
              onChange={(e) => setTotalText(e.target.value)}
              placeholder="0.00"
              style={{ fontSize: '1rem', padding: '0.5rem 0.6rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)' }}
            />
          </label>
        ) : null}
        {showNote ? (
          <label style={{ display: 'grid', gap: 4, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            A note for the office
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              style={{ fontSize: '1rem', padding: '0.5rem 0.6rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)', resize: 'vertical' }}
            />
          </label>
        ) : null}

        {capture.error ? (
          <div role="alert" style={{ fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>
            {capture.error}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => void save()}
          disabled={dead}
          style={{ width: '100%', background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : '#fff', border: 'none', borderRadius: 10, padding: '0.75rem', fontSize: '0.9375rem', fontWeight: 700, cursor: dead ? 'not-allowed' : 'pointer' }}
        >
          {saving ? 'Saving the ticket…' : ticketSaveLabel(choice, options)}
        </button>
      </div>
    </PhoneSheet>
  )
}
