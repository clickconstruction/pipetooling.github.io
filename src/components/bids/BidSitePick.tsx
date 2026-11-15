/**
 * The bid's own difficulty picks on the Workbench (punch list #357, PR 6): the site. One quiet line per scale picked
 * on the bid, *The site: 1 point · An occupied building, or no room to stage.*, with a press that opens its rungs.
 * A pick saves at once and the Workbench reads it into the bid's difficulty lines; a sent bid keeps its picks.
 * Nothing draws under a criteria version with no scale picked on the bid.
 */
import { useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { BID_PICK_WORDS as W, bidPickLineWords, difficultyBidScales } from '../../lib/bids/bidDifficultyPicks'
import type { DifficultyCriteriaBody, DifficultyPicks } from '../../lib/bids/difficultyCriteria'
import { formatErrorMessage } from '../../utils/errorHandling'
import DifficultyScalesPicker from './DifficultyScalesPicker'

const QUIET: CSSProperties = { font: 'inherit', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-link)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }
const MUTED: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.75rem' }

export default function BidSitePick({ bidId, body, picks, sent, onPick }: { bidId: string; body: DifficultyCriteriaBody | null; picks: DifficultyPicks; sent: boolean; onPick: (key: string, points: number | null) => Promise<void> }) {
  const { showToast } = useToastContext()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const scales = difficultyBidScales(body)
  if (!body || scales.length === 0) return null
  const anyPicked = scales.some((s) => picks[s.key] != null)
  const pick = async (key: string, points: number | null) => {
    setBusy(true)
    try {
      await onPick(key, points)
    } catch (e) {
      showToast(formatErrorMessage(e, W.failed), 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div data-testid="bid-site-pick" style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: 'var(--text-700)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        {scales.map((s) => (
          <span key={s.key} data-testid={`bid-site-pick-line-${s.key}`}>
            {bidPickLineWords(s, picks, body)}
          </span>
        ))}
        {sent ? (
          <span style={MUTED}>{W.sent}</span>
        ) : (
          <button type="button" style={QUIET} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? W.close : anyPicked ? W.change : W.pick}
          </button>
        )}
        {busy ? <span style={MUTED}>{W.saving}</span> : null}
      </div>
      {open && !sent ? (
        <div data-testid="bid-site-pick-rungs" style={{ marginTop: '0.4rem', border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 8, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.5rem', maxWidth: '34rem' }}>
          <span style={MUTED}>{W.lead}</span>
          <DifficultyScalesPicker body={body} picks={picks} scope="bid" readOnly={busy} groupName={`bid-site-${bidId}`} onPick={(key, points) => void pick(key, points)} />
          {anyPicked ? (
            <div>
              {scales
                .filter((s) => picks[s.key] != null)
                .map((s) => (
                  <button key={s.key} type="button" style={QUIET} disabled={busy} onClick={() => void pick(s.key, null)}>
                    {scales.length > 1 ? `${W.clear}: ${s.name}` : W.clear}
                  </button>
                ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
