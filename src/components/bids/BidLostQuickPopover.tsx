import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { BID_UPDATE_NOT_APPLIED_MESSAGE, updateApplied } from '../../lib/bids/updateGuard'
import { useToastContext } from '../../contexts/ToastContext'
import { isBidLossCategoryKey, suggestLossCategoryFromNote, type BidLossCategoryKey } from '../../lib/bidLossCategories'
import { BidLossCategoryChips } from './BidLossCategoryChips'

/**
 * Quick lost capture (v2.2043): a small inline panel — note box + the shared
 * six loss-reason chips — that marks a bid lost and records why in one tap,
 * without opening Edit Bid or a call session. Also edits the reason on an
 * already-lost bid. Same model as the Why-we-lost lens: type what they said
 * first (optional), then the reason tap saves both.
 */
export function BidLostQuickPopover({
  bid,
  packet,
  onSaved,
  onClose,
}: {
  bid: { id: string; outcome?: string | null; loss_reason?: string | null; loss_category?: string | null }
  /**
   * Bids by GC (v2.2178): when set, the reason is this GC's packet (bid_versions.loss_category /
   * outcome_note) — the bid's own outcome and reason are left alone.
   */
  packet?: { versionIds: string[]; gcName: string; lossCategory?: string | null; note?: string | null }
  onSaved: () => void
  onClose: () => void
}) {
  const { showToast } = useToastContext()
  const [note, setNote] = useState(((packet ? packet.note : bid.loss_reason) ?? '').trim())
  const [saving, setSaving] = useState(false)
  const alreadyLost = packet ? true : bid.outcome === 'lost'
  const currentCategory = isBidLossCategoryKey(packet ? packet.lossCategory : bid.loss_category) ? ((packet ? packet.lossCategory : bid.loss_category) as BidLossCategoryKey) : null

  async function save(category: BidLossCategoryKey | null) {
    setSaving(true)
    try {
      if (packet) {
        await withSupabaseRetry(
          async () =>
            supabase
              .from('bid_versions')
              .update({ outcome: 'lost', loss_category: category, outcome_note: note.trim() || null })
              .in('id', packet.versionIds),
          'quick lost capture (packet)',
        )
      } else {
        const rows = await withSupabaseRetry(
          async () =>
            supabase
              .from('bids')
              .update({ outcome: 'lost', loss_category: category, loss_reason: note.trim() || null })
              .eq('id', bid.id)
              .select('id'),
          'quick lost capture',
        )
        if (!updateApplied(rows)) throw new Error(BID_UPDATE_NOT_APPLIED_MESSAGE)
      }
      showToast(packet ? `Lost with ${packet.gcName} — ${category ? 'reason recorded.' : 'no reason yet.'}` : category ? 'Lost — reason recorded.' : 'Marked lost — it will wait in Followup → Why we lost.', 'success')
      onSaved()
      onClose()
    } catch (err) {
      showToast(formatErrorMessage(err, 'Could not save'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 8, padding: '0.6rem 0.75rem', margin: '0.25rem 0 0.4rem', maxWidth: '34rem' }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }
      }}
    >
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: '0.4rem' }}>
        {alreadyLost ? 'Why did we lose it?' : 'Mark lost — why?'}
      </div>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="what they said (optional — saved with the reason tap)"
        aria-label="What they said"
        autoFocus
        style={{ width: '100%', font: 'inherit', fontSize: '0.8125rem', padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', marginBottom: '0.45rem' }}
      />
      <BidLossCategoryChips
        value={currentCategory}
        onSelect={(key) => void save(key)}
        suggestedKey={currentCategory == null ? suggestLossCategoryFromNote(note) : null}
        suggestedHint="suggested from the note — click to confirm"
        size="sm"
        disabled={saving}
      />
      <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center', marginTop: '0.45rem' }}>
        {!alreadyLost ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => void save(null)}
            style={{ font: 'inherit', fontSize: '0.72rem', padding: 0, border: 'none', background: 'none', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer' }}
          >
            mark lost — don’t know why yet
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          style={{ font: 'inherit', fontSize: '0.72rem', padding: 0, border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginLeft: 'auto' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
