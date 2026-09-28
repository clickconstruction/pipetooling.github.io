import { useMemo, useState } from 'react'
import { buildGcChecksReport, checkAppliedSentence, checkHeadline, checkMoveWords, findChecks, type ChecksEventIn, type ChecksJobIn } from '../../lib/jobs/gcChecksApplied'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, PAPER } from '../../lib/portal/portalTheme'

export type PortalChecks = { jobs: ChecksJobIn[]; events: ChecksEventIn[] }

/** The id the edge function stamps on every kept job — mirror of `_shared/portalChecks.ts` PORTAL_CHECKS_VIEWER. */
export const PORTAL_CHECKS_VIEWER = 'viewer'

/** How many payments show before "Show all". */
const SHOWN = 5

/**
 * "Your payments" on the customer portal (v2.4053, "Where the checks went"
 * PR 5): the GC's own bookkeeper asks the page instead of the office — type a
 * check number, an amount or a day and read where the check sits now, one
 * line per job and bill, then the moves that got it there. The newest
 * payments show before anything is typed. Screen only — the printed statement
 * already lists every payment under its job.
 */
export default function PortalPaymentsSection({ checks, formatUsd }: { checks: PortalChecks; formatUsd: (n: number) => string }) {
  const [query, setQuery] = useState('')
  const [all, setAll] = useState(false)
  const report = useMemo(() => buildGcChecksReport({ gcId: PORTAL_CHECKS_VIEWER, jobs: checks.jobs, events: checks.events }), [checks])
  if (report.checks.length === 0) return null
  const trimmed = query.trim()
  const results = trimmed ? findChecks(report.checks, trimmed) : all ? report.checks : report.checks.slice(0, SHOWN)
  const hidden = trimmed || all ? 0 : report.checks.length - results.length

  return (
    <section data-screen-only data-portal-payments style={{ marginTop: '1.9rem', background: CARD, border: `1px solid ${HAIR}`, padding: '16px 20px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: COPPER }}>Your payments</div>
        <div style={{ fontSize: 12, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
          {report.checks.length} on record · {formatUsd(report.summary.received)}
        </div>
      </div>
      <p style={{ margin: '6px 0 10px', fontSize: 12.5, color: MUTED, maxWidth: '60ch' }}>
        Where each check went: the bill on each job it sits on now, and any move since. Look one up by its number, its amount or the day it reached us.
      </p>
      <input
        id="portal-find-check"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Check number, amount or date"
        aria-label="Find a payment by check number, amount or date"
        style={{ width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: 14, padding: '7px 10px', border: `1px solid ${HAIR}`, background: PAPER, color: INK }}
      />
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {trimmed && results.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12.5, color: MUTED }}>No payment matches “{trimmed}”. Try the amount, or the day it reached us.</p>
        ) : null}
        {results.map((c) => (
          <div key={c.key} data-portal-payment style={{ borderTop: `1px solid ${HAIR}`, paddingTop: 8, fontSize: 13, color: INK, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {checkHeadline(c)}
              {c.noNumber ? <span style={{ marginLeft: 8, fontSize: 11.5, fontWeight: 400, color: COPPER }}>recorded without a number — tell us the number and we will add it</span> : null}
            </div>
            <div style={{ color: MUTED }}>{checkAppliedSentence(c)}</div>
            {c.wasOn.map((m, i) => (
              <div key={i} style={{ fontSize: 12, color: FAINT }}>
                {checkMoveWords(m)}
              </div>
            ))}
          </div>
        ))}
      </div>
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setAll(true)}
          style={{ marginTop: 10, border: 'none', background: 'none', padding: 0, font: 'inherit', fontSize: 12.5, fontWeight: 600, color: COPPER, cursor: 'pointer' }}
        >
          Show all {report.checks.length} payments
        </button>
      ) : null}
    </section>
  )
}
