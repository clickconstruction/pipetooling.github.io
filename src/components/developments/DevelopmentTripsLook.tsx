/**
 * The Trips look on the Development page (punch list #379, PR 3). It shows only on a site that has a trip
 * or that is far from the shop. The band answers the owner's question first: of all the hours on this
 * site, how many were at the site. Under it one bar of the same hours, the year's trips on a strip, and a
 * row a trip that opens in place: what was typed on the left, what is counted from the clock on the right.
 *
 * Everything drawn comes from one model (`lib/trips/tripsLook.ts`), so the band, the strip, a row and an
 * open trip are counted from the same days. A trip is a reading over the clock: nothing here changes a
 * clock row, a bill or a cost.
 */
import { useMemo, useState } from 'react'
import type { OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { TRIP_DAY_LABEL, TRIP_STANDING_LABEL, type TripDayKind } from '../../lib/trips/tripDays'
import { TRIP_HOUR_BUCKET_LABEL, type TripHourBucket } from '../../lib/trips/tripHours'
import { TRIP_BILLING_WORDS, type TripRecord } from '../../lib/trips/tripRecord'
import { atSitePercentWords, buildTripStrip, daysWords, filterTripRows, hoursWords, monthDay, tripStripStartYear, TRIPS_FILTERS, type TripLookRow, type TripsFilter, type TripsLookModel } from '../../lib/trips/tripsLook'
import { EmptyState } from '../EmptyState'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { TripDayDots, TripHoursBar, TripLegend, TripPaintDays, TRIP_KIND_COLOR, BucketDot, bucketBackground } from '../trips/TripDayBits'
import { capStyle, LinkButton, SmallButton } from './developmentPageBits'

/** Why the hours are not on the screen yet, when they are not. */
export type TripsHoursState = 'reading' | 'read' | 'closed' | 'failed'

export const TRIPS_HOURS_WORDS: Readonly<Record<Exclude<TripsHoursState, 'read'>, string>> = {
  reading: 'Reading the clock…',
  closed: 'The clock’s days are closed to you, so the hours are not laid over the trips.',
  failed: 'The clock would not read, so the hours are not laid over the trips. Reload to try again.',
}

export const TRIPS_NO_POINT_WORDS = 'This site’s address has no point on the map yet. No punch can be checked against it, so no hour reads At the site.'

const tile = { border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', background: 'var(--bg-subtle)', minWidth: 0 } as const
const tileValue = { font: 'inherit', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 } as const
const tileSub = { fontSize: '0.74rem', color: 'var(--text-muted)' } as const

function billingChipStyle(row: TripLookRow) {
  const amber = row.billing === 'extra'
  return { display: 'inline-flex', alignItems: 'center', border: `1px solid ${amber ? 'var(--text-amber-800)' : 'var(--border)'}`, borderRadius: 999, padding: '1px 9px', fontSize: '0.74rem', background: amber ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)', color: amber ? 'var(--text-amber-800)' : 'var(--text-700)', whiteSpace: 'nowrap' } as const
}

export function DevelopmentTripsLook({
  model,
  hoursState,
  noSitePoint,
  failure,
  onReload,
  todayYmd,
  phone,
  jobLabel,
  canWrite,
  onAdd,
  onChange,
  onDelete,
}: {
  model: TripsLookModel
  hoursState: TripsHoursState
  /** The site's address has no point, so no punch can be read against it. */
  noSitePoint: boolean
  failure: OfflineRecoveryLastError | null
  onReload: () => void
  todayYmd: string
  phone: boolean
  /** A job's label and name by its id; null for a job no longer on the site. */
  jobLabel: (jobId: string) => string | null
  canWrite: boolean
  onAdd: () => void
  onChange: (record: TripRecord) => void
  onDelete: (record: TripRecord) => void
}) {
  const [filter, setFilter] = useState<TripsFilter>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [yearPick, setYearPick] = useState<number | null>(null)
  const startYear = useMemo(() => tripStripStartYear(model.rows, todayYmd), [model.rows, todayYmd])
  const year = yearPick ?? startYear
  const strip = useMemo(() => buildTripStrip(model.rows, year, todayYmd), [model.rows, year, todayYmd])
  const rows = useMemo(() => filterTripRows(model.rows, filter), [model.rows, filter])
  const h = model.band.hours
  const wait = hoursState === 'read' ? null : TRIPS_HOURS_WORDS[hoursState]
  const num = (n: number | undefined) => (n == null ? (hoursState === 'reading' ? '…' : '—') : hoursWords(n))
  const yearAt = strip.years.indexOf(year)

  if (failure) return <OfflineRetryPanel failure={failure} onRetry={onReload} surface="development-trips" idempotent />

  return (
    <div data-testid="trips-look">
      {/* The band: the owner's question first. */}
      <div style={{ display: 'grid', gridTemplateColumns: phone ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }} data-testid="trips-band">
        <div style={tile}>
          <div style={capStyle}>Trips</div>
          <div style={tileValue} data-testid="trips-band-trips">{model.band.gone}</div>
          <div style={tileSub}>{model.band.planned ? `and ${model.band.planned} planned` : 'gone out'}</div>
        </div>
        <div style={tile}>
          <div style={capStyle}>Days at the site</div>
          <div style={tileValue} data-testid="trips-band-days">{model.band.siteDays}</div>
          <div style={tileSub}>over {model.band.gone === 1 ? 'one trip' : `${model.band.gone} trips`}</div>
        </div>
        <div style={tile}>
          <div style={capStyle}>Hours on this site</div>
          <div style={tileValue} data-testid="trips-band-hours">{num(h?.all)}</div>
          <div style={tileSub}>every job, every person</div>
        </div>
        <div style={tile}>
          <div style={capStyle}>At the site</div>
          <div style={tileValue} data-testid="trips-band-site">{h ? `${hoursWords(h.site)} h` : num(undefined)}</div>
          <div style={tileSub}>{h ? (atSitePercentWords(h) ? `${atSitePercentWords(h)} of the hours` : 'no hours yet') : 'of the hours'}</div>
        </div>
        <div style={{ ...tile, gridColumn: phone ? '1 / -1' : undefined }}>
          <div style={capStyle}>Not at the site</div>
          <div style={tileValue} data-testid="trips-band-away">{h ? `${hoursWords(h.notAtSite)} h` : num(undefined)}</div>
          <div style={tileSub}>{h ? `road ${hoursWords(h.road)} · ready ${hoursWords(h.ready)} · home ${hoursWords(h.home)} · no place ${hoursWords(h.noPlace)}` : 'road · ready · home · no place'}</div>
        </div>
      </div>
      {h ? (
        <div style={{ marginTop: 12 }}>
          <TripHoursBar
            label={`Of ${hoursWords(h.all)} hours on this site, ${hoursWords(h.site)} were at the site`}
            parts={[
              { bucket: 'site', hours: h.site },
              { bucket: 'road', hours: h.road },
              { bucket: 'ready', hours: h.ready },
              { bucket: 'noPlace', hours: h.noPlace },
              { bucket: 'home', hours: h.home },
            ]}
          />
          <TripLegend home />
        </div>
      ) : wait ? (
        <p style={{ margin: '10px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }} data-testid="trips-hours-wait">
          {wait}
        </p>
      ) : null}
      {noSitePoint && hoursState === 'read' ? (
        <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: 'var(--text-amber-800)' }} data-testid="trips-no-point">
          {TRIPS_NO_POINT_WORDS}
        </p>
      ) : null}

      {/* The year's trips against time. */}
      {model.rows.length > 0 ? (
        <div style={{ position: 'relative', marginTop: 14, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-subtle)', padding: '22px 10px 10px' }} data-testid="trips-strip">
          <div style={{ position: 'absolute', left: 10, right: 10, top: 4, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', fontSize: '0.68rem', color: 'var(--text-muted)' }} aria-hidden>
            {strip.months.map((m) => (
              <span key={m} style={{ borderLeft: '1px solid var(--border)', paddingLeft: 4, overflow: 'hidden' }}>
                {phone ? m.slice(0, 1) : m}
              </span>
            ))}
          </div>
          <div style={{ position: 'relative', height: 40 }}>
            {strip.bars.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setOpenId(b.id)}
                title={`${b.label}: open this trip`}
                aria-label={`The trip of ${b.label}${b.planned ? ', planned' : ''}. Open it.`}
                data-testid="trips-strip-bar"
                style={{ position: 'absolute', top: 4, left: `${b.leftPct}%`, width: `max(8px, ${b.widthPct}%)`, height: 18, display: 'flex', borderRadius: 5, overflow: 'hidden', border: 'none', padding: 0, cursor: 'pointer', opacity: b.planned ? 0.55 : 1, outline: b.planned ? '1px dashed var(--text-700)' : '1px solid var(--surface)', background: 'var(--bg-muted)' }}
              >
                {b.kinds.map((k, i) => (
                  <i key={i} style={{ display: 'block', height: '100%', flex: '1 1 0', background: k ? TRIP_KIND_COLOR[k] : 'var(--bg-muted)' }} />
                ))}
              </button>
            ))}
            {phone
              ? null
              : strip.bars.map((b) => (
                  <span key={b.id} aria-hidden style={{ position: 'absolute', top: 24, left: `${b.leftPct}%`, fontSize: '0.66rem', color: 'var(--text-700)', whiteSpace: 'nowrap', transform: 'translateX(-2px)' }}>
                    {b.label}
                  </span>
                ))}
            {strip.todayPct != null ? (
              <span aria-hidden style={{ position: 'absolute', top: -4, bottom: 0, left: `${strip.todayPct}%`, width: 0, borderLeft: '2px solid var(--text-red-700)' }}>
                {/* On a phone the months are one letter wide and the word would sit on them: the line alone says today. */}
                {phone ? null : <span style={{ position: 'absolute', top: -13, left: -16, fontSize: '0.64rem', fontWeight: 700, color: 'var(--text-red-700)' }}>today</span>}
              </span>
            ) : null}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 2, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            <span data-testid="trips-strip-year">{strip.year}</span>
            {strip.years.length > 1 ? (
              <span style={{ display: 'inline-flex', gap: 10 }}>
                {yearAt > 0 ? <LinkButton onClick={() => setYearPick(strip.years[yearAt - 1] ?? year)}>‹ {strip.years[yearAt - 1]}</LinkButton> : null}
                {yearAt >= 0 && yearAt < strip.years.length - 1 ? <LinkButton onClick={() => setYearPick(strip.years[yearAt + 1] ?? year)}>{strip.years[yearAt + 1]} ›</LinkButton> : null}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* The rows. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
        <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }} role="radiogroup" aria-label="Which trips">
          {model.rows.length > 0
            ? TRIPS_FILTERS.map((f) => (
                <button key={f.key} type="button" role="radio" aria-checked={filter === f.key} className="developmentHistoryChip" data-on={filter === f.key ? '1' : undefined} onClick={() => setFilter(f.key)} data-testid={`trips-filter-${f.key}`}>
                  {f.label} {model.counts[f.key]}
                </button>
              ))
            : null}
        </span>
        {canWrite ? (
          <SmallButton onClick={onAdd} primary title="Add a trip to this site: who went, which days, what for">
            + Trip
          </SmallButton>
        ) : null}
      </div>

      {model.rows.length === 0 ? (
        <EmptyState {...(canWrite ? emptyWordsWithPress(emptyWords({ kind: 'make', noun: 'trips', control: '+ Trip' }), { onPress: onAdd }) : { main: emptyWords({ kind: 'make', noun: 'trips', control: '+ Trip' }).main, tail: 'The office or a leader adds the first.' })} compact />
      ) : rows.length === 0 ? (
        <EmptyState {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'trips', query: '' }), { onPress: () => setFilter('all') })} compact />
      ) : (
        <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }} data-testid="trips-rows">
          {phone ? null : (
            <div style={{ ...rowGrid(false), background: 'var(--bg-muted)', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '6px 12px' }} aria-hidden>
              <div>Days</div>
              <div>What for · who went</div>
              <div>Each day</div>
              <div>Hours</div>
              <div>Billing</div>
            </div>
          )}
          {rows.map((row, i) => {
            const open = openId === row.id
            return (
              <div key={row.id} style={{ borderTop: i === 0 && phone ? 'none' : '1px solid var(--border)', background: 'var(--surface)' }} data-testid="trip-row" data-standing={row.standing}>
                <button type="button" onClick={() => setOpenId(open ? null : row.id)} aria-expanded={open} title={open ? 'Close this trip' : 'Open this trip'} data-testid="trip-row-press" style={{ ...rowGrid(phone), width: '100%', textAlign: 'left', border: 'none', background: 'none', font: 'inherit', color: 'inherit', cursor: 'pointer', padding: '9px 12px' }}>
                  <div>
                    <strong style={{ display: 'block', color: 'var(--text-strong)' }}>{row.when}</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{row.standingWords}</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ color: 'var(--text-strong)' }}>{row.why}</strong>
                    <br />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{row.who}</span>
                  </div>
                  <div>
                    <TripDayDots days={row.days} label={dayDotsWords(row)} />
                  </div>
                  <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.84rem' }} data-testid="trip-row-hours">
                    {row.standing === 'planned' ? (
                      <span style={{ color: 'var(--text-muted)' }}>not yet</span>
                    ) : row.hours ? (
                      <>
                        {hoursWords(row.hours.all)} h · <strong>{hoursWords(row.hours.site)}</strong> at the site
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>{hoursState === 'reading' ? '…' : '—'}</span>
                    )}
                  </div>
                  <div>{row.billingLabel ? <span style={billingChipStyle(row)}>{row.billingLabel}</span> : null}</div>
                </button>
                {open ? <OpenTrip row={row} phone={phone} jobLabel={jobLabel} canWrite={canWrite} hoursState={hoursState} onChange={() => onChange(row.record)} onDelete={() => onDelete(row.record)} /> : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function rowGrid(phone: boolean) {
  return phone ? ({ display: 'grid', gridTemplateColumns: '1fr', gap: 4 } as const) : ({ display: 'grid', gridTemplateColumns: '170px minmax(0, 1.4fr) 176px 176px 140px', gap: 10, alignItems: 'center' } as const)
}

/** The day dots said in words: *8 days at the site, 2 on the road, 1 getting ready*. */
function dayDotsWords(row: TripLookRow): string {
  const c = row.dayCounts
  return [c.site ? `${daysWords(c.site)} at the site` : null, c.road ? `${c.road} on the road` : null, c.ready ? `${c.ready} getting ready` : null].filter(Boolean).join(', ') || 'no day yet'
}

const KIND_ROWS: ReadonlyArray<{ bucket: Exclude<TripHourBucket, 'home' | 'noPlace'>; kind: TripDayKind }> = [
  { bucket: 'site', kind: 'site' },
  { bucket: 'road', kind: 'road' },
  { bucket: 'ready', kind: 'ready' },
]

/** One trip, open in place: what was typed on the left, what is counted from the clock on the right. */
function OpenTrip({ row, phone, jobLabel, canWrite, hoursState, onChange, onDelete }: { row: TripLookRow; phone: boolean; jobLabel: (jobId: string) => string | null; canWrite: boolean; hoursState: TripsHoursState; onChange: () => void; onDelete: () => void }) {
  const r = row.record
  const h = row.hours
  const cell = { padding: '5px 8px', borderTop: '1px solid var(--border)', verticalAlign: 'top' } as const
  const right = { ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' } as const
  const label = { color: 'var(--text-muted)' } as const
  return (
    <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', padding: '12px 14px' }} data-testid="trip-open">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={capStyle}>{TRIP_STANDING_LABEL[row.standing]}</div>
          <div style={{ fontSize: '1.02rem', fontWeight: 700, color: 'var(--text-strong)' }}>
            {row.when} · {row.why}
          </div>
        </div>
        {canWrite ? (
          <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <SmallButton onClick={onChange} title="Change who went, the days, what for and the rest">
              Change
            </SmallButton>
            <button type="button" onClick={onDelete} title="Delete this trip. No clock row, bill or cost changes." data-testid="trip-delete" style={{ border: 'none', background: 'none', padding: '0 4px', font: 'inherit', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-red-700)', cursor: 'pointer' }}>
              Delete this trip
            </button>
          </span>
        ) : null}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : 'minmax(0, 1.25fr) minmax(0, 1fr)', gap: 16, alignItems: 'start', marginTop: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={capStyle}>The days{canWrite ? ' · tap a day to change it' : ''}</div>
          <div style={{ marginTop: 6 }}>
            <TripPaintDays days={row.days} dayWords={monthDay} onTap={canWrite ? () => onChange() : undefined} testId="trip-open-days" />
          </div>
          <TripLegend home={false} />
          <div style={{ ...capStyle, marginTop: 14 }}>Who went</div>
          {row.people.map((p, i) => (
            <div key={`${p.personKey}:${i}`} style={{ display: 'grid', gridTemplateColumns: phone ? 'minmax(0, 1fr) auto' : '110px minmax(0, 1fr) 70px', gap: 8, alignItems: 'center', padding: '5px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }} data-testid="trip-open-person">
              <strong style={{ color: 'var(--text-strong)', gridColumn: phone ? '1 / -1' : undefined }}>{p.name}</strong>
              <span style={{ minWidth: 0 }}>
                <TripDayDots days={p.days} label={`${p.name}: ${p.days.filter((d) => d.kind).length} days on the trip`} />
                {p.hours && p.hours.noPlace > 0 ? (
                  <span style={{ marginLeft: 6, border: '1px dashed var(--border-strong)', borderRadius: 999, padding: '0 8px', fontSize: '0.72rem', color: 'var(--text-700)', whiteSpace: 'nowrap' }} title="These hours come from rows that carry no place, such as an imported or scheduled row. They say the day was paid. They do not say where.">
                    {hoursWords(p.hours.noPlace)} h no place on the punch
                  </span>
                ) : null}
              </span>
              <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.hours ? `${hoursWords(p.hours.all)} h` : hoursState === 'reading' ? '…' : '—'}</span>
            </div>
          ))}
          <dl style={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr)', gap: '6px 10px', margin: '10px 0 0', fontSize: '0.84rem' }}>
            <dt style={label}>Asked by</dt>
            <dd style={{ margin: 0 }} data-testid="trip-open-asked">
              {r.askedBy === 'us' ? 'Us' : r.askedBy === 'them' ? (
                <>
                  <strong>Them</strong>
                  {[r.askedWho.trim(), r.askedHow.trim()].filter(Boolean).length ? `: ${[r.askedWho.trim(), r.askedHow.trim()].filter(Boolean).join(', ')}` : ''}
                </>
              ) : (
                <span style={label}>nobody has said</span>
              )}
            </dd>
            <dt style={label}>How it went</dt>
            <dd style={{ margin: 0 }}>{r.outcome.trim() || <span style={label}>{row.standing === 'back' ? 'nobody has said' : 'not back yet'}</span>}</dd>
            <dt style={label}>Work goes on</dt>
            <dd style={{ margin: 0, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {r.jobIds.length ? (
                r.jobIds.map((id) => {
                  const on = h?.byJob.get(id)
                  return (
                    <span key={id} style={{ border: '1px solid var(--border)', borderRadius: 999, padding: '1px 9px', fontSize: '0.74rem', background: 'var(--surface)', color: 'var(--text-700)' }}>
                      {jobLabel(id) ?? 'A job no longer on this site'}
                      {on ? ` · ${hoursWords(on)} h` : ''}
                    </span>
                  )
                })
              ) : (
                <span style={label}>no job named</span>
              )}
            </dd>
            <dt style={label}>Billing</dt>
            <dd style={{ margin: 0 }}>
              {row.billing && row.billingLabel ? (
                <>
                  <span style={billingChipStyle(row)}>{row.billingLabel}</span> <span style={label}>{TRIP_BILLING_WORDS[row.billing]}</span>
                </>
              ) : (
                <span style={label}>nobody has said</span>
              )}
            </dd>
          </dl>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={capStyle}>Counted from the trip’s days</div>
          {h ? (
            <>
              <div style={{ marginTop: 8 }}>
                <TripHoursBar
                  label={`${hoursWords(h.all)} hours on the trip, ${hoursWords(h.site)} at the site`}
                  parts={[
                    { bucket: 'site', hours: h.site },
                    { bucket: 'road', hours: h.road },
                    { bucket: 'ready', hours: h.ready },
                    { bucket: 'noPlace', hours: h.noPlace },
                  ]}
                />
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginTop: 6 }} data-testid="trip-open-counted">
                <tbody>
                  {KIND_ROWS.map(({ bucket, kind }, i) => (
                    <tr key={bucket}>
                      <td style={{ ...cell, borderTop: i === 0 ? 'none' : cell.borderTop }}>
                        <BucketDot bucket={bucket} />
                        {TRIP_DAY_LABEL[kind]}
                      </td>
                      <td style={{ ...right, borderTop: i === 0 ? 'none' : right.borderTop, fontWeight: kind === 'site' ? 700 : 400 }}>{hoursWords(h[bucket])} h</td>
                      <td style={{ ...right, borderTop: i === 0 ? 'none' : right.borderTop }}>{daysWords(row.dayCounts[kind])}</td>
                    </tr>
                  ))}
                  {h.noPlace > 0 ? (
                    <tr>
                      <td style={cell}>
                        <span aria-hidden style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: bucketBackground('noPlace'), border: '1px solid var(--text-faint)', verticalAlign: -1, marginRight: 4, boxSizing: 'border-box' }} />
                        {TRIP_HOUR_BUCKET_LABEL.noPlace}
                      </td>
                      <td style={right}>{hoursWords(h.noPlace)} h</td>
                      <td style={right} />
                    </tr>
                  ) : null}
                  <tr>
                    <td style={{ ...cell, fontWeight: 700 }}>The trip</td>
                    <td style={{ ...right, fontWeight: 700 }}>{hoursWords(h.all)} h</td>
                    <td style={right}>{daysWords(row.dayCounts.days)}</td>
                  </tr>
                </tbody>
              </table>
              {row.standing !== 'planned' && row.dayCounts.site > 0 && h.site === 0 ? (
                <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: 'var(--text-amber-800)' }} data-testid="trip-open-no-punch">
                  No punch at the site on this trip’s days. The days stand as painted.
                </p>
              ) : null}
            </>
          ) : (
            <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{hoursState === 'read' ? '—' : TRIPS_HOURS_WORDS[hoursState]}</p>
          )}
        </div>
      </div>
    </div>
  )
}
