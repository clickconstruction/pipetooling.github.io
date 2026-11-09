import { useCallback, useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../EmptyState'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { TicketWindow } from './TicketWindow'
import { useLedgerDisplayPrefixes } from '../../contexts/LedgerDisplayPrefixContext'
import { useOutbox } from '../../hooks/useOutbox'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { ticketJobIds, ticketState, ticketStateWords } from '../../lib/tickets/ticket'
import { onTicketsChanged } from '../../lib/tickets/ticketEvents'
import type { TicketJobFacts } from '../../lib/tickets/ticketJobs'
import { ticketJobLine, ticketWhenLine, ticketsOnPhoneWords } from '../../lib/tickets/ticketRowWords'
import { ticketScreensIo, type TicketScreensIo } from '../../lib/tickets/ticketScreensIo'
import type { TicketWithPages } from '../../lib/tickets/ticketsIo'

/**
 * **My tickets** (punch list #295, PR 2; the mock-up's frames D and E): the tickets a person took, newest first, each
 * with its job, when it was taken and where it stands (`ticketStateWords`). A ticket still on the phone is counted on
 * the line above the list; the waiting presses bar holds its Try now. A row opens the ticket (`TicketWindow`).
 */

type Read = { status: 'loading' | 'ready'; tickets: TicketWithPages[]; failure: OfflineRecoveryLastError | null }

export function MyTickets({ userId, io = ticketScreensIo }: { userId: string; io?: TicketScreensIo }) {
  const { prefixMap } = useLedgerDisplayPrefixes()
  const presses = useOutbox()
  const [read, setRead] = useState<Read>({ status: 'loading', tickets: [], failure: null })
  const [jobs, setJobs] = useState<ReadonlyMap<string, TicketJobFacts>>(new Map())
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setRead((r) => ({ ...r, status: 'loading', failure: null }))
    try {
      const tickets = await io.list(userId)
      setRead({ status: 'ready', tickets, failure: null })
      void io
        .jobFacts(tickets.flatMap(ticketJobIds), prefixMap)
        .then(setJobs)
        .catch(() => undefined)
    } catch (e) {
      setRead((r) => ({ status: 'ready', tickets: r.tickets, failure: recoveryFailureFromError(e, 'Your tickets did not load.') }))
    }
  }, [io, userId, prefixMap])

  useEffect(() => {
    void load()
    return onTicketsChanged(() => void load())
  }, [load])

  // The first page's picture for the newest few rows; a PDF draws its own tile.
  useEffect(() => {
    let live = true
    for (const t of read.tickets.slice(0, 10)) {
      const first = t.counter_ticket_pages[0]
      if (!first?.storage_path || first.mime === 'application/pdf' || thumbs[t.id]) continue
      void io.pageUrl(first.storage_path).then((url) => {
        if (live && url) setThumbs((cur) => (cur[t.id] ? cur : { ...cur, [t.id]: url }))
      })
    }
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [read.tickets, io])

  const onPhone = useMemo(() => presses.filter((p) => p.kind === 'counter-ticket' && p.userId === userId && (p.state === 'waiting' || p.state === 'sending')).length, [presses, userId])
  const onPhoneLine = ticketsOnPhoneWords(onPhone)
  const open = openId ? read.tickets.find((t) => t.id === openId) ?? null : null

  return (
    <section aria-label="My tickets" style={{ marginBottom: '1rem' }}>
      <h3 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', margin: '0 0 0.4rem' }}>My tickets</h3>
      {onPhoneLine ? (
        <div role="status" style={{ fontSize: '0.8125rem', color: 'var(--text-strong)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.6rem', marginBottom: '0.5rem', background: 'var(--surface)' }}>
          {onPhoneLine}
        </div>
      ) : null}
      {read.failure ? <OfflineRetryPanel failure={read.failure} onRetry={load} surface="tally-my-tickets" idempotent busy={read.status === 'loading'} /> : null}
      {read.status === 'loading' && read.tickets.length === 0 && !read.failure ? <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading your tickets…</div> : null}
      {read.status === 'ready' && !read.failure && read.tickets.length === 0 && onPhone === 0 ? <EmptyState compact main="No tickets yet. Photo of a ticket adds the first." /> : null}
      {read.tickets.map((t) => {
        const first = t.counter_ticket_pages[0]
        const state = ticketState(t)
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setOpenId(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%', textAlign: 'left', border: '1px solid var(--border)', borderRadius: 10, padding: '0.5rem 0.6rem', marginBottom: '0.45rem', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-strong)' }}
          >
            {thumbs[t.id] ? (
              <img src={thumbs[t.id]} alt="" style={{ flex: 'none', width: 40, height: 52, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
            ) : (
              <span aria-hidden style={{ flex: 'none', width: 40, height: 52, borderRadius: 6, border: '1px solid var(--border)', display: 'grid', placeItems: 'center', fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                {first?.mime === 'application/pdf' ? 'PDF' : ''}
              </span>
            )}
            <span style={{ flex: '1 1 auto', minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticketJobLine(t, jobs)}</span>
              <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{ticketWhenLine(t, t.counter_ticket_pages.length)}</span>
              <span style={{ display: 'block', fontSize: '0.75rem', color: state === 'matched' || state === 'billed' ? 'var(--text-green-700)' : 'var(--text-muted)' }}>{ticketStateWords(t)}</span>
            </span>
          </button>
        )
      })}
      {open ? <TicketWindow ticket={open} jobs={jobs} userId={userId} io={io} onClose={() => setOpenId(null)} onChanged={() => void load()} /> : null}
    </section>
  )
}
