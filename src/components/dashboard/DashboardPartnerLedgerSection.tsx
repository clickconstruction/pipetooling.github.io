import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import { mergeNotesIntoDisplay, type LedgerDisplayRow } from '../../lib/partnerLedger/partnerLedgerJournal'
import {
  buildJournalWeekCards,
  parsePartnerLedgerNotes,
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
 * pending-approval hours as no-dollar lines), then every week with activity
 * back to the start of the partnership. Statement acknowledgment (§9b) and a
 * light-pinned print of the selected week.
 *
 * v2.2111: the week cards are a weekly view over the SAME journal as Full
 * ledger (one full-history fetch shared by both) — back-charges appear in the
 * week they happened and every closing equals the journal's running balance,
 * so the math flows card to card with no invisible wedge.
 *
 * Self-fetching via the get_my_partner_* SECURITY DEFINER RPCs — renders
 * nothing for non-partners, and fail-softs to nothing if the PR 4 migration
 * isn't pushed yet, so client and migration deploy in either order.
 */

const money = (n: number) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const signedMoney = (n: number) => `${n < 0 ? '−' : '+'}${money(n)}`
/** Balance readout: minus only when negative (openings can be either sign). */
const signedBalance = (n: number) => `${n < 0 ? '−' : ''}${money(n)}`

export function DashboardPartnerLedgerSection({ asPartnershipId }: { asPartnershipId?: string } = {}) {
  const [summary, setSummary] = useState<PartnerSummary | null>(null)
  const [cards, setCards] = useState<WeekCard[]>([])
  const [idx, setIdx] = useState(0)
  const [acking, setAcking] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [fullRows, setFullRows] = useState<LedgerDisplayRow[] | null>(null)
  const [fullOpen, setFullOpen] = useState(false)

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
      // One full-history fetch feeds BOTH the week cards and Full ledger —
      // same journal, so the two views can never disagree.
      const ledRes = asPartnershipId
        ? await supabase.rpc('get_partner_ledger_as', { p_partnership_id: asPartnershipId, p_weeks: 520 })
        : await supabase.rpc('get_my_partner_ledger', { p_weeks: 520 })
      const stubs = ledRes.error ? [] : parsePartnerLedgerStubs(ledRes.data)
      const offsets = ledRes.error ? [] : parsePartnerLedgerOffsets(ledRes.data)
      const visibleNotes = ledRes.error ? [] : parsePartnerLedgerNotes(ledRes.data)
      setCards(buildJournalWeekCards(s, stubs, offsets))
      setFullRows(mergeNotesIntoDisplay(partnerStubsToJournal(stubs, offsets).rows, visibleNotes))
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

  function toggleFullLedger() {
    setFullOpen((prev) => !prev)
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
        <div style="font-weight:800;font-size:13px;">CLICK PLUMBING, ELECTRICAL, AND HVAC</div>
        <div style="font-size:19px;font-weight:700;">Partner weekly statement</div>
        <div style="color:#6d6759;font-size:12px;margin:2px 0 14px;">${summary?.display_name ?? ''} · Week of ${c.weekStart}${c.weekEnd ? ` – ${c.weekEnd}` : ' (in progress)'}</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tr><td style="padding:6px 0;border-bottom:1px solid #e6e1d5;">Opening balance</td><td style="padding:6px 0;border-bottom:1px solid #e6e1d5;text-align:right;font-weight:600;">${c.opening != null ? signedBalance(c.opening) : '—'}</td></tr>
          ${rows}
          <tr><td style="padding:8px 0;border-top:2px solid #211d16;font-weight:800;">Closing balance</td><td style="padding:8px 0;border-top:2px solid #211d16;text-align:right;font-weight:800;">${signedBalance(c.closing)}</td></tr>
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

      {/* Statement frame (v2.2100): the week opens quietly at the top, the
          lines do the arithmetic, and the total lands where the math finishes
          — labeled in plain words ("Click owes you" / "you owe Click")
          instead of a floating headline the reader has to reconcile. The live
          week's total is still the settle-up position — posted balance plus
          charges waiting for a statement (owner call, v2.2009); closed weeks
          keep their statement's closing balance. */}
      <div style={{ marginTop: '0.4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', alignItems: 'baseline', padding: '0.4rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <span>Week opened</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {card && card.opening != null ? `${card.opening < 0 ? '−' : ''}${money(card.opening)}` : '—'}
          </span>
        </div>
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {card?.lines.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0' }}>Nothing posted this week yet.</p>
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
        {(() => {
          // The chain already books charges at their dates (same journal as
          // Full ledger), so the card's closing IS the settle-up position —
          // no separate pending wedge to add.
          const total = card ? card.closing : null
          if (total == null) return null
          const direction = total >= 0 ? 'Click owes you' : 'you owe Click'
          return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.6rem', padding: '0.55rem 0 0.1rem', borderTop: '2px solid var(--text-strong)' }}>
              <span style={{ fontWeight: 800, fontSize: '0.86rem', minWidth: 0 }}>
                {card?.open ? 'So far this week' : 'Week closed'}
                <span style={{ display: 'block', fontWeight: 500, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {card?.open ? `${direction} · updates as hours approve` : direction}
                </span>
              </span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {money(total)}
              </span>
            </div>
          )
        })()}
      </div>

      {/* Statement actions are the partner's own — the lens hides the row
          entirely (ack status lives on the office Statements tab). */}
      {asPartnershipId ? null : (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.6rem', alignItems: 'center' }}>
          {card && !card.open && !card.stubId ? (
            <span style={{ fontSize: '0.72rem', fontWeight: 650, color: 'var(--text-muted)' }}>
              Charges only — no statement was issued this week.
            </span>
          ) : card && !card.open ? (
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
      )}
      <div style={{ marginTop: '0.6rem', paddingTop: '0.55rem', borderTop: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={toggleFullLedger}
          style={{ display: 'block', margin: '0 auto', font: 'inherit', fontSize: '0.78rem', fontWeight: 650, padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer' }}
        >
          {fullOpen ? '▾ Hide full ledger' : '▸ Full ledger'}
        </button>
        {fullOpen ? (
          fullRows == null ? (
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
                  {[...fullRows].reverse().map((r, i) =>
                    r.kind === 'note' ? (
                      <tr key={i} style={{ background: 'var(--bg-muted)' }}>
                        <td style={{ padding: '0.32rem 0.4rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{r.date}</td>
                        <td colSpan={3} style={{ padding: '0.32rem 0.4rem', borderBottom: '1px solid var(--border)', fontStyle: 'italic', color: 'var(--text-700)' }}>
                          {r.label}
                        </td>
                      </tr>
                    ) : r.amount == null || r.balance == null ? null : (
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
                    ),
                  )}
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
