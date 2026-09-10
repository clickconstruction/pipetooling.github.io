import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { resolveActorDisplayName } from '../../lib/outcomeChangeBidNote'
import { buildBidReviewPatch, BID_REVIEWED_EVENT } from '../../lib/bids/bidReview'
import { bestEffortCardMode, bestEffortRecordNote, bestEffortStamp, type BestEffortRecord } from '../../lib/bids/bestEffort'
import type { ShadowRunRow } from '../../lib/bids/shadowStory'

// bid_best_efforts reaches the generated types with the post-push gen-types run (BidRfiQueue pattern).
const db = supabase as unknown as SupabaseClient

type BidBestEffortCardProps = {
  bid: { id: string; bid_number: string | null; project_name: string | null; bid_date_sent: string | null; bid_value: number | string | null; robot_opt_out?: boolean | null; reviewed_at?: string | null }
  /** The letter's proposed amount — the number the card records. */
  amount: number | null | undefined
  /** After a record (or a tap on the door): the page opens the robot's envelope. */
  onRecorded: (bidId: string) => void
  onOpenEnvelope: (bidId: string) => void
}

const money = (n: number) => `$${Math.round(n).toLocaleString()}`

/**
 * "Your best effort" (v2.3234): the step between the letter's amount and Mark
 * sent. One tap records the number the estimator would send right now — the
 * blind human reference the shadow scores against — and opens the robot's
 * envelope while the bid can still change. First record wins; the table is
 * insert-only for staff and closed to the robots. Recording also stamps the bid
 * reviewed (the flow's Review step), since a number is a better definition of
 * "reviewed" than a bare timestamp.
 */
