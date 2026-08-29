import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import {
  allowedTransitions,
  parseCtRfiFlags,
  rfiAuditNote,
  type RfiRecipient,
  type RfiRow,
  type RfiSentVia,
  type RfiStatus,
} from '../../lib/bids/rfiFlow'
import { BID_UPDATE_NOT_APPLIED_MESSAGE, updateApplied } from '../../lib/bids/updateGuard'

/**
 * The per-bid RFI queue (RFI loop Phase R1, docs/RFI_LOOP_PLAN.md): drafts accumulate on
 * the bid (typed here, pasted from CountTooling's Copy RFI Flags, or agent-drafted —
 * twins are draft-only via RLS), a human approves with a per-RFI GC pick (default: all
 * bidding GCs), marks sent with the channel, and records the answer. The record is the
 * system of record; the transport (email / PlanHub / phone) varies. Every event stamps a
 * method-less bid note — the ledger is the loop's flight recorder (v2.2413 rule).
 */

const STATUS_STYLE: Record<RfiStatus, { bg: string; fg: string; label: string }> = {
  draft: { bg: 'var(--bg-muted)', fg: 'var(--text-muted)', label: 'Draft' },
  approved: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)', label: 'Approved' },
  sent: { bg: 'var(--bg-blue-tint, var(--bg-muted))', fg: 'var(--text-blue-700, var(--text-700))', label: 'Sent' },
  answered: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-800)', label: 'Answered' },
  withdrawn: { bg: 'var(--bg-muted)', fg: 'var(--text-muted)', label: 'Withdrawn' },
}

type GcOption = { gc_customer_id: string | null; name: string }

// bids_rfis reaches src/types/database.ts only with the post-push gen-types run; until
// then this untyped view keeps strict mode honest without hand-editing generated types.
const rfiDb = supabase as unknown as SupabaseClient

