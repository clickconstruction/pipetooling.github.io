import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import { netPosition, type JournalRow } from '../../lib/partnerLedger/partnerLedgerJournal'
import {
  buildWeekCards,
  parsePartnerLedgerOffsets,
  parsePartnerLedgerStubs,
  parsePartnerSummary,
  partnerStubsToJournal,
  type PartnerSummary,
  type WeekCard,
} from '../../lib/partnerLedger/partnerWeeks'
import { DashboardGroupCard } from './DashboardGroupCard'

/**
 * "Your ledger" — the partner's own dashboard window (PARTNERSHIPS_PLAN.md
 * PR 4). Week-to-week ‹ › navigation: the live week first (balance so far,
 * pending-approval hours as no-dollar lines), then each generated statement
 * week with its lines and opening/closing chain. Statement acknowledgment
 * (§9b) and a light-pinned print of the selected week.
 *
 * Self-fetching via the get_my_partner_* SECURITY DEFINER RPCs — renders
 * nothing for non-partners, and fail-softs to nothing if the PR 4 migration
 * isn't pushed yet, so client and migration deploy in either order.
 */

const money = (n: number) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const signedMoney = (n: number) => `${n < 0 ? '−' : '+'}${money(n)}`

export function DashboardPartnerLedgerSection({ asPartnershipId }: { asPartnershipId?: string } = {}) {
  const [summary, setSummary] = useState<PartnerSummary | null>(null)
  const [cards, setCards] = useState<WeekCard[]>([])
  const [idx, setIdx] = useState(0)
  const [acking, setAcking] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [fullRows, setFullRows] = useState<JournalRow[] | null>(null)
  const [fullOpen, setFullOpen] = useState(false)
  const [fullLoading, setFullLoading] = useState(false)

  const load = useCallback(async () => {
    // Lens mode (asPartnershipId): dev-only *_as RPCs share the exact inner
    // body and status gate with the partner's own calls — same truth.
    const sumRes = asPartnershipId
      ? await supabase.rpc('get_partner_summary_as', { p_partnership_id: asPartnershipId })
      : await supabase.rpc('get_my_partner_summary')
    if (sumRes.error) {
      setSummary(null)
      setLoaded(true)
      return
    }
    const s = parsePartnerSummary(sumRes.data)
    setSummary(s)
    if (s) {
      const ledRes = asPartnershipId
        ? await supabase.rpc('get_partner_ledger_as', { p_partnership_id: asPartnershipId, p_weeks: 8 })
        : await supabase.rpc('get_my_partner_ledger', { p_weeks: 8 })
      const stubs = ledRes.error ? [] : parsePartnerLedgerStubs(ledRes.data)
      setCards(buildWeekCards(s, stubs))
    }
    setLoaded(true)
  }, [asPartnershipId])

  useEffect(() => {
    void load()
  }, [load])

  const card = cards[idx] ?? null
  const latestUnacked = useMemo(
    () => summary?.latest_statement != null && summary.latest_statement.partner_ack_at == null,
    [summary],
  )

  if (!loaded || !summary || !summary.modules.weekly_statement || cards.length === 0) return null

  async function toggleFullLedger() {
    if (fullOpen) {
      setFullOpen(false)
      return
    }
    setFullOpen(true)
    if (fullRows == null) {
      setFullLoading(true)
      const res = asPartnershipId
        ? await supabase.rpc('get_partner_ledger_as', { p_partnership_id: asPartnershipId, p_weeks: 520 })
        : await supabase.rpc('get_my_partner_ledger', { p_weeks: 520 })
      const stubs = res.error ? [] : parsePartnerLedgerStubs(res.data)
      const offsets = res.error ? [] : parsePartnerLedgerOffsets(res.data)
      setFullRows(partnerStubsToJournal(stubs, offsets).rows)
      setFullLoading(false)
    }
  }

  async function acknowledge(stubId: string) {
    setAcking(true)
    const { error } = await supabase.rpc('acknowledge_partner_statement', { p_pay_stub_id: stubId })
    if (!error) await load()
    setAcking(false)
  }

  function printCard(c: WeekCard) {
    const rows = c.lines
      .filter((l) => l.amount != null)
      .map(
        (l) =>
          `<tr><td style="padding:6px 0;border-bottom:1px solid #e6e1d5;">${l.label}${l.sub ? ` <span style="color:#6d6759;">· ${l.sub}</span>` : ''}</td><td style="padding:6px 0;border-bottom:1px solid #e6e1d5;text-align:right;font-weight:600;">${signedMoney(l.amount ?? 0)}</td></tr>`,
      )
      .join('')
    openHtmlPrintWindow(
      `<div data-theme="light" style="font-family:system-ui,sans-serif;color:#211d16;max-width:640px;margin:0 auto;padding:24px;">
        <div style="font-weight:800;font-size:13px;">CLICK PLUMBING &amp; ELECTRICAL</div>
        <div style="font-size:19px;font-weight:700;">Partner weekly statement</div>
        <div style="color:#6d6759;font-size:12px;margin:2px 0 14px;">${summary?.display_name ?? ''} · Week of ${c.weekStart}${c.weekEnd ? ` – ${c.weekEnd}` : ' (in progress)'}</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tr><td style="padding:6px 0;border-bottom:1px solid #e6e1d5;">Opening balance</td><td style="padding:6px 0;border-bottom:1px solid #e6e1d5;text-align:right;font-weight:600;">${c.opening != null ? money(c.opening) : '—'}</td></tr>
          ${rows}
          <tr><td style="padding:8px 0;border-top:2px solid #211d16;font-weight:800;">Closing balance</td><td style="padding:8px 0;border-top:2px solid #211d16;text-align:right;font-weight:800;">${money(c.closing)}</td></tr>
        </table>
        <p style="color:#6d6759;font-size:11px;">${c.companyAckAt ? `Company acknowledged ${new Date(c.companyAckAt).toLocaleString()}. ` : ''}${c.partnerAckAt ? `Partner acknowledged ${new Date(c.partnerAckAt).toLocaleString()}.` : ''}</p>
      </div>`,
    )
  }

  return (
    <DashboardGroupCard title="Your ledger">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', margin: '0.1rem 0 0.4rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={idx >= cards.length - 1}
          onClick={() => setIdx((i) => Math.min(cards.length - 1, i + 1))}
          style={{ font: 'inherit', fontSize: '0.8rem', fontWeight: 650, padding: '0.35rem 0.8rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', cursor: idx >= cards.length - 1 ? 'default' : 'pointer', opacity: idx >= cards.length - 1 ? 0.35 : 1 }}
        >
          ‹ Older
        </button>
        <span style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-700)', minWidth: '11rem' }}>
          Week of {card?.weekStart}
          {card?.open ? ' · in progress' : ''}
        </span>
        <button
          type="button"
          disabled={idx <= 0}
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          style={{ font: 'inherit', fontSize: '0.8rem', fontWeight: 650, padding: '0.35rem 0.8rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', cursor: idx <= 0 ? 'default' : 'pointer', opacity: idx <= 0 ? 0.35 : 1 }}
        >
          Newer ›
        </button>
      </div>

      <div style={{ fontSize: '1.6rem', fontWeight: 750, fontVariantNumeric: 'tabular-nums' }}>
        {card && card.closing < 0 ? '−' : ''}
        {card ? money(card.closing) : ''}
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '-0.15rem' }}>
        {card?.open
          ? `balance so far · updates as hours approve`
          : `closing balance · week opened at ${card && card.opening != null ? money(card.opening) : '—'}`}
      </div>
      {card?.open && summary.pending_offsets.count > 0 ? (
        <div style={{ fontSize: '0.72rem', fontWeight: 650, color: 'var(--text-amber-700)', fontVariantNumeric: 'tabular-nums' }}>
          with pending charges: {netPosition(card.closing, summary.pending_offsets.net) < 0 ? '−' : ''}
          {money(netPosition(card.closing, summary.pending_offsets.net))} · {summary.pending_offsets.count} charge(s)
          waiting for the next statement
        </div>
      ) : null}

      <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.5rem' }}>
        {card?.lines.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>Nothing posted this week yet.</p>
        ) : (
          card?.lines.map((l, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', alignItems: 'baseline', padding: '0.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-700)', minWidth: 0 }}>
                {l.label}
                {l.sub ? <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{l.sub}</span> : null}
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, whiteSpace: 'nowrap', color: l.amount == null ? 'var(--text-muted)' : l.cls === 'pos' ? '#16a34a' : l.cls === 'neg' ? 'var(--text-red-600)' : 'var(--text-muted)' }}>
                {l.amount == null ? '—' : l.amount === 0 ? '0.00' : signedMoney(l.amount)}
              </span>
            </div>
          ))
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.6rem', alignItems: 'center' }}>
        {card && !card.open ? (
          <>
            <button
              type="button"
              onClick={() => printCard(card)}
              style={{ font: 'inherit', fontSize: '0.8rem', fontWeight: 650, padding: '0.35rem 0.7rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer' }}
            >
              Print / save PDF
            </button>
            {card.partnerAckAt ? (
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a' }}>
                acknowledged {new Date(card.partnerAckAt).toLocaleDateString()}
              </span>
            ) : card.stubId && asPartnershipId ? (
              <>
                <button
                  type="button"
                  disabled
                  style={{ font: 'inherit', fontSize: '0.8rem', fontWeight: 650, padding: '0.35rem 0.7rem', borderRadius: 6, border: 'none', background: 'var(--bg-muted)', color: 'var(--text-muted)', cursor: 'not-allowed' }}
                >
                  Acknowledge statement
                </button>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-amber-700)' }}>
                  the partner sees this button — only they can press it
                </span>
              </>
            ) : card.stubId ? (
              <button
                type="button"
                disabled={acking}
                onClick={() => card.stubId && void acknowledge(card.stubId)}
                style={{ font: 'inherit', fontSize: '0.8rem', fontWeight: 650, padding: '0.35rem 0.7rem', borderRadius: 6, border: 'none', background: '#2563eb', color: 'var(--surface)', cursor: 'pointer', opacity: acking ? 0.6 : 1 }}
              >
                Acknowledge statement
              </button>
            ) : null}
          </>
        ) : latestUnacked ? (
          <span style={{ fontSize: '0.72rem', fontWeight: 650, color: 'var(--text-amber-700)' }}>
            Last week’s statement is one ‹ back — it’s waiting on your acknowledgment.
          </span>
        ) : null}
      </div>
      <div style={{ marginTop: '0.6rem', paddingTop: '0.55rem', borderTop: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={() => void toggleFullLedger()}
          style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 650, padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer' }}
        >
          {fullOpen ? '▾ Hide full ledger' : '▸ Full ledger — every posting, all time'}
        </button>
        {fullOpen ? (
          fullLoading || fullRows == null ? (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.4rem 0 0' }}>Loading…</p>
          ) : fullRows.length === 0 ? (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.4rem 0 0' }}>Nothing posted yet.</p>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: '0.4rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr>
                    {['Date', 'Posting', 'Amount', 'Balance'].map((h, i) => (
                      <th key={h} style={{ textAlign: i >= 2 ? 'right' : 'left', fontSize: '0.64rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.3rem 0.4rem', borderBottom: '2px solid var(--border)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...fullRows].reverse().map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: '0.32rem 0.4rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{r.date}</td>
                      <td style={{ padding: '0.32rem 0.4rem', borderBottom: '1px solid var(--border)' }}>
                        {r.label}
                        {r.detail ? <span style={{ color: 'var(--text-muted)' }}> · {r.detail}</span> : null}
                      </td>
                      <td style={{ padding: '0.32rem 0.4rem', borderBottom: '1px solid var(--border)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: r.amount >= 0 ? '#16a34a' : 'var(--text-red-600)', whiteSpace: 'nowrap' }}>
                        {r.amount >= 0 ? '+' : '−'}{money(r.amount)}
                      </td>
                      <td style={{ padding: '0.32rem 0.4rem', borderBottom: '1px solid var(--border)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {r.balance < 0 ? '−' : ''}{money(r.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: '0.35rem 0 0' }}>
                Every posting, payout, and charge, newest first — charges count on the date they happened; your weekly
                statements list them as the paper record.
              </p>
            </div>
          )
        ) : null}
      </div>
    </DashboardGroupCard>
  )
}
