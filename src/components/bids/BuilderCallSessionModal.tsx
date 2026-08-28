import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import type { Database } from '../../types/database'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { ModalShell } from './ModalShell'
import { formatBidNameWithValue, formatDateYYMMDD, formatTimeSinceLastContact } from '../../lib/bids/bidFormatting'
import { getSubmissionSectionKey } from '../../lib/bids/submissionSections'
import {
  buildCallSessionWrites,
  callSessionAskPrompt,
  callSessionOutcomeLabel,
  nextFollowupQuickPickIso,
  type CallSessionBidDecision,
  type CallSessionOutcome,
} from '../../lib/bids/builderCallSession'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { BID_UPDATE_NOT_APPLIED_MESSAGE, updateApplied } from '../../lib/bids/updateGuard'
import { BID_LOSS_CATEGORIES } from '../../lib/bidLossCategories'
import { bidTabSummary, bidTabValuesFromRow, hasAnyBidTabValue } from '../../lib/bidTabCapture'
import { BidTabCapturePanel } from './BidTabCapturePanel'

type Customer = Database['public']['Tables']['customers']['Row']
type CustomerContactPerson = Database['public']['Tables']['customer_contact_persons']['Row']

/**
 * Followup Phase 3 (v2.1389): the "GC on the phone" screen. Walk every open
 * bid with one-tap outcomes, one call-summary note, then promise the next
 * follow-up before hangup. Saving = one customer contact + an entry and
 * last_contact stamp per touched bid + outcome updates + the promised date
 * (customer_followup_prefs.next_followup_at) that reorders the call queue.
 */

const OUTCOME_PILLS: Array<{ key: CallSessionOutcome; label: string; color?: string }> = [
  { key: 'still_pending', label: 'Still pending' },
  { key: 'won', label: 'Won', color: 'var(--text-green-600)' },
  { key: 'lost', label: 'Lost…', color: 'var(--text-red-600)' },
  { key: 'rebid', label: 'Rebid / RFQ' },
]

