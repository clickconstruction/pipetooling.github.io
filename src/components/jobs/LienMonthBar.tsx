import type { CSSProperties } from 'react'
import { lienMonthSpanWords, lienMonthWords, lienMonthZoneLine, lienMonthZonePress, type LienMonth, type LienMonthZone, type LienMonthZoneKey } from '../../lib/jobs/lienMonthRhythm'

/**
 * The lien month across the top of the Lien desk's Do now (punch list #235, PR 2): five zones sized
 * by their days — Reminders, Notices, Liens, Catch-up, Nothing scheduled — each reading its count
 * left, its count done and what slipped, today marked across the bar, and one press per zone that
 * narrows the list under it to that zone's work. The month is `lienMonthRhythm.ts`'s; nothing here
 * reads, writes, sends or files. On a phone the zones stack as rows and the zone today is in says so.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** The desk's own tones: reminders violet, notices blue, affidavits red (the ladders' colours), catch-up amber, the quiet zone grey. */
const TONE: Record<LienMonthZoneKey, { fg: string; tint: string }> = {
  reminders: { fg: 'var(--text-violet-700)', tint: 'var(--bg-violet-tint)' },
  notices: { fg: 'var(--text-blue-700)', tint: 'var(--bg-blue-tint)' },
  liens: { fg: 'var(--text-red-700)', tint: 'var(--bg-red-tint)' },
  catch_up: { fg: 'var(--text-amber-800)', tint: 'var(--bg-amber-tint)' },
  quiet: { fg: 'var(--text-muted)', tint: 'transparent' },
}

const GREEN = 'var(--text-green-700)'
const RED = 'var(--text-red-700)'

const head: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }
const muted: CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted)' }

function monthWords(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month)
  return m ? `${MONTHS[Number(m[2]) - 1] ?? month} ${m[1]}` : month
}

