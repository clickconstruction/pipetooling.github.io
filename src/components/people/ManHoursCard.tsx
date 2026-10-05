import { useEffect, useMemo, useState } from 'react'
import { formatErrorMessage } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { useMeasuredWidth } from '../../hooks/useMeasuredWidth'
import { loadManHoursSessions } from '../../lib/manHours/loadManHoursSessions'
import {
  MAN_HOURS_ZOOMS,
  buildManHoursEntries,
  buildManHoursPeriods,
  formatManHours as hrs,
  manHoursDayLabel,
  manHoursPeriodLabel,
  type ManHoursPeriod,
  type ManHoursSession,
  type ManHoursZoom,
} from '../../lib/manHours/manHoursByPeriod'
import { manHoursHeadlineWords, pickManHoursHeadline } from '../../lib/manHours/manHoursChart'
import { buildManHoursNames, buildManHoursWho } from '../../lib/manHours/manHoursWho'
import { ManHoursChart } from './ManHoursChart'
import { ManHoursWho } from './ManHoursWho'

/**
 * People → Overhead "Man hours" card: the office against the field by pay
 * week, month, quarter and year. Self-loading (one paged read of the clock
 * sessions on mount); the tab passes only the Office job it already holds, so
 * a change of Office job re-folds without a refetch. Hours only: no wage and
 * no dollar is read or shown. The fold is `lib/manHours/manHoursByPeriod.ts`,
 * the same rules as the day table at the bottom of the tab.
 *
 * One period is always picked (the newest finished one until a row or a bar
 * is clicked); `ManHoursWho` lists who made it up and holds the doors out.
 *
 * The card lays itself out by its own width (v2.4516): at `WIDE_FROM` and up
 * the who list stands beside the picture, so a click on a bar changes a list
 * in view; under that it follows the table. Under `COMPACT_UNDER` (a phone) a
 * row's chips drop under its name so the pinned name column stays narrow.
 */

/** Card widths, in pixels, where the layout changes. */
const WIDE_FROM = 980
const COMPACT_UNDER = 560
const pct = (share: number | null): string => (share == null ? '—' : `${Math.round(share * 100)}%`)

const thStyle = {
  textAlign: 'right' as const,
  padding: '0.3rem 0.6rem',
  fontSize: '0.7rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  color: 'var(--text-muted)',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap' as const,
}

const tdStyle = {
  padding: '0.4rem 0.6rem',
  textAlign: 'right' as const,
  whiteSpace: 'nowrap' as const,
  fontVariantNumeric: 'tabular-nums' as const,
  borderBottom: '1px solid var(--border)',
  color: 'var(--text-strong)',
}

const chipStyle = {
  display: 'inline-block',
  marginLeft: '0.4rem',
  padding: '0 0.4rem',
  borderRadius: 999,
  fontSize: '0.7rem',
  fontWeight: 500,
  background: 'var(--bg-muted)',
  color: 'var(--text-600)',
}

const waitingChipStyle = {
  ...chipStyle,
  background: 'var(--bg-amber-tint)',
  color: 'var(--text-amber-800)',
  border: '1px solid var(--border-amber)',
}

