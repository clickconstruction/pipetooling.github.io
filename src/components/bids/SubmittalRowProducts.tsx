/**
 * One row's products in the rows table (Submittals step 3): a line per part the GC sees — the
 * maker and model bold, the catalog words quiet — with what the reviewer answered on that part
 * beside it, in the *Their answer* column the header names. A row with no parts is one line: its
 * product, or "No product yet". Then the quiet lines under them: a part in place of the one
 * priced, two carriers, the order-only parts, the assembly they came out of and the houses.
 *
 * The part and its answer are two cells of one grid row, so they stay side by side however the
 * part's name wraps; on a phone the answer sits under its part (`.sub-rows-answers`).
 */
import type { CSSProperties, ReactNode } from 'react'
import { assemblyLine, doubledKinds, formatPartQty, orderOnlyLine, partHouseIds, splitPartLabel, submittedParts, type SubmittalPartRow } from '../../lib/submittals/itemParts'
import { rowAnswers, type AnswerMark } from '../../lib/submittals/rowsTableModel'
import { asStatus, formatPages, type SubmittalItemRow } from '../../lib/submittals/submittalRevision'

const quiet: CSSProperties = { fontSize: '0.7rem', color: 'var(--text-muted)' }
const faint: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-faint)' }
const TONE: Record<AnswerMark['tone'], { background: string; color: string }> = {
  approved: { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' },
  revise: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-700)' },
  rejected: { background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' },
}

function Mark({ mark, by, testId }: { mark: AnswerMark; by: string; testId: string }) {
  return (
    <span style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'baseline', minWidth: 0 }} title={[by, mark.carried ? 'approved on the last revision' : ''].filter(Boolean).join(' · ') || undefined}>
      <b style={{ ...TONE[mark.tone], fontSize: '0.7rem', fontWeight: 700, padding: '0.05rem 0.45rem', borderRadius: 999, whiteSpace: 'nowrap' }} data-testid={testId}>{mark.word}</b>
      {mark.note ? <span style={{ ...quiet, fontSize: '0.75rem', overflowWrap: 'anywhere' }}>“{mark.note}”</span> : null}
    </span>
  )
}

export function SubmittalRowProducts({ item, parts, houseNameById, showAnswers, showHouses, onAddProduct }: {
  item: SubmittalItemRow
  parts: ReadonlyArray<SubmittalPartRow>
  houseNameById: ReadonlyMap<string, string>
  /** The revision has an answer somewhere: the answer column is drawn. */
  showAnswers: boolean
  /** False when every row buys from the one house the line over the table already names. */
  showHouses: boolean
  /** A row with no product offers the door to type one. */
  onAddProduct?: () => void
}) {
  const shown = submittedParts(parts)
  const answers = rowAnswers(item, parts)
  const by = item.reviewed_by_name ?? ''
  const line = (key: string, left: ReactNode, right: ReactNode) => (
    <div key={key} className="sub-rows-answers" data-answers={showAnswers ? 'true' : undefined} data-testid="row-part-line">
      <span style={{ display: 'flex', gap: '0.35rem', alignItems: 'baseline', minWidth: 0 }}>{left}</span>
      {showAnswers ? <span style={{ minWidth: 0 }} data-testid="row-answer">{right}</span> : null}
    </div>
  )
  /** What the answer cell says on a line with no mark of its own: once per row, on its first line. */
  const waiting = (first: boolean): ReactNode => {
    if (answers.row && first) return <Mark mark={answers.row} by={by} testId="row-call" />
    if (answers.none && first) return <span style={{ ...quiet, fontSize: '0.75rem' }}>No answer yet</span>
    if (answers.mixed) return <span style={faint}>no answer yet</span>
    return null
  }
  const orderOnly = orderOnlyLine(parts)
  const from = assemblyLine(parts)
  const houses = showHouses ? (parts.length > 0 ? partHouseIds(parts) : item.supply_house_id ? [item.supply_house_id] : []).map((id) => houseNameById.get(id)).filter((n): n is string => !!n) : []
  const missing = asStatus(item.status) === 'missing' && !item.submitted_label && !item.submitted_model
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 }} data-testid="row-parts">
      {parts.length > 0 && shown.length === 0 ? line('none', <span style={{ color: 'var(--text-faint)' }}>no part for the GC yet</span>, waiting(true)) : null}
      {shown.map((p, i) => {
        const { head, words } = splitPartLabel(p.label)
        const qty = formatPartQty(p.quantity)
        const mark = answers.byPart.get(p.id)
        return line(
          p.id,
          <span className="sub-rows-part" title={`${p.label}${qty ? ` ${qty} per fixture` : ''}`} style={{ display: 'flex', gap: '0.35rem', alignItems: 'baseline', minWidth: 0 }} data-testid="row-part">
            {/* The maker and model wrap inside their column at any width: held to one line, a long one ran over the answer beside it. */}
            <b className="sub-rows-part-head" style={{ fontWeight: 600, color: 'var(--text-strong)', overflowWrap: 'anywhere', minWidth: 0, flex: '0 1 auto' }}>{head}</b>
            {/* One line, clamped: unlike nowrap, the column can still narrow to fit a tablet. */}
            {words ? <span style={{ ...quiet, fontSize: '0.75rem', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere', minWidth: 0, flex: '1 1000 auto' }}>{words}</span> : null}
            {qty ? <span style={{ ...quiet, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{qty}</span> : null}
            {(p.sheet_pages ?? []).length > 0 ? <span style={{ ...quiet, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }} data-testid="row-part-pages">{formatPages(p.sheet_pages)}</span> : null}
          </span>,
          mark ? <Mark mark={mark} by={p.reviewed_by_name ?? by} testId="row-part-call" /> : waiting(i === 0),
        )
      })}
      {parts.length === 0
        ? line(
            'product',
            missing ? (
              <>
                <span style={{ color: 'var(--text-amber-700)', fontWeight: 600 }} data-testid="row-no-product">No product yet</span>
                {onAddProduct ? <button type="button" onClick={onAddProduct} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.75rem', color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer' }}>Add the product</button> : null}
              </>
            ) : (
              <span style={{ minWidth: 0 }}>
                {item.submitted_label ?? item.submitted_model ?? <span style={{ color: 'var(--text-faint)' }}>—</span>}
                {item.submitted_label && item.submitted_model && item.submitted_label !== item.submitted_model ? <span style={{ ...quiet, display: 'block' }}>{item.submitted_model}</span> : null}
              </span>
            ),
            waiting(true),
          )
        : null}
      {shown.filter((p) => p.priced_label).map((p) => (
        <span key={`priced-${p.id}`} style={{ ...quiet, color: p.reason_note ? 'var(--text-muted)' : 'var(--text-amber-700)' }} data-testid="row-part-priced">
          {splitPartLabel(p.label).head} in place of the priced {splitPartLabel(p.priced_label).head}{p.reason_note ? `: ${p.reason_note}` : ' · say why with Edit'}
        </span>
      ))}
      {doubledKinds(parts).includes('carrier') ? (
        <span style={{ ...quiet, color: 'var(--text-amber-700)', fontWeight: 600 }} data-testid="row-two-carriers" title="A fixture needs one carrier. Tap Edit and take off the one you are not buying.">
          Two carriers. One may be extra.
        </span>
      ) : null}
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