export function BidBestEffortCard({ bid, amount, onRecorded, onOpenEnvelope }: BidBestEffortCardProps) {
  const { user, profileName } = useAuth()
  const { showToast } = useToastContext()
  const [record, setRecord] = useState<BestEffortRecord | null | undefined>(undefined)
  const [recorderName, setRecorderName] = useState<string | null>(null)
  const [run, setRun] = useState<ShadowRunRow | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [available, setAvailable] = useState(true)

  const load = useCallback(async () => {
    try {
      const [recRes, runRes] = await Promise.all([
        db.from('bid_best_efforts').select('*').eq('bid_id', bid.id).maybeSingle(),
        db.rpc('list_shadow_runs'),
      ])
      if (recRes.error && /does not exist|42P01|PGRST205|schema cache|Could not find the table/i.test(recRes.error.message)) {
        // Client ahead of the migration: the card hides rather than breaking the letter.
        setAvailable(false)
        return
      }
      const rec = (recRes.data ?? null) as BestEffortRecord | null
      setRecord(rec)
      const number = (bid.bid_number ?? '').trim()
      const runs = ((runRes.data ?? []) as ShadowRunRow[]).filter((r) => (r.reference_bid_number ?? '').trim() === number)
      setRun(runs.find((r) => r.status === 'scored') ?? runs.find((r) => r.status === 'locked') ?? runs.find((r) => r.status === 'open') ?? null)
      if (rec?.recorded_by) {
        const { data } = await supabase.from('users').select('name').eq('id', rec.recorded_by).maybeSingle()
        setRecorderName((data as { name: string | null } | null)?.name ?? null)
      }
    } catch {
      setAvailable(false)
    }
  }, [bid.id, bid.bid_number])
  useEffect(() => {
    void load()
  }, [load])

  if (!available || record === undefined || run === undefined) return null
  const mode = bestEffortCardMode({ bid, amount, record, run: run ? { status: run.status, locked_at: run.locked_at } : null })
  if (mode.kind === 'hidden') return null

  const recordNow = async () => {
    if (mode.kind !== 'record' || !user?.id) return
    setBusy(true)
    try {
      const nowIso = new Date().toISOString()
      const { error } = await db.from('bid_best_efforts').insert({ bid_id: bid.id, value: mode.amount, recorded_at: nowIso, recorded_by: user.id })
      if (error) {
        if (/duplicate|23505/i.test(error.message)) {
          showToast('A best effort is already on record for this bid — first record wins.', 'error')
          await load()
          return
        }
        throw new Error(error.message)
      }
      const actor = resolveActorDisplayName(profileName, user.email)
      // The ledger line and the Review stamp are best effort; the record is the truth.
      await supabase.from('bids_submission_entries').insert({
        bid_id: bid.id,
        notes: bestEffortRecordNote({ actorDisplayName: actor, value: mode.amount, robot: mode.robot }),
        contact_method: null,
        occurred_at: nowIso,
        created_by: user.id,
      }).then(() => {}, () => {})
      if (!bid.reviewed_at) {
        await supabase.from('bids').update(buildBidReviewPatch({ userId: user.id, note: `Best effort ${money(mode.amount)} recorded`, nowIso })).eq('id', bid.id).then(() => {}, () => {})
        window.dispatchEvent(new CustomEvent(BID_REVIEWED_EVENT, { detail: { bidId: bid.id } }))
      }
      showToast(
        mode.robot === 'sealed'
          ? `Best effort ${money(mode.amount)} recorded — opening the robot's envelope.`
          : mode.robot === 'estimating'
            ? `Best effort ${money(mode.amount)} recorded. The robot is still estimating; its envelope opens when it locks.`
            : `Best effort ${money(mode.amount)} recorded.`,
        'success',
      )
      await load()
      onRecorded(bid.id)
    } catch (e) {
      showToast(`Couldn't record the best effort: ${e instanceof Error ? e.message : String(e)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const lbl: React.CSSProperties = { fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#7c3aed' }
  const wrap: React.CSSProperties = { border: '1px solid #7c3aed', borderRadius: 10, padding: '0.75rem 0.95rem', background: 'var(--surface)', display: 'grid', gap: '0.45rem', margin: '0 0 1rem' }

  if (mode.kind === 'record') {
    const robotLine =
      mode.robot === 'sealed'
        ? '🔒 The robot sealed its number' + (run?.locked_at ? ` on ${run.locked_at.slice(5, 10).replace('-', '/')}` : '') + ' — it opens the moment yours is on record.'
        : mode.robot === 'estimating'
          ? 'The robot is still estimating. Record now anyway; its envelope opens when it locks.'
          : 'No robot has run on this bid yet. Recording still puts your number on the record for the score.'
    return (
      <div style={wrap} data-testid="best-effort-card">
        <span style={lbl}>Your best effort</span>
        <div style={{ fontSize: '0.875rem' }}>
          Record <b style={{ fontFamily: 'ui-monospace, monospace' }}>{money(mode.amount)}</b> as the number you would send right now.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={busy}
            onClick={() => void recordNow()}
            style={{ padding: '0.4rem 0.9rem', border: 'none', borderRadius: 6, background: '#7c3aed', color: 'white', fontWeight: 600, cursor: busy ? 'wait' : 'pointer', font: 'inherit', fontSize: '0.82rem' }}
          >
            {busy ? 'Recording…' : mode.robot === 'sealed' ? "Record best effort · open the robot's envelope" : 'Record best effort'}
          </button>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{robotLine}</span>
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Recording also marks the bid reviewed. Your number cannot change on this record afterwards; the bid can — and the bid note will say by how much.
        </div>
      </div>
    )
  }

  return (
    <div style={wrap} data-testid="best-effort-card">
      <span style={lbl}>Your best effort</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.875rem' }}>
        <b style={{ fontFamily: 'ui-monospace, monospace' }}>{money(mode.value)}</b>
        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 999, padding: '1px 8px' }}>{bestEffortStamp({ recorded_at: mode.recordedAt }, recorderName)}</span>
        {mode.envelope === 'open' ? (
          <button type="button" onClick={() => onOpenEnvelope(bid.id)} style={{ padding: '0.35rem 0.8rem', border: 'none', borderRadius: 6, background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer', font: 'inherit', fontSize: '0.8rem' }}>
            Open the robot's envelope
          </button>
        ) : mode.envelope === 'waiting' ? (
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>🔒 the robot is still estimating — its envelope opens here when it locks</span>
        ) : (
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>no robot on this bid yet</span>
        )}
      </div>
    </div>
  )
}