function PeriodRow({
  period,
  zoom,
  firstDay,
  selected,
  compact,
  onSelect,
}: {
  period: ManHoursPeriod
  zoom: ManHoursZoom
  firstDay: string | null
  selected: boolean
  compact: boolean
  onSelect: () => void
}) {
  const ground = selected ? 'var(--bg-blue-tint)' : 'var(--bg-page)'
  const chips = (
    <>
      {period.fromFirstDay && firstDay ? <span style={chipStyle}>from {manHoursDayLabel(firstDay)}</span> : null}
      {period.soFar ? <span style={chipStyle}>so far</span> : null}
      {period.pendingHours >= 0.5 ? (
        <span style={waitingChipStyle} title="Recorded and not yet approved. Already counted in this row.">
          {hrs(period.pendingHours)} h waiting
        </span>
      ) : null}
    </>
  )
  return (
    <tr
      tabIndex={0}
      aria-selected={selected}
      title="See who made up this period"
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        onSelect()
      }}
      style={{ cursor: 'pointer', background: ground }}
    >
      {/* The name column is pinned: it stays while the numbers scroll sideways on a narrow card. */}
      <td style={{ ...tdStyle, textAlign: 'left', position: 'sticky', left: 0, zIndex: 1, background: ground, boxShadow: selected ? 'inset 3px 0 0 var(--text-link)' : undefined }}>
        {manHoursPeriodLabel(period, zoom)}
        {compact ? <div style={{ marginLeft: '-0.4rem', marginTop: '0.1rem' }}>{chips}</div> : chips}
      </td>
      <td style={tdStyle}>{hrs(period.fieldHours)}</td>
      <td style={tdStyle}>{hrs(period.officeHours)}</td>
      <td style={tdStyle}>{hrs(period.bidHours)}</td>
      <td style={tdStyle}>{hrs(period.unassignedHours)}</td>
      <td style={{ ...tdStyle, fontWeight: 700 }}>{hrs(period.totalHours)}</td>
      <td style={{ ...tdStyle, fontWeight: 700 }}>{pct(period.officeShare)}</td>
      {zoom !== 'week' ? <td style={tdStyle}>{period.hoursPerWeek == null ? '—' : hrs(period.hoursPerWeek)}</td> : null}
      <td style={tdStyle}>{period.people > 0 ? period.people : '—'}</td>
    </tr>
  )
}

