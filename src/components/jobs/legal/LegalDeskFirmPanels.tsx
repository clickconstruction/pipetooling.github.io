import { useState, type CSSProperties } from 'react'

import { formatLegalMoney } from '../../../lib/legal/legalPacket'

import type { LegalEntryRow } from '../../../lib/legal/legalMatters'

import { calendarYmdInAppTzFromIso } from '../../../utils/dateUtils'

import { isVoidedEntry } from '../../../../supabase/functions/_shared/legalPortalActs'

import { OFFER_NEXT_STATUSES, isOfferEntry, offerDraftProblem, offerKindWords, offerMetaOf, offerStatusWords, type LegalOfferDraft, type OfferStatus } from '../../../lib/legal/legalOffers'

import { MUTED, btn, btnPrimary, SectionTitle, Table, type EntryLike } from './legalDeskShared'
import { EmptyState } from '../../EmptyState'
import { emptyWords, emptyWordsWithPress } from '../../../lib/emptyWords'

/**
 * The With-the-firm panels (v2.5852, the split): the offers log, a settlement ask's answer (an ask from before v2.6170
 * retired the floor), and the undo and voided-text pieces the tabs share. Split out of `LegalDesk.tsx` (`LegalDeskModal.tsx` until punch list #182).
 */
/** #85 item 20: the office's answer to a settlement ask from before v2.6170 retired the floor — sign off moves the stage to settled. */
/**
 * Offers (punch list #172, v2.5847): the log of offers made and received while the office runs the case or the
 * firm has it — the day, who, the amount, the day it expires, the status — and *Log an offer…*. An open offer's
 * expiry day sits on the Timeline; the status buttons move an open one on. Undo strikes a mistaken one.
 */
