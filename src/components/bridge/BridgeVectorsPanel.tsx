import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { Vectors, VectorRow } from '../../lib/bridge/vectors'
import { reviewDoorHref } from '../../lib/people/reviewDoor'

/**
 * Vectors panel (v2.3344) — one row per person for one pay week: what they
 * moved on the company line. Field people carry contribution (earned − their
 * labor); office people carry billed / collected; the estimator carries bids.
 * The kernel decides the numbers and the order; this only draws them.
 */

const shortK = (n: number): string => `${n < 0 ? '−' : ''}$${(Math.abs(n) / 1000).toFixed(Math.abs(n) >= 100_000 ? 0 : 1)}k`
const money = (n: number): string => `${n < 0 ? '−' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`
const hrs = (h: number): string => (h === 0 ? '—' : `${h < 10 ? h.toFixed(1) : Math.round(h)}h`)

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const th: CSSProperties = { textAlign: 'right', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const td: CSSProperties = { textAlign: 'right', fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums', padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const navBtn: CSSProperties = { font: 'inherit', fontSize: '0.8rem', padding: '0.1rem 0.5rem', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }

const ROLE_WORD: Record<string, string> = {
  dev: 'dev',
  master_technician: 'master',
  assistant: 'office',
  controller: 'controller',
  subcontractor: 'sub',
  helpers: 'field',
  estimator: 'estimator',
  primary: 'primary',
  superintendent: 'super',
}

function usdCell(n: number, count?: number): string {
  if (n === 0 && !count) return '—'
  return count != null && count > 0 ? `${shortK(n)} (${count})` : shortK(n)
}

function contributionCell(r: VectorRow): { text: string; color: string; title: string } {
  if (r.contributionUsd == null) return { text: '—', color: 'var(--text-muted)', title: 'No approved field hours this week' }
  const color = r.contributionUsd >= 0 ? 'var(--text-green-700)' : 'var(--text-red-700)'
  const parts = [`earned ${money(r.earnedUsd)} on ${hrs(r.fieldHours)} field`, `labor ${money(r.laborUsd)}`]
  if (r.guessedEarnedUsd > 0) parts.push(`≈ ${money(r.guessedEarnedUsd)} of the earned figure is on jobs with no % complete (assumed half done)`)
  if (r.unratedHours > 0) parts.push(`${hrs(r.unratedHours)} on jobs with no contract $ (earned $0)`)
  if (r.noWage) parts.push('no pay config — labor costed at $0')
  const guessed = r.guessedEarnedUsd > 0
  return { text: `${guessed ? '≈ ' : ''}${r.contributionUsd < 0 ? '−' : '+'}${shortK(Math.abs(r.contributionUsd))}`, color: guessed ? 'var(--text-amber-800)' : color, title: parts.join(' · ') }
}

export function BridgeVectorsPanel(props: { vectors: Vectors; weekLabel: string; isCurrentWeek: boolean; canPrev: boolean; canNext: boolean; onPrev: () => void; onNext: () => void; loading: boolean; error: string | null }) {
  const { vectors: v, weekLabel } = props
  const fieldRows = v.rows.filter((r) => r.contributionUsd != null).length
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem', marginTop: '0.6rem' }} data-testid="bridge-vectors">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={label}>Vectors — who moved the number</span>
        <span style={det}>one row per person · pay week {weekLabel}{props.isCurrentWeek ? ' (so far)' : ''}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
          <button type="button" onClick={props.onPrev} disabled={!props.canPrev} style={{ ...navBtn, opacity: props.canPrev ? 1 : 0.4 }} aria-label="Previous pay week">
            ‹
          </button>
          <button type="button" onClick={props.onNext} disabled={!props.canNext} style={{ ...navBtn, opacity: props.canNext ? 1 : 0.4 }} aria-label="Next pay week">
            ›
          </button>
        </span>
      </div>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'baseline', marginTop: '0.3rem' }}>
        <span style={{ fontSize: '1.2rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: v.totals.contributionUsd >= 0 ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>
          {v.totals.contributionUsd < 0 ? '−' : '+'}
          {shortK(Math.abs(v.totals.contributionUsd))}
        </span>
        <span style={det}>
          field contribution this week — earned {shortK(v.totals.earnedUsd)} on {hrs(v.totals.fieldHours)} approved field hours − their labor; {fieldRows} {fieldRows === 1 ? 'person' : 'people'} in the field ·
          billed {shortK(v.totals.billedUsd)} · collected {shortK(v.totals.collectedUsd)}
          {v.totals.bidsWonUsd > 0 ? ` · bids won ${shortK(v.totals.bidsWonUsd)}` : ''}
          {v.totals.pendingHours > 0 ? ` · ${hrs(v.totals.pendingHours)} awaiting approval` : ''}
          {v.totals.guessedEarnedUsd > 0 && (
            <span style={{ color: 'var(--text-amber-800)' }}> · ≈ {shortK(v.totals.guessedEarnedUsd)} of the earned figure is on jobs assumed half done — set % complete to make it real</span>
          )}
        </span>
      </div>
      {props.error ? (
        <div style={{ ...det, color: 'var(--text-red-700)', padding: '0.6rem 0' }}>{props.error}</div>
      ) : props.loading ? (
        <div style={{ ...det, padding: '0.6rem 0' }}>Loading people…</div>
      ) : v.rows.length === 0 ? (
        <div style={{ ...det, padding: '0.6rem 0' }}>Nothing recorded for this week yet.</div>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: '0.3rem' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left' }}>Person</th>
                <th style={th}>Field h</th>
                <th style={th}>Office / bid h</th>
                <th style={th}>Earned</th>
                <th style={th}>Labor</th>
                <th style={th}>Contribution</th>
                <th style={th}>$/h</th>
                <th style={th}>% reports</th>
                <th style={th}>Billed</th>
                <th style={th}>Collected</th>
                <th style={th}>Bids sent</th>
                <th style={th}>Bids won</th>
              </tr>
            </thead>
            <tbody>
              {v.rows.map((r) => {
                const c = contributionCell(r)
                return (
                  <tr key={r.userId}>
                    <td style={{ ...td, textAlign: 'left' }}>
                      <Link
                        to={reviewDoorHref({ person: r.name, from: v.weekStart, to: v.weekEnd })}
                        title={`Open ${r.name}'s week on People → Review`}
                        style={{ fontWeight: 600, color: 'var(--text)', textDecorationLine: 'underline', textDecorationColor: 'var(--border-strong)', textUnderlineOffset: 3 }}
                      >
                        {r.name}
                      </Link>
                      <span style={{ ...det, marginLeft: '0.4rem' }}>
                        {' '}
                        {r.role ? (ROLE_WORD[r.role] ?? r.role) : ''}
                        {r.isSalary ? ' · salary' : ''}
                        {r.noWage && (r.fieldHours > 0 || r.officeBidHours > 0) ? ' · no wage on file' : ''}
                      </span>
                    </td>
                    <td style={td}>
                      {hrs(r.fieldHours)}
                      {r.pendingHours > 0 && <span style={{ ...det, color: 'var(--text-amber-800)' }}> +{hrs(r.pendingHours)} waiting</span>}
                    </td>
                    <td style={td}>{hrs(r.officeBidHours)}</td>
                    <td style={td} title={r.guessedEarnedUsd > 0 ? `≈ ${money(r.guessedEarnedUsd)} on jobs assumed half done` : undefined}>
                      {r.earnedUsd === 0 ? '—' : `${r.guessedEarnedUsd > 0 ? '≈ ' : ''}${shortK(r.earnedUsd)}`}
                    </td>
                    <td style={td}>{r.laborUsd === 0 ? '—' : shortK(r.laborUsd)}</td>
                    <td style={{ ...td, fontWeight: 700, color: c.color }} title={c.title}>
                      {c.text}
                    </td>
                    <td style={td}>{r.contributionPerHour == null ? '—' : money(r.contributionPerHour)}</td>
                    <td style={td}>{r.pctReports === 0 ? '—' : r.pctReports}</td>
                    <td style={td}>{usdCell(r.billedUsd, r.billedCount)}</td>
                    <td style={td}>{usdCell(r.collectedUsd, r.collectedCount)}</td>
                    <td style={td}>{usdCell(r.bidsSentUsd, r.bidsSentCount)}</td>
                    <td style={td}>{usdCell(r.bidsWonUsd, r.bidsWonCount)}</td>
                  </tr>
                )
              })}
              <tr>
                <td style={{ ...td, textAlign: 'left', fontWeight: 700, borderBottom: 'none' }}>Company</td>
                <td style={{ ...td, fontWeight: 700, borderBottom: 'none' }}>{hrs(v.totals.fieldHours)}</td>
                <td style={{ ...td, fontWeight: 700, borderBottom: 'none' }}>{hrs(v.totals.officeBidHours)}</td>
                <td style={{ ...td, fontWeight: 700, borderBottom: 'none' }}>{shortK(v.totals.earnedUsd)}</td>
                <td style={{ ...td, fontWeight: 700, borderBottom: 'none' }}>{shortK(v.totals.laborUsd)}</td>
                <td style={{ ...td, fontWeight: 700, borderBottom: 'none', color: v.totals.contributionUsd >= 0 ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>
                  {v.totals.contributionUsd < 0 ? '−' : '+'}
                  {shortK(Math.abs(v.totals.contributionUsd))}
                </td>
                <td style={{ ...td, fontWeight: 700, borderBottom: 'none' }}>{v.totals.fieldHours > 0 ? money(v.totals.contributionUsd / v.totals.fieldHours) : '—'}</td>
                <td style={{ ...td, borderBottom: 'none' }} />
                <td style={{ ...td, fontWeight: 700, borderBottom: 'none' }}>{shortK(v.totals.billedUsd)}</td>
                <td style={{ ...td, fontWeight: 700, borderBottom: 'none' }}>{shortK(v.totals.collectedUsd)}</td>
                <td style={{ ...td, borderBottom: 'none' }} />
                <td style={{ ...td, fontWeight: 700, borderBottom: 'none' }}>{v.totals.bidsWonUsd === 0 ? '—' : shortK(v.totals.bidsWonUsd)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <div style={{ ...det, marginTop: '0.4rem' }}>
        A name opens that person's week on People → Review (the same earned rule, v2.3360). Earned = approved field hours × the job's contract ÷ expected hours (the Bridge's own rate); labor = hours × the person's pay-config wage. Contribution is labor-only — materials and sub sheets are job costs, not a person's vector. Billed = invoices sent by that account; collected = payments they recorded; % reports = job % updates + field reports filed; bids by the estimator on the bid.
        {v.unattributed.billedUsd + v.unattributed.collectedUsd + v.unattributed.bidsWonUsd > 0 || v.unattributed.pctReports > 0 ? (
          <>
            {' '}
            Not on anyone's row this week: {[
              v.unattributed.billedUsd > 0 ? `billed ${shortK(v.unattributed.billedUsd)}` : null,
              v.unattributed.collectedUsd > 0 ? `collected ${shortK(v.unattributed.collectedUsd)}` : null,
              v.unattributed.pctReports > 0 ? `${v.unattributed.pctReports} % reports` : null,
              v.unattributed.bidsWonUsd > 0 ? `bids won ${shortK(v.unattributed.bidsWonUsd)}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}{' '}
            (system writes, or no estimator on the bid).
          </>
        ) : null}
      </div>
    </div>
  )
}
