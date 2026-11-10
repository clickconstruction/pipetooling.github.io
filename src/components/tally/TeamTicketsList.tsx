import { useState, type CSSProperties } from 'react'
import { EmptyState } from '../EmptyState'
import { ticketStateWords, type TicketPaidOther } from '../../lib/tickets/ticket'
import type { TicketJobFacts } from '../../lib/tickets/ticketJobs'
import { officeTicketWhyWords, type OfficeTicketRow } from '../../lib/tickets/ticketOffice'
import { ticketJobLine, ticketWhenLine } from '../../lib/tickets/ticketRowWords'
import type { TicketWithPages } from '../../lib/tickets/ticketsIo'

/**
 * The office's Tickets list (punch list #295, PR 3; the mock-up's frame L): every ticket the Team queue cannot show
 * on a charge line. A ticket that disagrees with where the office sent its charge asks *Change it* or *Leave it*; one
 * the matcher can only ask about asks *It is* / *It is not*, or offers the charges that fit; one with no charge
 * offers the holder's charges to pick from and *Paid another way…*; one with no job or for no one job offers a job.
 * Nothing changes behind the office's back: every press here is the office's.
 */

export type TicketChargeOption = { id: string; words: string }

export type TeamTicketsListProps = {
  rows: readonly OfficeTicketRow<TicketWithPages>[]
  jobs: ReadonlyMap<string, TicketJobFacts>
  /** The charges a ticket could be, by charge id: the words the office picks by. */
  chargeWords: (chargeId: string) => string
  /** The holder's charges around the ticket's day, for *Pick the charge*. */
  chargesFor: (ticket: TicketWithPages) => TicketChargeOption[]
  busyId: string | null
  onOpen: (ticket: TicketWithPages) => void
  onAnswer: (ticket: TicketWithPages, chargeId: string, yes: boolean) => void
  onPickCharge: (ticket: TicketWithPages, chargeId: string) => void
  onPaidOther: (ticket: TicketWithPages, how: TicketPaidOther) => void
  onChangeCharge: (ticket: TicketWithPages, toJobId: string) => void
  onLeave: (ticket: TicketWithPages) => void
  onPickJob: (ticket: TicketWithPages) => void
  /** An account ticket becomes a bill on Add invoice (PR 4); absent when the ticket's house is not known. */
  onRecordBill?: (ticket: TicketWithPages) => void
}

const press: CSSProperties = { padding: '0.3rem 0.55rem', minHeight: 32, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }
const lead: CSSProperties = { ...press, background: '#2563eb', color: '#fff', border: '1px solid #2563eb', fontWeight: 600 }
const select: CSSProperties = { ...press, maxWidth: '100%' }

const PAID_OTHER: ReadonlyArray<{ how: TicketPaidOther; words: string }> = [
  { how: 'cash', words: 'Cash' },
  { how: 'own_money', words: 'Their own money' },
  { how: 'another_card', words: 'Another card' },
  { how: 'other', words: 'Another way' },
]

export function TeamTicketsList(p: TeamTicketsListProps) {
  const [paidOpen, setPaidOpen] = useState<string | null>(null)
  if (p.rows.length === 0) return <EmptyState main="Nothing waiting on the tickets. A ticket shows here when it has no charge or disagrees with its sort." />
  return (
    <div data-testid="tally-team-tickets" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {p.rows.map((r) => {
        const t = r.ticket
        const busy = p.busyId === t.id
        const labelOf = (jobId: string) => p.jobs.get(jobId)?.label ?? 'a job'
        return (
          <div key={t.id} data-testid="tally-team-ticket-row" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.7rem', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.8125rem' }}>
              <div style={{ minWidth: 0 }}>
                <strong>{t.taken_by_name || 'Someone'}</strong>
                <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{ticketWhenLine(t, t.counter_ticket_pages.length)}</span>
                <div style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{ticketJobLine(t, p.jobs)}</div>
                <div style={{ color: 'var(--text-700)', fontSize: '0.75rem' }}>{officeTicketWhyWords(r, { ticketJob: t.job_id ? labelOf(t.job_id) : null, sortedJobs: r.sortedJobIds.map(labelOf) })}</div>
                {t.total !== null ? <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Total typed: ${t.total.toFixed(2)}</div> : null}
                {t.note ? <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', wordBreak: 'break-word' }}>{t.note}</div> : null}
              </div>
              <button type="button" style={press} onClick={() => p.onOpen(t)}>
                Open
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', marginTop: '0.45rem' }}>
              {r.why === 'asked' && r.chargeId ? (
                <>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-700)' }}>{p.chargeWords(r.chargeId)}</span>
                  <button type="button" style={lead} disabled={busy} onClick={() => p.onAnswer(t, r.chargeId!, true)}>
                    It is
                  </button>
                  <button type="button" style={press} disabled={busy} onClick={() => p.onAnswer(t, r.chargeId!, false)}>
                    It is not
                  </button>
                </>
              ) : null}
              {r.why === 'asked' && !r.chargeId ? (
                <select aria-label={`The charge for ${t.taken_by_name || 'this'} ticket`} style={select} disabled={busy} value="" onChange={(e) => e.target.value && p.onPickCharge(t, e.target.value)}>
                  <option value="">Pick the charge</option>
                  {r.fitChargeIds.map((id) => (
                    <option key={id} value={id}>
                      {p.chargeWords(id)}
                    </option>
                  ))}
                </select>
              ) : null}
              {r.why === 'disagrees' && t.job_id ? (
                <>
                  <button type="button" style={lead} disabled={busy} onClick={() => p.onChangeCharge(t, t.job_id!)}>
                    Change it to {labelOf(t.job_id)}
                  </button>
                  <button type="button" style={press} disabled={busy} onClick={() => p.onLeave(t)}>
                    Leave it on {r.sortedJobIds.map(labelOf).join(' and ')}
                  </button>
                </>
              ) : null}
              {r.why === 'no_job' || r.why === 'not_one_job' ? (
                <button type="button" style={lead} disabled={busy} onClick={() => p.onPickJob(t)}>
                  Pick a job
                </button>
              ) : null}
              {r.why === 'on_account' && p.onRecordBill ? (
                <button type="button" style={lead} disabled={busy} onClick={() => p.onRecordBill!(t)}>
                  Record as a bill
                </button>
              ) : null}
              {r.why === 'no_charge' || r.why === 'no_job' || r.why === 'not_one_job' || r.why === 'on_account' ? (
                <>
                  <select aria-label={`A charge for ${t.taken_by_name || 'this'} ticket`} style={select} disabled={busy} value="" onChange={(e) => e.target.value && p.onPickCharge(t, e.target.value)}>
                    <option value="">Pick the charge…</option>
                    {p.chargesFor(t).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.words}
                      </option>
                    ))}
                  </select>
                  {paidOpen === t.id ? (
                    PAID_OTHER.map((o) => (
                      <button key={o.how} type="button" style={press} disabled={busy} onClick={() => p.onPaidOther(t, o.how)}>
                        {o.words}
                      </button>
                    ))
                  ) : (
                    <button type="button" style={press} disabled={busy} onClick={() => setPaidOpen(t.id)}>
                      Paid another way…
                    </button>
                  )}
                </>
              ) : null}
              {busy ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Saving…</span> : null}
            </div>
            <div style={{ marginTop: '0.3rem', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{ticketStateWords(t)}</div>
          </div>
        )
      })}
    </div>
  )
}
