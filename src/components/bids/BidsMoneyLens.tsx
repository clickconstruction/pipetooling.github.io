/**
 * Money on my bids (punch list #129, v2.5651): the Bid Board's Money lens. Every won job with money open as the
 * estimator's chase list, past their word first, then no word, then they say they paid with nothing landed, then
 * waiting, each row the money line itself (`BidMoneyLine`: the open amount, the customer's word, Send the pay page,
 * the customer's door, Write down their word, the trail) with its standing and its bid in front. One page-wide read
 * (`useBidBoardMoneyStrips`), the lines the person is a person of; *Only my bids* keeps the bids they estimated or
 * account-manage, on by default for an estimator, off for the office, which reads who is talking to whom.
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import type { useBidBoardMoneyStrips } from '../../hooks/useBidBoardMoneyStrips'
import { buildMoneyLens, moneyLensRollup, MONEY_LENS_EMPTY_ALL, MONEY_LENS_EMPTY_MINE, type MoneyLensBid, type MoneyLensStanding } from '../../lib/bids/moneyLens'
import { todayYmd } from '../../lib/bids/bidMoneyLine'
import { formatBidLedgerNumberLabel, resolveBidLedgerPrefix, type LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { BidMoneyLine } from './BidMoneyLine'

type Props = {
  bids: BidWithBuilder[]
  strips: ReturnType<typeof useBidBoardMoneyStrips>
  ledgerPrefixMap: LedgerPrefixMap
  authUserId: string | null
  narrowViewport640?: boolean
}

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }
const rollupPill: CSSProperties = { fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.65rem', borderRadius: 999, background: 'var(--bg-muted)', color: 'var(--text-700)' }
const muted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }

const STANDING_COLOR: Record<MoneyLensStanding, string> = {
  past: 'var(--text-red-700)',
  noWord: 'var(--text-amber-700)',
  stale: 'var(--text-amber-700)',
  waiting: 'var(--text-green-700)',
  claimed: 'var(--text-700)',
  paid: 'var(--text-muted)',
}

function toLensBid(bid: BidWithBuilder, prefixMap: LedgerPrefixMap): MoneyLensBid {
  const num = (bid.bid_number ?? '').trim()
  const est = bid.estimator
  const one = Array.isArray(est) ? est[0] : est
  return {
    id: bid.id,
    label: num ? formatBidLedgerNumberLabel(resolveBidLedgerPrefix(bid.service_type_id, prefixMap), num) : (bid.project_name ?? '').trim() || bid.id.slice(0, 8),
    estimatorName: (one?.name ?? '').trim() || null,
    estimatorUserId: bid.estimator_id,
    accountManagerUserId: bid.account_manager_id,
  }
}

export function BidsMoneyLens({ bids, strips, ledgerPrefixMap, authUserId, narrowViewport640 = false }: Props) {
  const { role } = useAuth()
  const [onlyMine, setOnlyMine] = useState(role === 'estimator' || role === 'primary')
  const wonBids = useMemo(() => bids.filter((b) => b.outcome === 'won' || b.outcome === 'started_or_complete'), [bids])
  const lensBids = useMemo(() => wonBids.map((b) => toLensBid(b, ledgerPrefixMap)), [wonBids, ledgerPrefixMap])
  const today = useMemo(() => todayYmd(), [])
  const lens = useMemo(() => buildMoneyLens({ lines: strips.lines, bids: lensBids, authUserId, today, onlyMine }), [strips.lines, lensBids, authUserId, today, onlyMine])

  const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.45rem 0.65rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', flexWrap: narrowViewport640 ? 'wrap' : 'nowrap' }
  const c1: CSSProperties = { flex: '0 0 8rem', fontWeight: 700, fontSize: '0.75rem' }
  const c2: CSSProperties = { flex: '0 0 11rem', minWidth: narrowViewport640 ? '100%' : 0 }
  const c3: CSSProperties = { flex: '1 1 0', minWidth: narrowViewport640 ? '100%' : 0 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} data-testid="money-lens">
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }}>
            Money on {onlyMine ? 'my' : 'our'} bids
            {strips.loaded ? <span style={rollupPill} data-testid="money-lens-rollup">{moneyLensRollup(lens)}</span> : null}
            <span style={{ ...muted, fontWeight: 400 }}>of {wonBids.length} won or started · past their word first</span>
          </div>
          <label style={{ ...muted, display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> Only my bids
          </label>
        </div>
        {!strips.loaded ? (
          <p style={{ margin: 0, ...muted }}>Reading the money…</p>
        ) : lens.rows.length === 0 ? (
          <p style={{ margin: 0, ...muted }} data-testid="money-lens-empty">
            {onlyMine ? MONEY_LENS_EMPTY_MINE : MONEY_LENS_EMPTY_ALL}
          </p>
        ) : (
          <div>
            {!narrowViewport640 ? (
              <div style={{ display: 'flex', gap: '0.75rem', padding: '0.25rem 0.65rem', fontSize: '0.66rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>
                <span style={c1}>Where it stands</span>
                <span style={c2}>Job · bid</span>
                <span style={c3}>Money · their last word</span>
              </div>
            ) : null}
            {lens.rows.map((r) => (
              <div key={r.line.job.id} style={rowStyle} data-testid="money-lens-row" data-standing={r.standing}>
                <span style={{ ...c1, color: STANDING_COLOR[r.standing] }}>{r.standingWords}</span>
                <span style={c2}>
                  <b>{r.line.job.number ? `#${r.line.job.number} · ` : ''}{r.line.job.name || 'Job'}</b>
                  <div style={muted}>
                    {r.line.job.customerName ?? ''}
                    {r.bidLabel ? ` · ${r.bidLabel}` : ''}
                    {r.estimatorName ? ` · bid by ${r.estimatorName}` : ''}
                  </div>
                </span>
                <span style={c3}>
                  <BidMoneyLine bidId={r.line.bidId ?? r.line.job.id} line={r.line} compact onChanged={strips.reload} />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
