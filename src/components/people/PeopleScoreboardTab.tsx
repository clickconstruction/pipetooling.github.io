import type { CSSProperties } from 'react'
import {
  gaugeBand,
  gaugeBandSegments,
  gaugeDistanceToGreen,
  gaugeNeedleTopPct,
  greenWeekCount,
  type GaugeBand,
  type GaugeConfig,
} from '../../lib/people/scoreboardGauge'

/**
 * People → Scoreboard (v2.1312, dev-only for calibration): the two-bar
 * traffic-light gauge — job profit ratio (green up) and office cost per field
 * dollar (green down) — with "what moves it" chips, 12-week band trends, and
 * the bonus-window banner.
 *
 * SAMPLE DATA for now. The production plan (agreed 2026-08-02): one
 * SECURITY DEFINER RPC (the get_dashboard_payroll_totals precedent) returns
 * {band_position, band, weekly_bands[12], signals[]} per gauge — dollar
 * numerators/denominators never leave the database for non-privileged roles.
 * Two known data caveats before office exposure: office ACH overhead (~$16.8k
 * /90d) is invisible until banking-attribution Phase 2 lands, and thresholds
 * must be calibrated against real ratios (dev-tunable app_settings keys).
 */

const PROFIT_GAUGE: GaugeConfig = { min: 0.5, max: 1.5, redBelow: 1.0, greenAbove: 1.2, direction: 'higher' }
const OFFICE_GAUGE: GaugeConfig = { min: 0, max: 50, redBelow: 40, greenAbove: 25, direction: 'lower' }

/** Sample state — replace with the RPC payload when the data spine ships. */
const SAMPLE = {
  profit: {
    value: 1.18,
    weeks: ['red', 'yellow', 'yellow', 'green', 'green', 'yellow', 'green', 'green', 'green', 'yellow', 'yellow', 'yellow'] as GaugeBand[],
    signals: [
      { label: '90+ unbilled · 3 · $42.9k', tone: 'red' as const },
      { label: 'Done, not billed · 4 jobs', tone: 'amber' as const },
      { label: 'Unattributed sheets · 4', tone: 'amber' as const },
    ],
  },
  office: {
    value: 31,
    weeks: ['yellow', 'yellow', 'red', 'yellow', 'green', 'green', 'yellow', 'green', 'green', 'green', 'yellow', 'yellow'] as GaugeBand[],
    signals: [
      { label: 'Office hours share · 22%', tone: 'blue' as const },
      { label: 'Field hours this week ↑ 6%', tone: 'green' as const },
      { label: 'Idle field days · 2', tone: 'amber' as const },
    ],
  },
}

/** Saturated band colors (status colors stay literal per the theme convention). */
const BAND_FILL: Record<GaugeBand, string> = { green: '#16a34a', yellow: '#d97706', red: '#b91c1c' }
const BAND_TEXT: Record<GaugeBand, string> = {
  green: 'var(--text-green-600)',
  yellow: 'var(--text-amber-800)',
  red: 'var(--text-red-600)',
}
const BAND_LABEL: Record<GaugeBand, string> = { green: 'GREEN', yellow: 'YELLOW', red: 'RED' }

const CHIP_TONES = {
  red: { background: 'var(--bg-red-tint)', color: 'var(--text-red-600)' },
  amber: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
  green: { background: 'var(--bg-green-tint)', color: 'var(--text-green-600)' },
  blue: { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' },
} as const

const chipStyle = (tone: keyof typeof CHIP_TONES): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 24,
  padding: '0 10px',
  borderRadius: 9999,
  fontSize: '0.74rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  width: 'fit-content',
  ...CHIP_TONES[tone],
})

function TrendStrip({ weeks, ariaLabel }: { weeks: GaugeBand[]; ariaLabel: string }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 6 }}>
        Last {weeks.length} weeks
      </div>
      <div role="img" aria-label={ariaLabel} style={{ display: 'flex', gap: 4 }}>
        {weeks.map((w, i) => (
          <div key={i} style={{ width: 22, height: 14, borderRadius: 3, background: BAND_FILL[w] }} />
        ))}
      </div>
    </div>
  )
}

