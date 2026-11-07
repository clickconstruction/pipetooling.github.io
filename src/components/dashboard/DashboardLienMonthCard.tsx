import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { lienMonthSpanWords, lienMonthWords, lienMonthZoneLine, type LienMonth, type LienMonthZoneKey } from '../../lib/jobs/lienMonthRhythm'

/**
 * The lien month on the Dashboard (punch list #235, PR 3): the small version of the Lien desk's bar
 * for everyone who can open the desk — one coloured strip of the five zones sized by their days with
 * today marked, then three lines: the zone today is in with its counts, what slipped so far, and
 * what is queuing for next month — and a link to the desk, where each zone's press lives. The month
 * is `useLienMonth`'s, the same kernel the desk reads, so the two never disagree. Nothing here reads,
 * writes, sends or files.
 */

export const LIEN_DESK_HREF = '/jobs?tab=stages&liendesk=1'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const CARD: CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', padding: '0.85rem 1rem', marginTop: '0.75rem', display: 'grid', gap: 8 }
const KICKER: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const MUTED: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const LINE: CSSProperties = { fontSize: '0.85rem', color: 'var(--text-strong)', display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }

const FILL: Record<LienMonthZoneKey, string> = {
  reminders: 'var(--text-violet-700)',
  notices: 'var(--text-blue-700)',
  liens: 'var(--text-red-700)',
  catch_up: 'var(--text-amber-800)',
  quiet: 'var(--bg-subtle)',
}
const GREEN = 'var(--text-green-700)'
const RED = 'var(--text-red-700)'

function monthWords(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month)
  return m ? `${MONTHS[Number(m[2]) - 1] ?? month} ${m[1]}` : month
}

export function DashboardLienMonthCard({ month }: { month: LienMonth | null }) {
  if (!month) return null
  const now = month.zones.find((z) => z.key === month.zone)!
  const nowLine = lienMonthZoneLine(now)
  const slips = month.zones.filter((z) => z.key !== 'catch_up' && z.key !== 'quiet').flatMap((z) => z.jobs.filter((j) => j.state === 'slipped'))
  const catchUp = month.zones.find((z) => z.key === 'catch_up')!
  const quiet = month.zones.find((z) => z.key === 'quiet')!
  const queue = lienMonthZoneLine(quiet)
  return (
    <section data-testid="lien-month-card" aria-label="The lien month" title={lienMonthWords(month)} style={CARD}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={KICKER}>The lien month</span>
        <span style={MUTED}>
          {monthWords(month.month)} · day {month.today}
        </span>
        <Link to={LIEN_DESK_HREF} data-testid="lien-month-card-desk" style={{ marginLeft: 'auto', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-blue-700)', textDecoration: 'none' }}>
          Open the Lien desk ›
        </Link>
      </div>
      <div style={{ position: 'relative', paddingTop: 10 }}>
        <span data-testid="lien-month-card-today" aria-hidden style={{ position: 'absolute', top: 0, left: `${month.todayPct}%`, width: 2, height: 20, background: 'var(--text-strong)', borderRadius: 1, zIndex: 1 }} />
        <div role="img" aria-label={`Day ${month.today} of ${month.daysInMonth}: ${now.label}`} style={{ display: 'grid', gridTemplateColumns: month.zones.map((z) => `${Math.max(1, z.days)}fr`).join(' '), gap: 2, height: 10, borderRadius: 5, overflow: 'hidden' }}>
          {month.zones.map((z) => {
            const line = lienMonthZoneLine(z)
            const on = z.state === 'now' && z.key !== 'quiet'
            const fill = line.tone === 'slipped' ? RED : line.tone === 'done' ? GREEN : on ? FILL[z.key] : 'var(--bg-subtle)'
            return <div key={z.key} data-testid={`lien-month-card-zone-${z.key}`} data-tone={line.tone} style={{ background: fill, opacity: on || line.tone === 'slipped' || line.tone === 'done' ? 1 : 0.9, border: z.key === 'quiet' ? '1px dashed var(--border)' : 'none', boxSizing: 'border-box' }} />
          })}
        </div>
      </div>
      <div style={LINE} data-testid="lien-month-card-now">
        <strong style={{ color: nowLine.tone === 'slipped' ? RED : nowLine.tone === 'done' ? GREEN : FILL[now.key] === 'var(--bg-subtle)' ? 'var(--text-700)' : FILL[now.key] }}>{now.label}</strong>
        <span style={MUTED}>days {lienMonthSpanWords(now.key, now.span)}</span>
        <span>{nowLine.head}</span>
        {nowLine.sub ? <span style={MUTED}>{nowLine.sub}</span> : null}
      </div>
      <div style={LINE} data-testid="lien-month-card-slipped">
        {slips.length ? (
          <>
            <strong style={{ color: RED }}>{slips.length} slipped</strong>
            <span style={MUTED}>{slips[0]!.title}</span>
            {catchUp.copies ? <span style={MUTED}>· {catchUp.copies} {catchUp.copies === 1 ? 'copy' : 'copies'} to mail</span> : null}
          </>
        ) : (
          <>
            <strong style={{ color: GREEN }}>nothing slipped</strong>
            {catchUp.copies ? <span style={MUTED}>{catchUp.copies} {catchUp.copies === 1 ? 'copy' : 'copies'} to mail</span> : null}
          </>
        )}
      </div>
      <div style={LINE} data-testid="lien-month-card-next">
        <span style={MUTED}>Next month</span>
        <span>{queue.head}</span>
      </div>
    </section>
  )
}
