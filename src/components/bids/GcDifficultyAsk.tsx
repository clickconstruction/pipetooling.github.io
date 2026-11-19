/**
 * The ask at the end of a job (punch list #357, PR 5): when a job with a GC reaches Ready to bill, its master is
 * asked once how the GC was to work with, on the master's sheet. Two doors, one answer:
 *
 * - `GcDifficultyAskLine`, a line in the job's own window while that job's ask is open;
 * - `GcDifficultyAsksPress`, a press on the Bid Board's tools row that draws only with something to rate, and opens
 *   the short list of GCs.
 *
 * *Rate them* opens the sheet with the job named; a save answers every open ask for that GC. *Not now* puts the ask
 * away for good, for those jobs, and says so. Nothing draws for anyone with no open ask.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useToastContext } from '../../contexts/ToastContext'
import { useOptionalAuth } from '../../hooks/useAuth'
import { useDifficultyPrice } from '../../hooks/useDifficultyPrice'
import { useGcDifficultyAsks } from '../../hooks/useGcDifficultyAsks'
import { GC_DIFFICULTY_ASK_WORDS as W, gcDifficultyAskForJob, gcDifficultyAskGroups, type GcDifficultyOpenAsk } from '../../lib/bids/gcDifficultyAsk'
import type { GcDifficultyAskIo } from '../../lib/bids/gcDifficultyAskIo'
import { difficultyCanRate } from '../../lib/bids/difficultyPrice'
import type { RateSheetIo } from '../../lib/bids/difficultyRateSheetIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { PhoneSheet } from '../PhoneSheet'
import DifficultyRateSheet from './DifficultyRateSheet'

const QUIET: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }
const RATE: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, minHeight: 44, padding: '0 0.8rem', border: 0, borderRadius: 8, background: '#2563eb', color: '#fff', cursor: 'pointer' }
const NOT_NOW: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, minHeight: 44, padding: '0 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }

/** Who is ever asked: a job's master, and a dev walking a test job. Everyone else makes no read. */
function mayBeAsked(role: string | null | undefined): boolean {
  return role === 'master_technician' || role === 'dev'
}

/**
 * Whether the ask draws for this person: they are someone who is asked, and the price list lets them rate
 * (`difficultyCanRate`, the one answer every rating press asks; v2.7468). With the masters taken off the list an ask
 * could only open a sheet that cannot save, so it waits unseen until they are named again.
 */
function useAsked(role: string | null | undefined): boolean {
  const asked = mayBeAsked(role)
  const price = useDifficultyPrice(asked)
  return asked && difficultyCanRate(price?.body ?? null, role)
}

/** The sheet for a set of open asks about one GC: a save answers them, *Not now* puts them away. */
function AskSheet({ asks, io, sheetIo, onClose }: { asks: readonly GcDifficultyOpenAsk[]; io: GcDifficultyAskIo; sheetIo?: RateSheetIo; onClose: () => void }) {
  const { showToast } = useToastContext()
  const role = useOptionalAuth()?.role
  const newest = asks[0]
  if (!newest) return null
  const putAway = async () => {
    try {
      await io.dismiss(asks)
      showToast(W.putAway(newest.customerName), 'info')
    } catch (e) {
      showToast(formatErrorMessage(e, W.putAwayFailed), 'error')
    }
    onClose()
  }
  return createPortal(
    <DifficultyRateSheet
      customerId={newest.customerId}
      customerName={newest.customerName}
      ask={{ jobLabel: newest.jobLabel }}
      role={role}
      io={sheetIo}
      onClose={onClose}
      onNotNow={() => void putAway()}
      onSaved={(rating) => {
        // The rating is saved; the answer row is its record. A refusal here leaves the ask to drop on its own, since a rating now stands.
        void io.answer(asks, rating.id).catch(() => {})
      }}
    />,
    document.body,
  )
}