function Gauge({
  title,
  hint,
  cfg,
  value,
  valueLabel,
  bandNote,
  ticks,
  signals,
  weeks,
}: {
  title: string
  hint: string
  cfg: GaugeConfig
  value: number
  valueLabel: string
  bandNote: string
  ticks: Array<{ atValue: number; label: string }>
  signals: Array<{ label: string; tone: keyof typeof CHIP_TONES }>
  weeks: GaugeBand[]
}) {
  const band = gaugeBand(value, cfg)
  const needleTop = gaugeNeedleTopPct(value, cfg)
  const segments = gaugeBandSegments(cfg)
  const counts = greenWeekCount(weeks)
  return (
    <div style={{ width: 430, maxWidth: '100%' }}>
      <h3 style={{ margin: '0 0 2px', fontSize: '0.9rem', color: 'var(--text-700)' }}>{title}</h3>
      <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', margin: '0 0 12px' }}>{hint}</p>
      <div style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
        <div style={{ position: 'relative', width: 34, flexShrink: 0, height: 250 }}>
          {ticks.map((t) => (
            <span
              key={t.label}
              style={{ position: 'absolute', right: 0, top: `${gaugeNeedleTopPct(t.atValue, cfg)}%`, transform: 'translateY(-50%)', fontSize: '0.68rem', color: 'var(--text-faint)' }}
            >
              {t.label}
            </span>
          ))}
        </div>
        <div
          role="meter"
          aria-label={`${title}: ${valueLabel}, ${BAND_LABEL[band]}`}
          aria-valuemin={cfg.min}
          aria-valuemax={cfg.max}
          aria-valuenow={value}
          style={{ position: 'relative', width: 64, height: 250, borderRadius: 8, border: '1px solid var(--border-strong)', flexShrink: 0 }}
        >
          {segments.map((seg) => (
            <div
              key={seg.band}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${seg.topPct}%`,
                height: `${seg.heightPct}%`,
                background: BAND_FILL[seg.band],
                borderRadius: seg.topPct === 0 ? '7px 7px 0 0' : seg.topPct + seg.heightPct >= 99.9 ? '0 0 7px 7px' : 0,
              }}
            />
          ))}
          <div style={{ position: 'absolute', left: -6, right: -6, top: `${needleTop}%`, height: 0, borderTop: '3px solid var(--text-strong)' }} />
          <span
            style={{ position: 'absolute', left: 76, top: `${needleTop}%`, transform: 'translateY(-50%)', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-strong)', whiteSpace: 'nowrap' }}
          >
            {valueLabel}
            <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: BAND_TEXT[band] }}>
              {BAND_LABEL[band]}
              {bandNote ? ` — ${bandNote}` : ''}
            </span>
          </span>
        </div>
        {/* spacer keeps the needle label clear of the signal chips */}
        <div style={{ width: 150, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 150, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
            What moves it
          </span>
          {signals.map((sig) => (
            <span key={sig.label} style={chipStyle(sig.tone)}>
              {sig.label}
            </span>
          ))}
        </div>
      </div>
      <TrendStrip weeks={weeks} ariaLabel={`${title}: ${counts.green} of ${counts.total} weeks green`} />
    </div>
  )
}

export function PeopleScoreboardTab() {
  const profitBand = gaugeBand(SAMPLE.profit.value, PROFIT_GAUGE)
  const officeBand = gaugeBand(SAMPLE.office.value, OFFICE_GAUGE)
  const greenCount = [profitBand, officeBand].filter((b) => b === 'green').length
  const profitGap = gaugeDistanceToGreen(SAMPLE.profit.value, PROFIT_GAUGE)
  const bonusOpen = greenCount === 2

  return (
    <div>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: '1rem',
          padding: '0.3rem 0.75rem',
          borderRadius: 9999,
          background: 'var(--bg-amber-tint)',
          color: 'var(--text-amber-800)',
          fontSize: '0.75rem',
          fontWeight: 600,
        }}
      >
        Sample data — dev-only while the data spine and thresholds are calibrated
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.4rem 1.6rem', maxWidth: 920 }}>
        <h2 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-strong)' }}>Company Scoreboard</h2>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
          Trailing 90 days · updates nightly · thresholds set by management
        </p>

        <div style={{ display: 'flex', gap: 56, flexWrap: 'wrap', marginTop: 22 }}>
          <Gauge
            title="Job profit ratio"
            hint="Every $1 of cost brings in this much revenue — higher is better"
            cfg={PROFIT_GAUGE}
            value={SAMPLE.profit.value}
            valueLabel={`${SAMPLE.profit.value.toFixed(2)}×`}
            bandNote={profitBand === 'yellow' ? `${profitGap.toFixed(2)} from green` : ''}
            ticks={[
              { atValue: 1.5, label: '1.5×' },
              { atValue: 1.2, label: '1.2×' },
              { atValue: 1.0, label: '1.0×' },
              { atValue: 0.5, label: '0.5×' },
            ]}
            signals={SAMPLE.profit.signals}
            weeks={SAMPLE.profit.weeks}
          />
          <Gauge
            title="Office cost per field dollar"
            hint="Support cost riding on each field dollar — lower is better"
            cfg={OFFICE_GAUGE}
            value={SAMPLE.office.value}
            valueLabel={`${SAMPLE.office.value}%`}
            bandNote={officeBand === 'yellow' ? 'field ↑ = greener' : ''}
            ticks={[
              { atValue: 50, label: '50%+' },
              { atValue: 40, label: '40%' },
              { atValue: 25, label: '25%' },
              { atValue: 0, label: '0%' },
            ]}
            signals={SAMPLE.office.signals}
            weeks={SAMPLE.office.weeks}
          />
        </div>

        <div
          role="status"
          style={{
            marginTop: 24,
            borderRadius: 8,
            padding: '0.9rem 1.1rem',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            fontSize: '0.9rem',
            background: bonusOpen ? 'var(--bg-green-tint)' : 'var(--bg-amber-tint)',
            border: `1px solid ${bonusOpen ? 'var(--bg-green-200)' : 'var(--bg-amber-200)'}`,
            color: bonusOpen ? 'var(--text-green-600)' : 'var(--text-amber-800)',
          }}
        >
          <span
            aria-hidden
            style={{ width: 14, height: 14, borderRadius: 9999, flexShrink: 0, background: bonusOpen ? BAND_FILL.green : BAND_FILL.yellow }}
          />
          <div>
            <b>Bonus window: {greenCount} of 2 in green.</b>{' '}
            <span style={{ color: 'var(--text-700)' }}>
              Both gauges green for the review period opens the bonus pool.
              {!bonusOpen && ' Closest lever right now: bill the three 90+ jobs — that alone moves the profit needle into green.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
