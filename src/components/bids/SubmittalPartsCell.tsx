/**
 * A submittal row's parts, read model first (2026-10-01, Wendi: "need to show parts not just
 * assemblies"): one line per part the GC sees — the maker and model bold, the catalog words
 * quiet on the same line — then the order-only parts in one quiet line, the assembly they came
 * out of, and every house they come from.
 */
import type { CSSProperties } from 'react'
import { assemblyLine, formatPartQty, orderOnlyLine, partHouseIds, splitPartLabel, submittedParts, type SubmittalPartRow } from '../../lib/submittals/itemParts'
import { formatPages } from '../../lib/submittals/submittalRevision'

const quiet: CSSProperties = { fontSize: '0.7rem', color: 'var(--text-muted)' }
const CALL: Record<string, { word: string; color: string }> = {
  approved: { word: '✓ approved', color: 'var(--text-green-700)' },
  revise: { word: 'revise', color: 'var(--text-amber-700)' },
  rejected: { word: 'rejected', color: 'var(--text-red-700)' },
}

export function SubmittalPartsCell({ parts, houseNameById }: { parts: ReadonlyArray<SubmittalPartRow>; houseNameById: ReadonlyMap<string, string> }) {
  const shown = submittedParts(parts)
  const orderOnly = orderOnlyLine(parts)
  const from = assemblyLine(parts)
  const houses = partHouseIds(parts).map((id) => houseNameById.get(id)).filter((n): n is string => !!n)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: 0 }} data-testid="row-parts">
      {shown.length === 0 ? <span style={{ color: 'var(--text-faint)' }}>no part for the GC yet</span> : null}
      {shown.map((p) => {
        const { head, words } = splitPartLabel(p.label)
        const qty = formatPartQty(p.quantity)
        return (
          <span key={p.id} title={`${p.label}${qty ? ` ${qty} per fixture` : ''}`} style={{ display: 'flex', gap: '0.35rem', alignItems: 'baseline', minWidth: 0, maxWidth: '30rem' }} data-testid="row-part">
            <b style={{ fontWeight: 600, color: 'var(--text-strong)', whiteSpace: 'nowrap' }}>{head}</b>
            {/* One line, clamped: unlike nowrap, the column can still narrow to fit a tablet. */}
            {words ? <span style={{ ...quiet, fontSize: '0.75rem', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere', minWidth: 0, flex: '1 1 auto' }}>{words}</span> : null}
            {qty ? <span style={{ ...quiet, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{qty}</span> : null}
            {(p.sheet_pages ?? []).length > 0 ? <span style={{ ...quiet, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }} data-testid="row-part-pages">{formatPages(p.sheet_pages)}</span> : null}
            {p.review_decision && CALL[p.review_decision] ? (
              <span style={{ fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap', color: CALL[p.review_decision]!.color }} title={[p.reviewed_by_name, p.review_note ? `“${p.review_note}”` : '', p.decision_source === 'carried' ? 'approved on the last revision' : ''].filter(Boolean).join(' · ')} data-testid="row-part-call">
                {CALL[p.review_decision]!.word}
              </span>
            ) : null}
          </span>
        )
      })}
      {shown.filter((p) => p.priced_label).map((p) => (
        <span key={`priced-${p.id}`} style={{ ...quiet, color: p.reason_note ? 'var(--text-muted)' : 'var(--text-amber-700)' }} data-testid="row-part-priced">
          {splitPartLabel(p.label).head} in place of the priced {splitPartLabel(p.priced_label).head}{p.reason_note ? `: ${p.reason_note}` : ' · say why with Edit'}
        </span>
      ))}
      {orderOnly ? (
        <span style={quiet} data-testid="row-order-only" title="Bought for the fixture, but not on the GC's submittal">
          Ordered, not submitted: {orderOnly}
        </span>
      ) : null}
      {from || houses.length > 0 ? (
        <span style={quiet} data-testid="row-house">
          {[from, houses.join(' · ')].filter(Boolean).join(' · ')}
        </span>
      ) : null}
    </div>
  )
}