/** In the job's window: this job's own ask, while it is open. */
export function GcDifficultyAskLine({ jobId, io, sheetIo }: { jobId: string | null | undefined; io?: GcDifficultyAskIo; sheetIo?: RateSheetIo }) {
  const { showToast } = useToastContext()
  const role = useOptionalAuth()?.role
  const asked = useAsked(role)
  const state = useGcDifficultyAsks(!!jobId && asked, io)
  const ask = gcDifficultyAskForJob(state.asks, jobId)
  const [open, setOpen] = useState(false)
  if (!ask) return null
  const putAway = async () => {
    try {
      await state.io.dismiss([ask])
      showToast(W.putAway(ask.customerName), 'info')
    } catch (e) {
      showToast(formatErrorMessage(e, W.putAwayFailed), 'error')
    }
  }
  return (
    <div data-testid="gc-difficulty-ask-line" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem 0.75rem', flexWrap: 'wrap', margin: '0.5rem 0', border: '1px solid var(--border)', background: 'var(--bg-subtle)', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.875rem', color: 'var(--text-base)' }}>
      <span style={{ flex: '1 1 14rem', minWidth: 0 }}>{W.jobLine(ask.customerName)}</span>
      <button type="button" style={RATE} onClick={() => setOpen(true)}>
        {W.rate}
      </button>
      <button type="button" style={NOT_NOW} onClick={() => void putAway()}>
        {W.notNow}
      </button>
      {open ? <AskSheet asks={[ask]} io={state.io} sheetIo={sheetIo} onClose={() => setOpen(false)} /> : null}
    </div>
  )
}

/** On the Bid Board's tools row: nothing with no open ask, else the press and the short list behind it. */
export function GcDifficultyAsksPress({ style, io, sheetIo, onOpenChange }: { style?: CSSProperties; io?: GcDifficultyAskIo; sheetIo?: RateSheetIo; onOpenChange?: (open: boolean) => void }) {
  const { showToast } = useToastContext()
  const role = useOptionalAuth()?.role
  const asked = useAsked(role)
  const state = useGcDifficultyAsks(asked, io)
  const groups = gcDifficultyAskGroups(state.asks)
  const [listOpen, setListOpen] = useState(false)
  const [rating, setRating] = useState<string | null>(null)
  // The row that holds the press lays itself out by whether it draws (v2.7927).
  const draws = groups.length > 0
  useEffect(() => {
    onOpenChange?.(draws)
  }, [draws, onOpenChange])
  if (!draws) return null
  const ratingGroup = groups.find((g) => g.customerId === rating) ?? null
  const putAway = async (customerId: string) => {
    const g = groups.find((x) => x.customerId === customerId)
    if (!g) return
    try {
      await state.io.dismiss(g.asks)
      showToast(W.putAway(g.customerName), 'info')
    } catch (e) {
      showToast(formatErrorMessage(e, W.putAwayFailed), 'error')
    }
  }
  return (
    <>
      <button type="button" data-testid="gc-difficulty-asks-press" onClick={() => setListOpen(true)} style={style}>
        {W.boardPress(groups.length)}
      </button>
      {listOpen && !ratingGroup ? (
        <PhoneSheet label={W.listTitle} title={W.listTitle} width={460} onClose={() => setListOpen(false)}>
          <div style={{ padding: '0.75rem 1rem 1rem', overflowY: 'auto', display: 'grid', gap: '0.75rem', minHeight: 0 }}>
            <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.45, color: 'var(--text-base)' }}>{W.listLead}</p>
            {groups.map((g) => (
              <div key={g.customerId} data-gc-difficulty-ask={g.customerId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem 0.75rem', flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: 8, padding: '0.55rem 0.75rem' }}>
                <span style={{ flex: '1 1 12rem', minWidth: 0, display: 'grid', gap: '0.1rem' }}>
                  <b style={{ color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.customerName.trim() || 'A GC'}</b>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{W.groupLine(g)}</span>
                </span>
                <button type="button" style={RATE} aria-label={`${W.rate}: ${g.customerName}`} onClick={() => setRating(g.customerId)}>
                  {W.rate}
                </button>
                <button type="button" style={{ ...QUIET, minHeight: 44 }} aria-label={`${W.notNow}: ${g.customerName}`} onClick={() => void putAway(g.customerId)}>
                  {W.notNow}
                </button>
              </div>
            ))}
          </div>
        </PhoneSheet>
      ) : null}
      {ratingGroup ? <AskSheet asks={ratingGroup.asks} io={state.io} sheetIo={sheetIo} onClose={() => setRating(null)} /> : null}
    </>
  )
}
