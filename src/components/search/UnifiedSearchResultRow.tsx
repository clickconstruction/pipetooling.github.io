/**
 * The standard presentation for a unified job/bid search result row — extracted
 * from the header global search so every picker renders results the same way:
 *
 *   [trade pill] J927 · Job name - Address   [Ready to Bill] $4,850 paid 12d · 2 this wk
 *                (muted line-items summary)
 *
 * Number prefixes are always plain J/B (`plainTradePrefixes`) because the trade
 * pill beside the number already carries PLUM/ELEC/…. Hosts own the clickable
 * container (button/li/row) and its highlight background; this component only
 * renders the row CONTENT. Evidence is optional — rows render plain without it.
 * `evidenceMode` gates dollars exactly like the fetch layer: 'money' for office
 * roles, 'lines-only' shows a line count instead (see jobSearchEvidenceModeForRole).
 */
import {
  customerTypePillForUnifiedRow,
  formatUnifiedResult,
  formatUnifiedResultSplit,
  serviceTypeTagForUnifiedRow,
  type UnifiedSearchResult,
} from '../../utils/unifiedJobBidSearch'
import {
  bidSearchStatusChip,
  type BidSearchEvidence,
  type JobSearchEvidence,
  type JobSearchEvidenceMode,
} from '../../lib/jobSearchEvidence'
import { jobPickerStatusChip } from '../../lib/scheduleDispatchHub'
import { buildJobSearchRail, daysSinceYmd } from '../../lib/jobSearchRail'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import type { LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'

/** "due 5/5" for pending bids with a due date, else "sent 3/2" — null when neither date exists. */
export function bidSearchDateLabel(be: BidSearchEvidence): string | null {
  const short = (d: string | null): string | null => {
    if (!d) return null
    const dt = new Date(d.includes('T') ? d : `${d}T12:00:00`)
    if (Number.isNaN(dt.getTime())) return null
    return `${dt.getMonth() + 1}/${dt.getDate()}`
  }
  const wl = (be.winLoss ?? '').trim().toLowerCase()
  if (wl !== 'won' && wl !== 'lost' && wl !== 'started_or_complete') {
    const due = short(be.dueDate)
    if (due) return `due ${due}`
  }
  const sent = short(be.dateSent)
  return sent ? `sent ${sent}` : null
}

/**
 * The picked item's label — same identity language as the result rows (bare
 * trade pill + plain J/B number) so a selection doesn't change format the
 * moment it is chosen. Hosts own the chip container and its Clear button.
 */
export function UnifiedSearchSelectionLabel({
  result: r,
  prefixMap,
}: {
  result: UnifiedSearchResult
  prefixMap: LedgerPrefixMap
}) {
  const tradePill = serviceTypeTagForUnifiedRow(r)
  const pill = tradePill ?? customerTypePillForUnifiedRow(r)
  return (
    <>
      {pill ? (
        <span
          style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            padding: '0.1rem 0.28rem',
            borderRadius: 3,
            background: pill.color,
            color: tradePill ? '#fff' : 'var(--text-strong)',
            lineHeight: 1.2,
            flex: 'none',
          }}
        >
          {pill.tag}
        </span>
      ) : null}
      <span>{formatUnifiedResult(r, prefixMap, { plainTradePrefixes: true })}</span>
    </>
  )
}

const railChipStyle = {
  fontSize: '0.65rem',
  fontWeight: 600,
  padding: '0.06rem 0.45rem',
  borderRadius: 999,
} as const

const railMutedStyle = { fontSize: '0.65rem', color: 'var(--text-muted)' } as const