export function OffersPanel({ entries, todayYmd, busy, onAdd, onStatus, onUndo }: { entries: ReadonlyArray<EntryLike>; todayYmd: string; busy: boolean; onAdd: (d: LegalOfferDraft) => Promise<boolean>; onStatus: (entryId: string, status: OfferStatus, note: string) => Promise<boolean>; onUndo: (entryId: string, reason: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState<LegalOfferDraft | null>(null)
  const offers = entries.filter(isOfferEntry).slice().sort((a, b) => a.occurred_on.localeCompare(b.occurred_on) || a.created_at.localeCompare(b.created_at))
  const problem = draft ? offerDraftProblem(draft, todayYmd) : null
  const input: CSSProperties = { font: 'inherit', fontSize: '0.8rem', padding: '3px 7px', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', minWidth: 0 }
  const startDraft = () => setDraft({ direction: 'received', amountText: '', on: todayYmd, expiresOn: '', notes: '' })
  // Empty words (punch list #184, sweep C): the log's own door, offered again while no form is open.
  const noOffers = emptyWords({ kind: 'make', noun: 'offers', control: 'Log an offer…' })
  const save = async () => {
    if (!draft || problem) return
    if (await onAdd(draft)) setDraft(null)
  }
  return (
    <div data-legal-offers style={{ margin: '0 0 14px', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <b style={{ fontSize: '0.86rem' }}>Offers</b>
        <span style={{ ...MUTED, fontSize: '0.78rem' }}>made or received · an open offer’s expiry day sits on the Timeline · the firm reads them on its portal</span>
        {!draft ? <button type="button" onClick={startDraft} style={{ ...btn, marginLeft: 'auto' }} data-legal-offer-add>Log an offer…</button> : null}
      </div>
      {draft ? (
        <form data-legal-offer-form onSubmit={(e) => { e.preventDefault(); void save() }} style={{ display: 'grid', gap: 6, padding: '8px', border: '1px dashed var(--border-strong)', borderRadius: 6 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.78rem' }}>
            <select aria-label="Made or received" value={draft.direction} onChange={(e) => setDraft({ ...draft, direction: e.target.value === 'made' ? 'made' : 'received' })} style={input}><option value="received">They offered</option><option value="made">We offered</option></select>
            <input aria-label="Offer amount" inputMode="decimal" value={draft.amountText} placeholder="$ amount" onChange={(e) => setDraft({ ...draft, amountText: e.target.value })} style={{ ...input, width: 110 }} />
            <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center', ...MUTED }}>On<input type="date" aria-label="Day of the offer" value={draft.on} max={todayYmd} onChange={(e) => setDraft({ ...draft, on: e.target.value })} style={input} /></label>
            <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center', ...MUTED }}>Expires<input type="date" aria-label="Day the offer expires" value={draft.expiresOn} onChange={(e) => setDraft({ ...draft, expiresOn: e.target.value })} style={input} /></label>
          </div>
          <input aria-label="Offer notes" value={draft.notes} placeholder="Terms, who said it, what it covers" onChange={(e) => setDraft({ ...draft, notes: e.target.value })} style={input} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="submit" disabled={busy || Boolean(problem)} style={{ ...btnPrimary, opacity: busy || problem ? 0.6 : 1 }}>Log the offer</button>
            <button type="button" onClick={() => setDraft(null)} style={btn}>Cancel</button>
            {problem && (draft.amountText || draft.expiresOn) ? <span style={{ ...MUTED, fontSize: '0.76rem' }}>{problem}</span> : null}
          </div>
        </form>
      ) : null}
      {offers.length ? (
        <Table head={['Day', 'Offer', 'Amount', 'Expires', 'Status', '']} numCols={[2]} rows={offers.map((e) => {
          const meta = offerMetaOf(e.meta)
          const struck = isVoidedEntry(e)
          return [
            e.occurred_on,
            <span key="k" style={struck ? { textDecoration: 'line-through', color: 'var(--text-muted)' } : undefined}>{offerKindWords(meta)}{meta.notes ? <span style={{ ...MUTED }}> · {meta.notes}</span> : null}</span>,
            <span key="a" style={struck ? { textDecoration: 'line-through', color: 'var(--text-muted)' } : undefined}>{formatLegalMoney(Number(e.amount ?? 0))}</span>,
            meta.expiresOn ?? '—',
            <span key="s" data-legal-offer-status={meta.status}>{struck ? `Undone${e.void_reason ? `: ${e.void_reason}` : ''}` : offerStatusWords(meta.status)}{meta.statusNote ? <span style={MUTED}> · {meta.statusNote}</span> : null}</span>,
            !struck && meta.status === 'open' ? (
              <span key="b" style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
                {OFFER_NEXT_STATUSES.map((s) => <button key={s} type="button" disabled={busy} onClick={() => void onStatus(e.id, s, '')} style={btn}>{offerStatusWords(s)}</button>)}
                <DeskUndo onUndo={(reason) => onUndo(e.id, reason)} />
              </span>
            ) : !struck ? <DeskUndo key="u" onUndo={(reason) => onUndo(e.id, reason)} /> : '',
          ]
        })} empty="" />
      ) : <EmptyState compact {...(draft ? { main: noOffers.main } : emptyWordsWithPress(noOffers, { onPress: startDraft }))} />}
    </div>
  )
}

export function SettlementAnswer({ busy, onAnswer }: { busy: boolean; onAnswer: (signedOff: boolean, note: string) => Promise<void> }) {
  const [note, setNote] = useState('')
  return (
    <span data-legal-settlement-answer style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" disabled={busy} onClick={() => void onAnswer(true, note)} style={btnPrimary}>Sign off</button>
      <button type="button" disabled={busy} onClick={() => void onAnswer(false, note)} style={btn}>Not yet</button>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="a note for the firm (optional)" aria-label="A note for the firm" style={{ font: 'inherit', fontSize: '0.8rem', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', width: 180 }} />
    </span>
  )
}

/** #85 item 18: an entry's text, struck through with who undid it and why once it is voided. */
export function DeskVoidableText({ e }: { e: Pick<LegalEntryRow, 'body' | 'voided_at' | 'voided_via_portal' | 'void_reason'> }) {
  if (!e.voided_at) return <>{e.body}</>
  return (
    <span data-legal-voided>
      <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>{e.body}</span>
      <span style={{ ...MUTED, display: 'block', fontSize: '0.74rem' }}>undone by {e.voided_via_portal ? 'the firm' : 'the office'} {calendarYmdInAppTzFromIso(e.voided_at)}{e.void_reason ? `: ${e.void_reason}` : ''}</span>
    </span>
  )
}

/** #85 item 18: Undo… with a reason; the entry stays on the record, out of every total. */
export function DeskUndo({ onUndo }: { onUndo: (reason: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={btn}>Undo…</button>
  return (
    <span data-legal-undo style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why (the firm sees it)" aria-label="Why you are undoing it" style={{ font: 'inherit', fontSize: '0.8rem', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', width: 170 }} />
      <button type="button" disabled={!reason.trim()} onClick={() => void onUndo(reason.trim()).then((ok) => { if (ok) setOpen(false) })} style={btnPrimary}>Undo it</button>
      <button type="button" onClick={() => setOpen(false)} style={btn}>Cancel</button>
    </span>
  )
}

/** The desk's preview of the firm's documents (v2.4810): the ones not held, without links; the held ones as the count the firm sees. */