export function BuilderCallSessionModal({
  customer,
  openBids,
  contactPersons,
  lastContactIso,
  hitRatePct,
  authUserId,
  onClose,
  onSaved,
  onError,
}: {
  customer: Customer
  openBids: BidWithBuilder[]
  contactPersons: CustomerContactPerson[]
  lastContactIso: string | null
  hitRatePct: number | null
  authUserId: string
  onClose: () => void
  onSaved: () => void
  onError: (msg: string | null) => void
}) {
  const confirmDialog = useConfirmDialog()
  const discardConfirmOpenRef = useRef(false)
  const [decisions, setDecisions] = useState<Record<string, CallSessionBidDecision>>(() =>
    Object.fromEntries(openBids.map((b) => [b.id, { bidId: b.id, outcome: null, note: '', lossReason: '', lossCategory: null }])),
  )
  const [summary, setSummary] = useState('')
  const [followupPick, setFollowupPick] = useState<'tomorrow' | 'next-week' | 'two-weeks' | 'none' | 'custom'>('next-week')
  const [followupCustomDate, setFollowupCustomDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [tabOpenBidId, setTabOpenBidId] = useState<string | null>(null)
  // One instant per mount keeps the ask prompts on the same clock.
  const nowIso = useMemo(() => new Date().toISOString(), [])

  const touchedCount = useMemo(
    () =>
      Object.values(decisions).filter(
        (d) => d.outcome !== null || d.note.trim() !== '' || (d.tab != null && hasAnyBidTabValue(d.tab)),
      ).length,
    [decisions],
  )
  const dirty = touchedCount > 0 || summary.trim() !== ''

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // While the discard confirm is up, let the dialog's own Escape handling settle it.
      if (discardConfirmOpenRef.current) return
      e.stopPropagation()
      if (!dirty) {
        onClose()
        return
      }
      discardConfirmOpenRef.current = true
      void confirmDialog({
        message: 'Discard this call session? Nothing has been saved.',
        confirmLabel: 'Discard',
        danger: true,
      }).then((ok) => {
        discardConfirmOpenRef.current = false
        if (ok) onClose()
      })
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [dirty, onClose, confirmDialog])

  const setDecision = (bidId: string, patch: Partial<CallSessionBidDecision>) => {
    setDecisions((prev) => ({ ...prev, [bidId]: { ...(prev[bidId] ?? { bidId, outcome: null, note: '', lossReason: '', lossCategory: null }), ...patch } }))
  }

  const resolveNextFollowupIso = (): string | null | 'invalid' => {
    if (followupPick === 'none') return null
    if (followupPick === 'custom') {
      if (!followupCustomDate) return 'invalid'
      const d = new Date(`${followupCustomDate}T08:00:00`)
      if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) return 'invalid'
      return d.toISOString()
    }
    return nextFollowupQuickPickIso(followupPick, new Date())
  }

  async function save() {
    const nextFollowupAt = resolveNextFollowupIso()
    if (nextFollowupAt === 'invalid') {
      onError('Pick a future date for the next follow-up (or choose No date).')
      return
    }
    setSaving(true)
    try {
      const writes = buildCallSessionWrites({
        customerId: customer.id,
        userId: authUserId,
        nowIso: new Date().toISOString(),
        summary,
        decisions: Object.values(decisions),
      })
      await withSupabaseRetry(async () => supabase.from('customer_contacts').insert(writes.customerContact), 'call session: contact')
      if (writes.bidEntries.length > 0) {
        await withSupabaseRetry(async () => supabase.from('bids_submission_entries').insert(writes.bidEntries), 'call session: entries')
      }
      // Per-GC Phase 1: the entry inserts above fire the last_contact sync trigger — no hand-stamps.
      for (const u of writes.bidOutcomeUpdates) {
        const rows = await withSupabaseRetry(
          async () => supabase.from('bids').update({ outcome: u.outcome, loss_reason: u.loss_reason, loss_category: u.loss_category }).eq('id', u.bidId).select('id'),
          'call session: outcome',
        )
        if (!updateApplied(rows)) throw new Error(BID_UPDATE_NOT_APPLIED_MESSAGE)
      }
      for (const u of writes.bidTabUpdates) {
        const rows = await withSupabaseRetry(async () => supabase.from('bids').update(u.patch).eq('id', u.bidId).select('id'), 'call session: bid tab')
        if (!updateApplied(rows)) throw new Error(BID_UPDATE_NOT_APPLIED_MESSAGE)
      }
      await withSupabaseRetry(
        async () =>
          // Not in generated types until regen — established cast precedent.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any).from('customer_followup_prefs').upsert(
            { customer_id: customer.id, next_followup_at: nextFollowupAt, updated_at: new Date().toISOString() },
            { onConflict: 'customer_id' },
          ),
        'call session: next follow-up',
      )
      onSaved()
    } catch (e: unknown) {
      onError(formatErrorMessage(e, 'Failed to save the call session'))
    } finally {
      setSaving(false)
    }
  }

  const primaryPerson = contactPersons.find((p) => (p.phone ?? '').trim() !== '') ?? contactPersons[0] ?? null
  const primaryPhone = primaryPerson ? (primaryPerson.phone ?? '').split('\n').filter(Boolean)[0] ?? null : null

  return (
    <ModalShell
      zIndex={1100}
      cardStyle={{
        background: 'var(--surface)',
        padding: '1.25rem 1.4rem',
        borderRadius: 10,
        maxWidth: 860,
        width: '95%',
        maxHeight: 'min(90vh, 100%)',
        overflow: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'var(--bg-blue-tint)', border: '1px solid var(--bg-blue-200)', borderRadius: 10, padding: '0.7rem 0.9rem', marginBottom: '0.9rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 800, fontSize: '1.02rem' }}>📞 {customer.name}</span>
        {primaryPerson && (
          <span style={{ fontWeight: 600, color: 'var(--text-blue-700)' }}>
            {primaryPerson.name}
            {primaryPhone && (
              <>
                {' · '}
                <a href={`tel:${primaryPhone}`} style={{ color: 'var(--text-blue-700)' }}>
                  {primaryPhone}
                </a>
              </>
            )}
          </span>
        )}
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {openBids.length} open bid{openBids.length === 1 ? '' : 's'}
          {lastContactIso ? ` · last contact ${formatTimeSinceLastContact(lastContactIso)}` : ''}
          {hitRatePct !== null ? ` · win rate ${hitRatePct}%` : ''}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {touchedCount} of {openBids.length} reviewed
        </span>
      </div>

      {openBids.length === 0 && (
        <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          No open bids — the call still logs to the builder's contact history.
        </div>
      )}
      {openBids.map((bid) => {
        const d = decisions[bid.id] ?? { bidId: bid.id, outcome: null, note: '', lossReason: '', lossCategory: null }
        const sectionKey = getSubmissionSectionKey(bid)
        return (
          <div key={bid.id} style={{ border: '1px solid var(--border)', borderRadius: 9, marginBottom: '0.55rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', padding: '0.5rem 0.8rem', background: 'var(--bg-subtle)', fontSize: '0.9rem', flexWrap: 'wrap' }}>
              <span style={{ flex: 1, fontWeight: 700, minWidth: 0 }}>{formatBidNameWithValue(bid)}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {sectionKey === 'unsent' ? `unsent · due ${formatDateYYMMDD(bid.bid_due_date)}` : `sent ${formatDateYYMMDD(bid.bid_date_sent)}`}
              </span>
              {(() => {
                const prompt = callSessionAskPrompt({
                  sentIso: bid.bid_date_sent,
                  lastContactIso: bid.last_contact,
                  hasTab: bidTabValuesFromRow(bid).low != null,
                  nowIso,
                })
                return prompt ? (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{prompt}</span>
                ) : null
              })()}
              {d.outcome !== null && (
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: d.outcome === 'lost' ? 'var(--text-red-600)' : 'var(--text-green-600)', whiteSpace: 'nowrap' }}>
                  ✓ {callSessionOutcomeLabel(d)}
                </span>
              )}
            </div>
            <div style={{ padding: '0.5rem 0.8rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {OUTCOME_PILLS.map((p) => {
                const selected = d.outcome === p.key
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setDecision(bid.id, { outcome: selected ? null : p.key })}
                    style={{
                      fontSize: '0.78rem',
                      padding: '0.28rem 0.7rem',
                      borderRadius: 999,
                      border: '1px solid ' + (selected ? '#d97706' : 'var(--border-strong)'),
                      background: selected ? '#d97706' : 'var(--surface)',
                      color: selected ? 'white' : (p.color ?? 'var(--text-700)'),
                      fontWeight: selected ? 700 : 400,
                      cursor: 'pointer',
                    }}
                  >
                    {p.label}
                  </button>
                )
              })}
              {d.outcome === 'lost' && (
                <>
                  <span style={{ flexBasis: '100%', height: 0 }} aria-hidden />
                  {BID_LOSS_CATEGORIES.map((c) => {
                    const selected = d.lossCategory === c.key
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setDecision(bid.id, { lossCategory: selected ? null : c.key })}
                        aria-pressed={selected}
                        style={{
                          fontSize: '0.74rem',
                          padding: '0.22rem 0.6rem',
                          borderRadius: 999,
                          cursor: 'pointer',
                          background: c.chipBg,
                          color: c.chipFg,
                          border: `1.5px solid ${selected ? c.chipFg : 'transparent'}`,
                          fontWeight: selected ? 700 : 400,
                        }}
                      >
                        {c.label}
                      </button>
                    )
                  })}
                  <input
                    type="text"
                    value={d.lossReason}
                    onChange={(e) => setDecision(bid.id, { lossReason: e.target.value })}
                    placeholder="loss detail (what they said…)"
                    style={{ minWidth: 140, padding: '0.32rem 0.5rem', border: '1px solid var(--text-red-600)', borderRadius: 6, fontSize: '0.8rem' }}
                  />
                </>
              )}
              <button
                type="button"
                onClick={() => setTabOpenBidId(tabOpenBidId === bid.id ? null : bid.id)}
                aria-pressed={tabOpenBidId === bid.id}
                title="Record the bid tab the GC reads you — saved with End call"
                style={{
                  fontSize: '0.78rem',
                  padding: '0.28rem 0.7rem',
                  borderRadius: 999,
                  border: `1px solid ${tabOpenBidId === bid.id ? 'var(--text-link)' : 'var(--border-strong)'}`,
                  background: 'var(--surface)',
                  color: 'var(--text-700)',
                  cursor: 'pointer',
                }}
              >
                Bid tab…
              </button>
              <input
                type="text"
                value={d.note}
                onChange={(e) => setDecision(bid.id, { note: e.target.value })}
                placeholder="note for this bid (optional)"
                style={{ flex: 1, minWidth: 150, padding: '0.32rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.8rem' }}
              />
            </div>
            {(() => {
              const buffered = d.tab != null && hasAnyBidTabValue(d.tab) ? d.tab : null
              const onFile = bidTabValuesFromRow(bid)
              const ourValue = Number(bid.bid_value) || 0
              if (tabOpenBidId === bid.id) {
                return (
                  <div style={{ padding: '0 0.8rem 0.6rem' }}>
                    <BidTabCapturePanel
                      key={bid.id}
                      ourValue={ourValue}
                      initial={buffered ?? onFile}
                      saving={false}
                      onSave={(values) => {
                        setDecision(bid.id, { tab: values, bidValue: ourValue })
                        setTabOpenBidId(null)
                      }}
                      secondaryLabel="Cancel"
                      onSecondary={() => setTabOpenBidId(null)}
                      allowPaste={false}
                    />
                  </div>
                )
              }
              if (buffered) {
                return (
                  <p style={{ margin: '0 0 0.55rem', padding: '0 0.8rem', fontSize: '0.78rem', color: 'var(--text-emerald-800)' }}>
                    {'✓'} bid tab noted — {bidTabSummary(buffered, ourValue)} <span style={{ color: 'var(--text-muted)' }}>(saved with End call)</span>
                  </p>
                )
              }
              if (hasAnyBidTabValue(onFile)) {
                return (
                  <p style={{ margin: '0 0 0.55rem', padding: '0 0.8rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    bid tab on file — {bidTabSummary(onFile, ourValue)}
                  </p>
                )
              }
              return null
            })()}
          </div>
        )
      })}

      <input
        type="text"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="Call summary — one note for the whole call…"
        style={{ width: '100%', boxSizing: 'border-box', padding: '0.55rem 0.65rem', border: '1px solid var(--border-strong)', borderRadius: 8, fontSize: '0.9rem', margin: '0.5rem 0 0.8rem' }}
      />

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--bg-green-100)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.65rem 0.9rem', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '0.9rem' }}>Next follow-up:</strong>
        {(
          [
            { key: 'tomorrow', label: 'Tomorrow' },
            { key: 'next-week', label: 'Next week' },
            { key: 'two-weeks', label: 'In 2 weeks' },
            { key: 'custom', label: 'Custom…' },
            { key: 'none', label: 'No date' },
          ] as const
        ).map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setFollowupPick(p.key)}
            style={{
              fontSize: '0.78rem',
              padding: '0.28rem 0.7rem',
              borderRadius: 999,
              border: '1px solid ' + (followupPick === p.key ? '#d97706' : 'var(--border-strong)'),
              background: followupPick === p.key ? '#d97706' : 'var(--surface)',
              color: followupPick === p.key ? 'white' : 'var(--text-700)',
              fontWeight: followupPick === p.key ? 700 : 400,
              cursor: 'pointer',
            }}
          >
            {p.label}
          </button>
        ))}
        {followupPick === 'custom' && (
          <input
            type="date"
            value={followupCustomDate}
            onChange={(e) => setFollowupCustomDate(e.target.value)}
            aria-label="Next follow-up date"
            style={{ padding: '0.3rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.82rem' }}
          />
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              void (async () => {
                if (
                  !dirty ||
                  (await confirmDialog({
                    message: 'Discard this call session? Nothing has been saved.',
                    confirmLabel: 'Discard',
                    danger: true,
                  }))
                )
                  onClose()
              })()
            }
            style={{ padding: '0.45rem 0.9rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            style={{ padding: '0.45rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Saving…' : 'End call & save'}
          </button>
        </span>
      </div>
      <div style={{ marginTop: '0.5rem', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
        Saving writes one builder contact, a note per bid you touched, sets any outcomes you tapped, and re-queues this builder by the promised date.
      </div>
    </ModalShell>
  )
}
