import { formatCurrency } from '../../lib/format'

/**
 * Bid→Job (Per-GC Phase 3, docs/PER_GC_BID_PLAN.md): a multi-GC bid is becoming a job and no
 * single winner is recorded — ask once. Picking a GC (when `writesWin`) records that packet's
 * Won through the same path the board pills use (a win auto-losses the other sent, unanswered
 * packets), and the import proceeds from the choice. When winners are AMBIGUOUS (>1 won) the
 * pick only chooses which packet the job is for — nothing is written.
 */

export type WinningGcOption = {
  /** GcPacket.key ('' = own GC, 'shared:<cid>' = shared-letter recipient). */
  key: string
  customerId: string | null
  name: string
  sentOn: string | null
  value: number | null
  outcome: string | null
  sharedLetter: boolean
}

export function PickWinningGcModal({
  bidName,
  options,
  writesWin,
  onPick,
  onCancel,
}: {
  bidName: string
  options: WinningGcOption[]
  /** True when no winner is recorded yet — the pick writes the packet's Won. */
  writesWin: boolean
  onPick: (opt: WinningGcOption) => void
  onCancel: () => void
}) {
  const sorted = [...options].sort((a, b) => (a.sentOn && !b.sentOn ? -1 : !a.sentOn && b.sentOn ? 1 : 0))
  return (
    <div role="dialog" aria-modal="true" aria-label="Which GC gave you this job?" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '1.1rem 1.25rem', width: 'min(30rem, 94vw)', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 18px 50px rgba(0,0,0,0.35)' }}>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>Which GC gave you this job?</h3>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {bidName} went to {options.length} GCs.{' '}
          {writesWin
            ? 'Picking one records their Won (other sent, unanswered GCs are marked lost — their GC lost the project) and the job imports from their packet.'
            : 'More than one GC is marked Won — pick which one this job is for. Nothing is changed on the bid.'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {sorted.map((o) => (
            <button
              key={o.key || 'own'}
              type="button"
              onClick={() => onPick(o)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%', textAlign: 'left', font: 'inherit', fontSize: '0.875rem', padding: '0.55rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }}
            >
              <b style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{o.name}</b>
              {o.outcome === 'won' ? (
                <span style={{ fontSize: '0.7rem', fontWeight: 700, borderRadius: 999, padding: '0.1rem 0.5rem', background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' }}>won</span>
              ) : null}
              <span style={{ fontSize: '0.75rem', color: o.sentOn ? 'var(--text-green-600)' : 'var(--text-faint)', whiteSpace: 'nowrap' }}>{o.sentOn ? `sent ${o.sentOn}` : 'not sent'}</span>
              {o.value != null ? <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>${formatCurrency(o.value)}</span> : null}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.8rem' }}>
          <button type="button" onClick={onCancel} style={{ font: 'inherit', fontSize: '0.8125rem', padding: '0.4rem 0.9rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}>
            Cancel import
          </button>
        </div>
      </div>
    </div>
  )
}
