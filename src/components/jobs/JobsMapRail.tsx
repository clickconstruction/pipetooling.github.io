import type { CSSProperties } from 'react'
import { JOBS_MAP_COLLECTIONS_RING_COLOR, JOBS_MAP_SECTION_COLOR, type JobsMapPin } from '../../lib/jobs/jobsMap'
import { JOBS_MAP_CREW_RING_COLOR } from '../../lib/jobs/jobsMapCrewDay'
import { bucketAskLine, type DistanceBucketKey, type DistanceBucketVisibility, type JobsMapAskTone, type JobsMapRailModel } from '../../lib/jobs/jobsMapRail'

type Props = {
  rail: JobsMapRailModel
  bucketsOn: DistanceBucketVisibility
  onToggleBucket: (key: DistanceBucketKey) => void
  /** An ask row was tapped — select its pin and light the board row. */
  onPickPin: (pin: JobsMapPin) => void
  /** "Paid 723 off" when the Paid chip is off and there are paid pins. */
  paidOff: number
  /** The crew layer's line (v2.3399) — `Crews today: 5 people on 4 jobs`; null while the layer is off. */
  crewLine: string | null
  /** The "N jobs have no map location yet" line, or the placing line while the geocoder runs. */
  unmappedLine: string | null
  unmappedCount: number
  /** Unplaced jobs (≤ 3 are listed by number as row links). */
  unmappedRows: readonly { id: string; numberLabel: string }[]
  onFocusJob: (jobId: string, numberLabel: string) => void
  resolving: boolean
  isMobile: boolean
}

const H4: CSSProperties = { margin: 0, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)', fontWeight: 700 }
const LINK: CSSProperties = { background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-blue-500)', cursor: 'pointer', textAlign: 'left' }

const TONE_COLOR: Record<JobsMapAskTone, string> = {
  collections: 'var(--text-red-700)',
  late: 'var(--text-amber-800)',
  billed: 'var(--text-muted)',
  ready: 'var(--text-muted)',
}

/**
 * The rail beside the Pipeline map (v2.3397): distance buckets that toggle
 * pins, the ask-for-money list longest waiting first, the pinned total and the
 * dollars still to collect, and the unplaced-jobs line.
 */
export function JobsMapRail({ rail, bucketsOn, onToggleBucket, onPickPin, paidOff, crewLine, unmappedLine, unmappedCount, unmappedRows, onFocusJob, resolving, isMobile }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', minWidth: 0 }}>
      <h4 style={H4}>By distance from the office · pinned jobs</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
        {rail.buckets.map((b) => {
          const on = bucketsOn[b.key]
          const askLine = bucketAskLine(b)
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => onToggleBucket(b.key)}
              aria-pressed={on}
              title={on ? `Hide the ${b.label} pins` : `Show the ${b.label} pins`}
              style={{
                textAlign: 'left',
                border: `1px solid ${on ? 'var(--text-blue-500)' : 'var(--border)'}`,
                boxShadow: on ? 'inset 0 0 0 1px var(--text-blue-500)' : undefined,
                borderRadius: 6,
                padding: '0.35rem 0.5rem',
                background: 'var(--surface)',
                color: on ? 'inherit' : 'var(--text-faint)',
                cursor: 'pointer',
                font: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                minWidth: 0,
                minHeight: isMobile ? 44 : undefined,
              }}
            >
              <span style={{ fontSize: '0.7rem', color: on ? 'var(--text-muted)' : 'var(--text-faint)', fontWeight: 600, whiteSpace: 'nowrap' }}>{b.label}</span>
              <span style={{ fontSize: '1.05rem', fontWeight: 700, color: on ? 'var(--text-strong)' : 'var(--text-faint)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>{b.count}</span>
              <span style={{ fontSize: '0.72rem', color: on ? 'var(--text-muted)' : 'var(--text-faint)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title="Open bills minus payments applied, on the jobs pinned here">
                {b.toCollectLabel} to collect
                {askLine && !isMobile ? ` · ${askLine}` : ''}
              </span>
            </button>
          )
        })}
      </div>

      {crewLine ? (
        <div data-testid="jobs-map-crew-line" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-strong)', fontWeight: 600 }}>
          <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, border: `2px solid ${JOBS_MAP_CREW_RING_COLOR}`, display: 'inline-block', boxSizing: 'border-box' }} />
          {crewLine}
        </div>
      ) : null}

      {rail.ask.length > 0 ? (
        <>
          <h4 style={H4}>Ask for money · longest waiting first</h4>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            {rail.ask.map((r) => (
              <li key={r.pin.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => onPickPin(r.pin)}
                  title={`${r.pin.label} — show it on the map and light its row`}
                  style={{ ...LINK, color: 'inherit', display: 'grid', gridTemplateColumns: '10px minmax(0, 1fr) auto auto', gap: '0.5rem', alignItems: 'center', width: '100%', padding: '0.3rem 0.55rem', fontSize: '0.78rem', minHeight: isMobile ? 40 : undefined }}
                >
                  <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: JOBS_MAP_SECTION_COLOR[r.pin.section], boxSizing: 'border-box', border: r.pin.inCollections ? `2px solid ${JOBS_MAP_COLLECTIONS_RING_COLOR}` : undefined }} />
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <b style={{ color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums', marginRight: '0.3rem' }}>{r.pin.numberLabel}</b>
                    {r.pin.jobName}
                  </span>
                  <span style={{ color: TONE_COLOR[r.tone], fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.label}</span>
                  <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.milesLabel}</span>
                </button>
              </li>
            ))}
            {rail.askMore > 0 ? <li style={{ padding: '0.25rem 0.55rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>+ {rail.askMore} more to ask for</li> : null}
          </ul>
        </>
      ) : null}

      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-muted)', paddingTop: '0.15rem' }}>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {rail.pinnedCount} pinned · {rail.toCollectLabel} to collect
          {paidOff > 0 ? ` · Paid ${paidOff} off` : ''}
        </span>
        {resolving && unmappedCount > 0 ? (
          <span>{unmappedCount === 1 ? 'Placing 1 more job…' : `Placing ${unmappedCount} more jobs…`}</span>
        ) : unmappedLine ? (
          <span>
            {unmappedLine}
            {unmappedRows.length <= 3
              ? unmappedRows.map((j) => (
                  <span key={j.id}>
                    {' · '}
                    <button type="button" onClick={() => onFocusJob(j.id, j.numberLabel)} style={{ ...LINK, fontSize: '0.78rem', textDecoration: 'underline', minHeight: isMobile ? 44 : undefined }} title="Show this job's row on the board">
                      {j.numberLabel}
                    </button>
                  </span>
                ))
              : null}
          </span>
        ) : null}
      </div>
    </div>
  )
}