export function BidRfiQueue({ bid, authUser }: { bid: BidWithBuilder; authUser: User | null }) {
  const { showToast } = useToastContext()
  const [rfis, setRfis] = useState<RfiRow[]>([])
  const [loading, setLoading] = useState(true)
  const [gcOptions, setGcOptions] = useState<GcOption[]>([])
  const [newQuestion, setNewQuestion] = useState('')
  const [newSheetRef, setNewSheetRef] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [busy, setBusy] = useState(false)
  // Per-row transient UI: the GC pick for approve→send, the answer draft.
  const [sendPick, setSendPick] = useState<Record<string, { gcs: Record<string, boolean>; via: RfiSentVia }>>({})
  const [answerDraft, setAnswerDraft] = useState<Record<string, { answer: string; answer_ref: string }>>({})

  const loadRfis = useCallback(async () => {
    setLoading(true)
    try {
      const data = await withSupabaseRetry(
        () => rfiDb.from('bids_rfis').select('*').eq('bid_id', bid.id).order('rfi_number'),
        'load bid RFIs'
      )
      setRfis((data ?? []) as RfiRow[])
    } catch (e) {
      // Client ships ahead of the migration (useIsDigitalTwin pattern): a missing table
      // means "queue not provisioned yet", never a broken tab.
      const msg = e instanceof Error ? e.message : String(e)
      if (!/does not exist/i.test(msg)) showToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }, [bid.id, showToast])

  useEffect(() => {
    void loadRfis()
    // GC options: the bid's own GC + every "also sent to" recipient (per-RFI pick default = all).
    void (async () => {
      try {
        const recips = await withSupabaseRetry(
          () => supabase.from('bid_gc_recipients').select('customer_id, customers(name)').eq('bid_id', bid.id),
          'load bid GC recipients'
        )
        const opts: GcOption[] = []
        if (bid.customers?.name) opts.push({ gc_customer_id: bid.customer_id ?? null, name: bid.customers.name })
        for (const r of (recips ?? []) as Array<{ customer_id: string; customers: { name: string } | null }>) {
          if (r.customers?.name && !opts.some((o) => o.gc_customer_id === r.customer_id)) {
            opts.push({ gc_customer_id: r.customer_id, name: r.customers.name })
          }
        }
        setGcOptions(opts)
      } catch {
        setGcOptions(bid.customers?.name ? [{ gc_customer_id: bid.customer_id ?? null, name: bid.customers.name }] : [])
      }
    })()
  }, [bid.id, bid.customer_id, bid.customers?.name, loadRfis])

  const stampLedger = useCallback(
    async (text: string) => {
      try {
        await supabase.from('bids_submission_entries').insert({
          bid_id: bid.id,
          occurred_at: new Date().toISOString(),
          notes: text,
          created_by: authUser?.id ?? null,
        })
      } catch {
        /* the stamp is best-effort; the RFI row is the record */
      }
    },
    [bid.id, authUser?.id]
  )

  async function createDrafts(items: Array<{ question: string; sheet_ref: string | null; source: 'manual' | 'ct_note' }>) {
    setBusy(true)
    try {
      let created = 0
      for (const item of items) {
        // The DB trigger assigns rfi_number; a raced duplicate violates the unique
        // constraint — retry once (idempotency rule: re-runs must never renumber silently).
        for (let attempt = 0; attempt < 2; attempt++) {
          const { data, error } = await rfiDb
            .from('bids_rfis')
            .insert({ bid_id: bid.id, question: item.question, sheet_ref: item.sheet_ref, source: item.source, created_by: authUser?.id ?? null })
            .select('rfi_number, question, sheet_ref')
            .single()
          if (!error && data) {
            created++
            await stampLedger(rfiAuditNote('created', { ...(data as Pick<RfiRow, 'rfi_number' | 'question' | 'sheet_ref'>), sent_via: null, sent_to: [], answer_ref: null }))
            break
          }
          if (error && attempt === 1) throw new Error(error.message)
        }
      }
      showToast(created === 1 ? 'RFI drafted' : `${created} RFIs drafted`, 'success')
      await loadRfis()
    } catch (e) {
      showToast(`RFI not saved: ${e instanceof Error ? e.message : String(e)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function transition(rfi: RfiRow, to: RfiStatus, patch: Partial<RfiRow> = {}) {
    setBusy(true)
    try {
      const { data: rows, error } = await rfiDb
        .from('bids_rfis')
        .update({ status: to, updated_at: new Date().toISOString(), ...patch })
        .eq('id', rfi.id)
        .eq('status', rfi.status) // stale-row guard: transition only from the status we displayed
        .select('id')
      if (error) throw new Error(error.message)
      if (!updateApplied(rows)) {
        showToast(BID_UPDATE_NOT_APPLIED_MESSAGE, 'error')
        return
      }
      const merged = { ...rfi, ...patch }
      if (to === 'approved') await stampLedger(rfiAuditNote('approved', merged))
      if (to === 'sent') await stampLedger(rfiAuditNote('sent', merged))
      if (to === 'answered') await stampLedger(rfiAuditNote('answered', merged))
      if (to === 'withdrawn') await stampLedger(rfiAuditNote('withdrawn', merged))
      await loadRfis()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const openCount = useMemo(() => rfis.filter((r) => r.status === 'draft' || r.status === 'approved' || r.status === 'sent').length, [rfis])

  const inputStyle = { padding: '0.45rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' as const }
  const btnStyle = { padding: '0.35rem 0.7rem', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--surface)', cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem' }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.9rem 1rem', marginBottom: '1.25rem', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>RFI queue</h3>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {loading ? 'Loading…' : rfis.length === 0 ? 'No RFIs on this bid yet.' : `${rfis.length} total · ${openCount} open`}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" style={btnStyle} onClick={() => setPasteOpen((v) => !v)}>
          {pasteOpen ? 'Close paste' : 'Paste RFI flags'}
        </button>
      </div>

      {pasteOpen && (
        <div style={{ marginBottom: '0.8rem' }}>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={'Paste CountTooling’s Copy RFI Flags output here…'}
            rows={4}
            style={{ ...inputStyle, width: '100%', fontFamily: 'monospace', fontSize: '0.8125rem' }}
          />
          <button
            type="button"
            style={{ ...btnStyle, marginTop: '0.35rem' }}
            disabled={busy}
            onClick={() => {
              const parsed = parseCtRfiFlags(pasteText)
              if (!parsed.length) {
                showToast('Nothing to import — expected tab-separated “sheet ⇥ question” lines.', 'error')
                return
              }
              void createDrafts(parsed.map((p) => ({ question: p.question, sheet_ref: p.sheet_ref, source: 'ct_note' as const }))).then(() => {
                setPasteText('')
                setPasteOpen(false)
              })
            }}
          >
            Import as drafts
          </button>
        </div>
      )}

      {/* Quick add */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: rfis.length ? '0.9rem' : 0 }}>
        <input
          type="text"
          value={newSheetRef}
          onChange={(e) => setNewSheetRef(e.target.value)}
          placeholder="Sheet (e.g. P201 near 3/B)"
          style={{ ...inputStyle, width: 180 }}
        />
        <input
          type="text"
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
          placeholder="The question for the GC…"
          style={{ ...inputStyle, flex: 1, minWidth: 220 }}
        />
        <button
          type="button"
          style={btnStyle}
          disabled={busy || !newQuestion.trim()}
          onClick={() => {
            void createDrafts([{ question: newQuestion.trim(), sheet_ref: newSheetRef.trim() || null, source: 'manual' }]).then(() => {
              setNewQuestion('')
              setNewSheetRef('')
            })
          }}
        >
          Draft RFI
        </button>
      </div>

      {rfis.map((rfi) => {
        const chip = STATUS_STYLE[rfi.status]
        const next = allowedTransitions(rfi.status)
        const pick = sendPick[rfi.id] ?? {
          gcs: Object.fromEntries(gcOptions.map((g) => [g.name, true])),
          via: 'email' as RfiSentVia,
        }
        const pickedRecipients: RfiRecipient[] = gcOptions.filter((g) => pick.gcs[g.name]).map((g) => ({ gc_customer_id: g.gc_customer_id, name: g.name }))
        const ans = answerDraft[rfi.id] ?? { answer: '', answer_ref: '' }
        return (
          <div key={rfi.id} style={{ borderTop: '1px solid var(--border)', padding: '0.6rem 0' }}>
            <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', fontWeight: 700 }}>RFI-{rfi.rfi_number}</span>
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: 999, background: chip.bg, color: chip.fg }}>{chip.label}</span>
              {rfi.sheet_ref && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{rfi.sheet_ref}</span>}
              {rfi.source !== 'manual' && <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>via {rfi.source === 'ct_note' ? 'CountTooling flag' : 'substrate'}</span>}
              <span style={{ flex: 1 }} />
              {next.includes('approved') && (
                <button type="button" style={btnStyle} disabled={busy} onClick={() => void transition(rfi, 'approved')}>Approve</button>
              )}
              {next.includes('draft') && (
                <button type="button" style={btnStyle} disabled={busy} onClick={() => void transition(rfi, 'draft')}>Back to draft</button>
              )}
              {next.includes('withdrawn') && (
                <button type="button" style={{ ...btnStyle, color: 'var(--text-muted)' }} disabled={busy} onClick={() => void transition(rfi, 'withdrawn')}>Withdraw</button>
              )}
            </div>
            <div style={{ marginTop: '0.3rem', whiteSpace: 'pre-wrap' }}>{rfi.question}</div>
            {rfi.status === 'sent' && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Sent {rfi.sent_at ? new Date(rfi.sent_at).toLocaleDateString() : ''}{rfi.sent_via ? ` via ${rfi.sent_via}` : ''}
                {rfi.sent_to?.length ? ` to ${rfi.sent_to.map((r) => r.name).join(', ')}` : ''}
              </div>
            )}
            {rfi.status === 'answered' && (
              <div style={{ marginTop: '0.35rem', padding: '0.5rem 0.7rem', background: 'var(--bg-green-tint)', borderRadius: 6, fontSize: '0.875rem' }}>
                <strong>Answer{rfi.answer_ref ? ` (${rfi.answer_ref})` : ''}:</strong> {rfi.answer || '—'}
              </div>
            )}
            {rfi.status === 'approved' && (
              <div style={{ marginTop: '0.45rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {gcOptions.map((g) => (
                  <label key={g.name} style={{ fontSize: '0.8125rem', display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={!!pick.gcs[g.name]}
                      onChange={(e) => setSendPick((s) => ({ ...s, [rfi.id]: { ...pick, gcs: { ...pick.gcs, [g.name]: e.target.checked } } }))}
                    />
                    {g.name}
                  </label>
                ))}
                <select
                  value={pick.via}
                  onChange={(e) => setSendPick((s) => ({ ...s, [rfi.id]: { ...pick, via: e.target.value as RfiSentVia } }))}
                  style={{ ...inputStyle, padding: '0.3rem' }}
                >
                  <option value="email">email</option>
                  <option value="planhub">PlanHub Q&A</option>
                  <option value="phone">phone</option>
                  <option value="other">other</option>
                </select>
                <button
                  type="button"
                  style={{ ...btnStyle, fontWeight: 600 }}
                  disabled={busy || pickedRecipients.length === 0}
                  onClick={() => void transition(rfi, 'sent', { sent_at: new Date().toISOString(), sent_via: pick.via, sent_to: pickedRecipients })}
                >
                  Mark sent
                </button>
              </div>
            )}
            {rfi.status === 'sent' && (
              <div style={{ marginTop: '0.45rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={ans.answer}
                  onChange={(e) => setAnswerDraft((s) => ({ ...s, [rfi.id]: { ...ans, answer: e.target.value } }))}
                  placeholder="The GC's answer…"
                  style={{ ...inputStyle, flex: 1, minWidth: 200 }}
                />
                <input
                  type="text"
                  value={ans.answer_ref}
                  onChange={(e) => setAnswerDraft((s) => ({ ...s, [rfi.id]: { ...ans, answer_ref: e.target.value } }))}
                  placeholder="Ref (e.g. Addendum 1)"
                  style={{ ...inputStyle, width: 150 }}
                />
                <button
                  type="button"
                  style={btnStyle}
                  disabled={busy || !ans.answer.trim()}
                  onClick={() => void transition(rfi, 'answered', { answer: ans.answer.trim(), answer_ref: ans.answer_ref.trim() || null, answered_at: new Date().toISOString() })}
                >
                  Record answer
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