export function ManHoursCard({
  officeJobLedgerId,
  officeJobLoading,
  onShowWeek,
}: {
  officeJobLedgerId: string | null
  officeJobLoading: boolean
  /** Moves the tab's day table to the week starting on this day. */
  onShowWeek?: (weekStartYmd: string) => void
}) {
  const [zoom, setZoom] = useState<ManHoursZoom>('month')
  /** The period the "who" list reads, as picked by a click; null = the newest finished one. Cleared when the zoom changes. */
  const [pickedKey, setPickedKey] = useState<string | null>(null)
  const [sessions, setSessions] = useState<ManHoursSession[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [cardRef, cardWidth] = useMeasuredWidth<HTMLDivElement>()
  const wide = cardWidth != null && cardWidth >= WIDE_FROM
  const compact = cardWidth != null && cardWidth < COMPACT_UNDER

  useEffect(() => {
    let cancelled = false
    setLoadError(null)
    void (async () => {
      try {
        const rows = await loadManHoursSessions()
        if (!cancelled) setSessions(rows)
      } catch (e) {
        if (!cancelled) setLoadError(formatErrorMessage(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reloadTick])

  const entries = useMemo(() => (sessions ? buildManHoursEntries(sessions, officeJobLedgerId) : null), [sessions, officeJobLedgerId])
  const view = useMemo(() => {
    if (!entries) return null
    const periods = MAN_HOURS_ZOOMS.find((z) => z.key === zoom)?.periods ?? null
    return buildManHoursPeriods({ entries, zoom, todayYmd: todayYmdInAppTz(), maxPeriods: periods })
  }, [entries, zoom])

  const headlinePick = useMemo(() => (view ? pickManHoursHeadline(view.periods) : null), [view])
  const headline = useMemo(() => (headlinePick ? manHoursHeadlineWords(headlinePick, zoom) : null), [headlinePick, zoom])

  const selected = useMemo(() => {
    if (!view) return null
    return view.periods.find((p) => p.key === pickedKey) ?? headlinePick?.period ?? null
  }, [view, pickedKey, headlinePick])
  const names = useMemo(() => (sessions ? buildManHoursNames(sessions) : null), [sessions])
  const who = useMemo(() => (entries && names && selected ? buildManHoursWho(entries, selected, names) : []), [entries, names, selected])

  const loading = !loadError && (sessions == null || officeJobLoading)

  return (
    <div ref={cardRef} style={{ marginBottom: '1rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-page)', padding: '0.6rem 0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <strong style={{ color: 'var(--text-strong)', fontSize: '0.9375rem' }}>Man hours</strong>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Office against field</span>
        <div role="group" aria-label="Period" style={{ marginLeft: 'auto', display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
          {MAN_HOURS_ZOOMS.map((z, i) => (
            <button
              key={z.key}
              type="button"
              aria-pressed={z.key === zoom}
              onClick={() => {
                setZoom(z.key)
                setPickedKey(null)
              }}
              style={{
                border: 0,
                borderRight: i < MAN_HOURS_ZOOMS.length - 1 ? '1px solid var(--border)' : 0,
                background: z.key === zoom ? 'var(--bg-blue-tint)' : 'transparent',
                color: z.key === zoom ? 'var(--text-blue-800)' : 'var(--text-muted)',
                fontWeight: z.key === zoom ? 700 : 500,
                // fontFamily, not the `font` shorthand (the v2.770 tab-pill bug).
                fontFamily: 'inherit',
                fontSize: '0.8125rem',
                padding: '0.25rem 0.6rem',
                cursor: 'pointer',
              }}
            >
              {z.label}
            </button>
          ))}
        </div>
      </div>

      {loadError ? (
        <div role="alert" style={{ fontSize: '0.8125rem', color: 'var(--text-red-700)', marginTop: '0.4rem' }}>
          Man hours did not load. {loadError}{' '}
          <button
            type="button"
            onClick={() => setReloadTick((t) => t + 1)}
            style={{ border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontSize: '0.8125rem', padding: '0.15rem 0.5rem', cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      ) : loading || !view ? (
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>Loading…</div>
      ) : view.periods.length === 0 ? (
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>No recorded clock sessions yet.</div>
      ) : (
        <>
          {headline ? (
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9375rem', color: 'var(--text-strong)' }}>
              <strong>{headline.lead}</strong> {headline.rest}
            </p>
          ) : null}
          {wide ? (
            <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 0', minWidth: 0 }}>
                <ManHoursChart periods={view.periods} zoom={zoom} selectedKey={selected?.key ?? null} onSelect={setPickedKey} />
              </div>
              <div style={{ flex: '0 0 27rem', minWidth: 0 }}>{selected ? <ManHoursWho period={selected} zoom={zoom} rows={who} onShowWeek={onShowWeek} layout="side" /> : null}</div>
            </div>
          ) : (
            <ManHoursChart periods={view.periods} zoom={zoom} selectedKey={selected?.key ?? null} onSelect={setPickedKey} />
          )}
          <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.8125rem' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left', position: 'sticky', left: 0, zIndex: 1, background: 'var(--bg-page)' }}>Period</th>
                  <th style={thStyle}>Field</th>
                  <th style={thStyle}>Office</th>
                  <th style={thStyle}>Bids</th>
                  <th style={thStyle}>Not on a job</th>
                  <th style={thStyle}>Total</th>
                  <th style={thStyle}>Office share</th>
                  {zoom !== 'week' ? <th style={thStyle}>Per week</th> : null}
                  <th style={thStyle}>People</th>
                </tr>
              </thead>
              <tbody>
                {view.periods.map((p) => (
                  <PeriodRow key={p.key} period={p} zoom={zoom} firstDay={view.firstDay} selected={p.key === selected?.key} compact={compact} onSelect={() => setPickedKey(p.key)} />
                ))}
              </tbody>
            </table>
          </div>
          {selected && !wide ? <ManHoursWho period={selected} zoom={zoom} rows={who} onShowWeek={onShowWeek} /> : null}
        </>
      )}
      <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
        Recorded hours: every closed clock session that was not rejected. Office is time on the Office job. Field is time on any other job. Office
        share is office plus bids, out of all time on a job or a bid. Weeks run Sunday to Saturday.
        {view?.firstDay ? ` Hours start ${manHoursDayLabel(view.firstDay)}, ${view.firstDay.slice(0, 4)}, the first day on the clock.` : ''}
        {!officeJobLoading && !officeJobLedgerId ? ' No Office job is set, so no time counts as office. Set it with Overhead office job below.' : ''}
      </p>
    </div>
  )
}