function Zone({ zone, on, isMobile, isToday, onPick }: { zone: LienMonthZone; on: boolean; isMobile: boolean; isToday: boolean; onPick: (key: LienMonthZoneKey | null) => void }) {
  const tone = TONE[zone.key]
  const line = lienMonthZoneLine(zone)
  const press = lienMonthZonePress(zone)
  const quiet = zone.key === 'quiet'
  const nameColor = line.tone === 'done' ? GREEN : line.tone === 'slipped' ? RED : tone.fg
  const border = on ? tone.fg : line.tone === 'slipped' ? RED : zone.state === 'now' && !quiet ? tone.fg : 'var(--border)'
  const total = zone.left + zone.done
  const pct = zone.state === 'now' && total > 0 ? Math.round((zone.done / total) * 100) : null
  const style: CSSProperties = {
    position: 'relative',
    display: 'grid',
    alignContent: 'start',
    gap: 2,
    minWidth: 0,
    padding: isMobile ? '8px 10px' : '7px 9px',
    borderRadius: 8,
    border: `1px ${quiet ? 'dashed' : 'solid'} ${border}`,
    boxShadow: on ? `inset 0 0 0 1px ${tone.fg}` : 'none',
    background: zone.state === 'now' && !quiet ? tone.tint : 'var(--surface)',
    color: 'var(--text-strong)',
    opacity: zone.state === 'ahead' && !quiet ? 0.78 : 1,
    textAlign: 'left',
    font: 'inherit',
    cursor: press ? 'pointer' : 'default',
    overflow: 'hidden',
  }
  const body = (
    <>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: nameColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {line.tone === 'done' ? '✓ ' : ''}
          {zone.label}
        </span>
        <span style={{ ...muted, whiteSpace: 'nowrap', marginLeft: 'auto' }}>
          {isMobile && isToday ? 'today · ' : ''}
          {lienMonthSpanWords(zone.key, zone.span)}
        </span>
      </span>
      <span data-testid={`lien-month-zone-head-${zone.key}`} style={{ fontSize: '0.8rem', fontWeight: line.tone === 'quiet' || line.tone === 'ahead' ? 500 : 700, color: line.tone === 'slipped' ? RED : line.tone === 'done' ? GREEN : 'var(--text-strong)', fontVariantNumeric: 'tabular-nums', whiteSpace: isMobile ? 'normal' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {line.head}
      </span>
      {line.sub ? (
        <span style={{ ...muted, whiteSpace: isMobile ? 'normal' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} data-testid={`lien-month-zone-sub-${zone.key}`}>
          {line.sub}
        </span>
      ) : null}
      {press ? (
        <span style={{ fontSize: '0.74rem', fontWeight: 600, color: tone.fg, marginTop: 2, whiteSpace: 'nowrap' }} data-testid={`lien-month-zone-press-${zone.key}`}>
          {on ? 'Show all ›' : `${press} ›`}
        </span>
      ) : null}
      {pct != null ? <i aria-hidden style={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: `${pct}%`, background: GREEN }} /> : null}
    </>
  )
  if (!press) {
    return (
      <div data-testid={`lien-month-zone-${zone.key}`} data-state={zone.state} data-tone={line.tone} style={style}>
        {body}
      </div>
    )
  }
  return (
    <button type="button" data-testid={`lien-month-zone-${zone.key}`} data-state={zone.state} data-tone={line.tone} aria-pressed={on} onClick={() => onPick(on ? null : zone.key)} title={on ? 'Show every row again' : `${press}: only this zone’s rows on the list`} style={style}>
      {body}
    </button>
  )
}

export function LienMonthBar({
  month,
  on,
  onPick,
  isMobile,
  shown,
  total,
}: {
  month: LienMonth
  /** The zone the list is narrowed to, or null. */
  on: LienMonthZoneKey | null
  onPick: (key: LienMonthZoneKey | null) => void
  isMobile: boolean
  /** With a zone pressed: how many of the list's rows are that zone's, of how many. */
  shown?: number
  total?: number
}) {
  const onZone = on ? month.zones.find((z) => z.key === on) ?? null : null
  const columns = month.zones.map((z) => `${Math.max(1, z.days)}fr`).join(' ')
  return (
    <div data-testid="lien-month-bar" title={lienMonthWords(month)} style={{ display: 'grid', gap: 6, padding: isMobile ? '0.6rem 0.75rem 0.2rem' : '0.7rem 1.25rem 0.2rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={head}>The lien month</span>
        <span style={muted}>
          {monthWords(month.month)} · day {month.today}
        </span>
        {onZone ? (
          <span data-testid="lien-month-showing" style={{ ...muted, marginLeft: 'auto', display: 'inline-flex', gap: 8, alignItems: 'baseline' }}>
            {shown === 0 ? `Nothing on the list is ${onZone.label}’s work right now` : `Showing ${shown ?? 0} of ${total ?? 0} · ${onZone.label}, days ${lienMonthSpanWords(onZone.key, onZone.span)}`}
            <button type="button" data-testid="lien-month-show-all" onClick={() => onPick(null)} style={{ font: 'inherit', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-blue-700)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
              Show all
            </button>
          </span>
        ) : null}
      </div>
      <div style={{ position: 'relative', paddingTop: isMobile ? 0 : 12 }}>
        {!isMobile ? (
          <span data-testid="lien-month-today" aria-hidden style={{ position: 'absolute', top: 0, left: `${month.todayPct}%`, width: 2, height: 16, background: 'var(--text-strong)', borderRadius: 1, zIndex: 1 }}>
            <span style={{ position: 'absolute', top: -1, left: 5, fontSize: '0.62rem', lineHeight: '12px', fontWeight: 700, color: 'var(--text-strong)', whiteSpace: 'nowrap' }}>today</span>
          </span>
        ) : null}
        <div role="group" aria-label="The lien month’s five zones" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : columns, gap: isMobile ? 6 : 3 }}>
          {month.zones.map((z) => (
            <Zone key={z.key} zone={z} on={on === z.key} isMobile={isMobile} isToday={month.zone === z.key} onPick={onPick} />
          ))}
        </div>
      </div>
    </div>
  )
}