export type UnifiedSearchResultRowProps = {
  result: UnifiedSearchResult
  prefixMap: LedgerPrefixMap
  jobEvidence?: JobSearchEvidence | null
  bidEvidence?: BidSearchEvidence | null
  evidenceMode?: JobSearchEvidenceMode
  /**
   * Force the stacked (rail-below-identity) layout regardless of viewport.
   * Hosts whose CONTAINER is always narrow (e.g. the ~360px assign-session
   * popover) must pass true — the viewport heuristic can't see container
   * width, so on desktop it picks side-by-side and crushes the name.
   */
  stacked?: boolean
  /**
   * Give the address (the part after " - " in the combined label) its own
   * muted second line instead of riding the identity line — for narrow hosts
   * where "name - address" on one line ellipsizes the name away. Implies the
   * stacked order: title, address, line summary, then the evidence rail.
   */
  splitAddressLine?: boolean
}

export function UnifiedSearchResultRow({
  result: r,
  prefixMap,
  jobEvidence,
  bidEvidence,
  evidenceMode = 'money',
  stacked: stackedProp,
  splitAddressLine = false,
}: UnifiedSearchResultRowProps) {
  // Under 640px the evidence rail moves BELOW the identity line (left-aligned)
  // instead of beside it — side-by-side crushes the label into a narrow
  // wrapping column on phones and scatters the chips at different heights.
  const narrowViewport = useNarrowViewport640()
  const stacked = splitAddressLine || (stackedProp ?? narrowViewport)
  const tradePill = serviceTypeTagForUnifiedRow(r)
  const pill = tradePill ?? customerTypePillForUnifiedRow(r)
  const je = r.source === 'job' ? jobEvidence : null
  const be = r.source === 'bid' ? bidEvidence : null
  const statusChip = je ? jobPickerStatusChip(je.status) : null
  // Money mode (v2.3183): one fixed shape per row — note · chip · amount — so
  // the numbers stack in a column and the note only speaks when the chip
  // hasn't already. The kernel decides the words; this file lays them out.
  const moneyRail =
    evidenceMode === 'money' && je
      ? buildJobSearchRail({
          status: je.status,
          lineCount: je.lineCount,
          lineRevenue: je.lineRevenue,
          revenue: je.revenue ?? null,
          lastPaidDaysAgo: je.lastPaidDaysAgo,
          billedDaysAgo: daysSinceYmd(je.lastBillDate, Date.now()),
          collectionsFlagged: Boolean(je.collectionsAt),
        })
      : null

  const combinedText = formatUnifiedResult(r, prefixMap, { plainTradePrefixes: true })
  const split = formatUnifiedResultSplit(r, prefixMap, { plainTradePrefixes: true })
  // Split mode: the identity line carries only "{prefix} · {name}" (full
  // combined label stays in the tooltip) and the address gets its own line.
  const identityText = splitAddressLine ? split.title : combinedText
  const addressLine =
    splitAddressLine && split.secondary ? (
      <span
        style={{
          display: 'block',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginTop: 2,
        }}
        title={split.secondary}
      >
        {split.secondary}
      </span>
    ) : null
  const identity = (
    // One line, never wraps: a wrapping identity stranded the trade pill on its
    // own line whenever the title was long (owner feedback, v2.1521) — the text
    // ellipsizes instead and the full label lives in title.
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: stacked ? undefined : 1, minWidth: 0 }}>
      {pill ? (
        <span
          style={{
            flexShrink: 0,
            fontSize: '0.65rem',
            fontWeight: 700,
            padding: '0.1rem 0.28rem',
            borderRadius: 3,
            background: pill.color,
            // Trade tags: white text on the bright solid bg (matches the Clock In
            // pills); customer pills flip with their bg token via text-strong.
            color: tradePill ? '#fff' : 'var(--text-strong)',
            lineHeight: 1.2,
          }}
        >
          {pill.tag}
        </span>
      ) : null}
      {/* Plain J/B prefixes: the trade pill beside the number already says PLUM/ELEC/…,
          so the per-service-type letter (JP → J, BP → B) would repeat it. */}
      <span
        style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        title={combinedText}
      >
        {identityText}
      </span>
    </span>
  )

  const noteColor = (tone: 'green' | 'amber' | 'red') =>
    tone === 'green' ? 'var(--text-green-800)' : tone === 'red' ? 'var(--text-red-700)' : 'var(--text-amber-700)'
  const rail = je ? (
    moneyRail ? (
      // Desktop: a three-column grid with fixed slots so every row's chip and
      // amount land in the same place down the list. Stacked hosts (phones,
      // narrow popovers) keep the same order in a wrapping row.
      <span
        style={{
          flexShrink: 0,
          display: stacked ? 'inline-flex' : 'grid',
          gridTemplateColumns: stacked ? undefined : 'minmax(0, 7.5rem) 6.25rem 5.25rem',
          alignItems: 'center',
          justifyItems: stacked ? undefined : 'end',
          gap: stacked ? '0.35rem' : '0.5rem',
          flexWrap: stacked ? 'wrap' : undefined,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.2,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'flex-end', minWidth: 0 }}>
          {je.blocksThisWeek > 0 ? <span style={railMutedStyle}>{je.blocksThisWeek} this wk</span> : null}
          {moneyRail.note ? (
            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: noteColor(moneyRail.note.tone), whiteSpace: 'nowrap' }}>{moneyRail.note.label}</span>
          ) : null}
        </span>
        <span style={{ display: 'inline-flex', justifyContent: stacked ? 'flex-start' : 'flex-end' }}>
          {statusChip ? (
            <span style={{ ...railChipStyle, background: statusChip.background, color: statusChip.color, whiteSpace: 'nowrap' }}>
              {statusChip.label}
            </span>
          ) : null}
        </span>
        <span
          style={{
            fontSize: '0.8125rem',
            fontWeight: moneyRail.amount.muted ? 500 : 700,
            color: moneyRail.amount.muted ? 'var(--text-faint)' : undefined,
            whiteSpace: 'nowrap',
          }}
        >
          {moneyRail.amount.label}
        </span>
      </span>
    ) : (
      <span
        style={{
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          flexWrap: stacked ? 'wrap' : undefined,
          textAlign: stacked ? 'left' : 'right',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.2,
        }}
      >
        {statusChip ? (
          <span style={{ ...railChipStyle, background: statusChip.background, color: statusChip.color }}>
            {statusChip.label}
          </span>
        ) : null}
        {evidenceMode === 'lines-only' && je.lineCount > 0 ? (
          <span style={railMutedStyle}>
            {je.lineCount} {je.lineCount === 1 ? 'line' : 'lines'}
          </span>
        ) : null}
        {je.blocksThisWeek > 0 ? <span style={railMutedStyle}>{je.blocksThisWeek} this wk</span> : null}
      </span>
    )
  ) : be ? (
    (() => {
      const chip = bidSearchStatusChip(be.winLoss, be.dateSent)
      const dateLabel = bidSearchDateLabel(be)
      return (
        <span
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            flexWrap: stacked ? 'wrap' : undefined,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span style={{ ...railChipStyle, background: chip.background, color: chip.color }}>{chip.label}</span>
          {be.bidValue !== null ? (
            <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>
              ${Math.round(be.bidValue).toLocaleString('en-US')}
            </span>
          ) : null}
          {dateLabel ? <span style={railMutedStyle}>{dateLabel}</span> : null}
        </span>
      )
    })()
  ) : null

  const lineSummary =
    je && je.lineCount > 0 ? (
      <span
        style={{
          display: 'block',
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginTop: 1,
        }}
        title={je.lineSummary}
      >
        {je.lineSummary}
      </span>
    ) : null

  if (stacked) {
    if (splitAddressLine) {
      // Owner-specified order for the split rows: name, address, line items,
      // then the evidence rail as the row's footer.
      return (
        <>
          {identity}
          {addressLine}
          {lineSummary}
          {rail ? <span style={{ display: 'flex', marginTop: 3 }}>{rail}</span> : null}
        </>
      )
    }
    return (
      <>
        {identity}
        {rail ? <span style={{ display: 'flex', marginTop: 3 }}>{rail}</span> : null}
        {lineSummary}
      </>
    )
  }
  return (
    <>
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {identity}
        {rail}
      </span>
      {lineSummary}
    </>
  )
}
