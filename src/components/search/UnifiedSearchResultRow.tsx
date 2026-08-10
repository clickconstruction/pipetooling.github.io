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
import { formatDaysAgoShort } from '../../lib/duplicateJobAddressGroups'
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
}

export function UnifiedSearchResultRow({
  result: r,
  prefixMap,
  jobEvidence,
  bidEvidence,
  evidenceMode = 'money',
}: UnifiedSearchResultRowProps) {
  const tradePill = serviceTypeTagForUnifiedRow(r)
  const pill = tradePill ?? customerTypePillForUnifiedRow(r)
  const je = r.source === 'job' ? jobEvidence : null
  const be = r.source === 'bid' ? bidEvidence : null
  const statusChip = je ? jobPickerStatusChip(je.status) : null
  const showMoney = evidenceMode === 'money' && je !== null && je !== undefined && (je.lineRevenue > 0 || je.lineCount > 0)

  return (
    <>
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
          {pill ? (
            <span
              style={{
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
          <span>{formatUnifiedResult(r, prefixMap, { plainTradePrefixes: true })}</span>
        </span>
        {je ? (
          <span
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.2,
            }}
          >
            {statusChip ? (
              <span style={{ ...railChipStyle, background: statusChip.background, color: statusChip.color }}>
                {statusChip.label}
              </span>
            ) : null}
            {showMoney ? (
              <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>
                ${Math.round(je.lineRevenue).toLocaleString('en-US')}
              </span>
            ) : null}
            {evidenceMode === 'money' && je.lastPaidDaysAgo !== null ? (
              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-green-800)' }}>
                paid {formatDaysAgoShort(je.lastPaidDaysAgo)}
              </span>
            ) : evidenceMode === 'money' && je.lineRevenue > 0 && je.status !== 'paid' ? (
              // No payment rows + revenue → amber "unpaid" — unless the Pipeline status
              // is already Paid (payments recorded elsewhere), where the pair would contradict.
              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-amber-700)' }}>unpaid</span>
            ) : null}
            {evidenceMode === 'lines-only' && je.lineCount > 0 ? (
              <span style={railMutedStyle}>
                {je.lineCount} {je.lineCount === 1 ? 'line' : 'lines'}
              </span>
            ) : null}
            {je.blocksThisWeek > 0 ? <span style={railMutedStyle}>{je.blocksThisWeek} this wk</span> : null}
          </span>
        ) : null}
        {be
          ? (() => {
              const chip = bidSearchStatusChip(be.winLoss, be.dateSent)
              const dateLabel = bidSearchDateLabel(be)
              return (
                <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontVariantNumeric: 'tabular-nums' }}>
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
          : null}
      </span>
      {je && je.lineCount > 0 ? (
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
      ) : null}
    </>
  )
}
