/**
 * GC mode design spike: the superintendent's morning list (G-118; the kernel is `gcMorningList.ts`,
 * the mock-up `to-dos/gc-mode/mockups/G-118.md`). On the Daily log tab above the log, for the tab's
 * own day: who should be on site and what each is doing, with the company's phone to call; the
 * day's inspections and what arrives; and, once the day's log is written, the ones it does not
 * have, first. The day steps move the tab's day, so a day's list sits over that day's log.
 */
import { useMemo } from 'react'
import { telHref, weekdayDate, type GcProject, type GcState } from '../../lib/gcMode/gcModel'
import { chartHolds } from '../../lib/gcMode/gcChartHolds'
import { morningList, morningSteps, type MorningCompany } from '../../lib/gcMode/gcMorningList'
import { Btn, Card, Chip } from './gcUi'
import { PartnerLink } from './GcCompanyFile'

/** The line's colour when a trade's own count sets it (G-142). */
const CREW_TONE = { red: 'var(--text-red-700)', amber: 'var(--text-amber-800)', green: 'var(--text-green-800)', grey: 'var(--text-muted)' } as const

const head = { fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '0.4rem' } as const

function CompanyName({ c }: { c: MorningCompany }) {
  return (
    <span style={{ minWidth: 0 }}>
      {c.partnerId ? <PartnerLink partnerId={c.partnerId} company={c.company} strong /> : <strong>{c.company}</strong>}
      <span style={{ color: 'var(--text-muted)' }}> · {c.pkg.trade}</span>
    </span>
  )
}

export function GcMorningList({ state, project, day, onDay }: { state: GcState; project: GcProject; day: string; onDay: (day: string) => void }) {
  const holds = useMemo(() => chartHolds(state, project), [state, project])
  const list = useMemo(() => morningList(state, project, holds, day), [state, project, holds, day])
  const steps = morningSteps(project, day, state.today)
  const short = (d: string) => weekdayDate(d).split(' ')[0] ?? d
  const when = day === state.today ? 'today' : weekdayDate(day)
  return (
    <Card dataTour="gc-morning-list">
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <strong style={{ flex: '1 1 auto' }}>Who should be on site · {weekdayDate(day)}</strong>
        {steps.before && (
          <Btn kind="quiet" onClick={() => steps.before && onDay(steps.before)} title={`The list for ${weekdayDate(steps.before)}`}>
            ‹ {short(steps.before)}
          </Btn>
        )}
        {steps.after && (
          <Btn kind="quiet" onClick={() => steps.after && onDay(steps.after)} title={`The list for ${weekdayDate(steps.after)}`}>
            {short(steps.after)} ›
          </Btn>
        )}
      </div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>{list.summary}</div>

      <div style={{ display: 'grid', gap: '0.55rem' }}>
        {list.expected.map((c) => (
          <div key={c.pkg.id} data-morning-company={c.pkg.id} style={{ display: 'grid', gap: '0.2rem', fontSize: '0.875rem', paddingTop: '0.45rem', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <CompanyName c={c} />
              <span style={{ flex: 1 }} />
              {c.call && (
                <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {c.call.first} ·{' '}
                  <a href={telHref(c.call.phone)} style={{ color: 'var(--text-link)' }} title={`Call ${c.call.first}`}>
                    {c.call.phone}
                  </a>
                </span>
              )}
            </div>
            {/* The trade's own count sets the tone when it gave one (G-142): a short crew reads amber. */}
            <div style={{ color: c.crewTone ? CREW_TONE[c.crewTone] : c.missing ? 'var(--text-red-700)' : c.onTheDay ? 'var(--text-green-800)' : 'var(--text-muted)', fontWeight: c.missing || c.short ? 600 : 400 }}>{c.logWords}</div>
            {/* At the gate (G-138): a crew whose insurance ran out works uncovered. */}
            {c.insurance && <div style={{ color: 'var(--text-red-700)', fontWeight: 600 }}>{c.insurance}</div>}
            {c.bars.map((b) => (
              <div key={b.lineId} style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap', paddingLeft: '0.75rem' }}>
                <span style={{ flex: '1 1 9rem', minWidth: 0 }}>{b.name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{b.dayWords}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.8rem', minWidth: '2.5rem', textAlign: 'right' }}>{b.pct}%</span>
                {b.flags.map((f) => (
                  <Chip key={f.words} tone={f.tone}>
                    {f.words}
                  </Chip>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      {list.inspections.length > 0 && (
        <>
          <div style={head}>Inspections</div>
          {list.inspections.map((i) => (
            <div key={i.lineId} style={{ fontSize: '0.875rem' }}>
              {i.words}
            </div>
          ))}
        </>
      )}

      {list.arriving.length > 0 && (
        <>
          <div style={head}>Expected {when}</div>
          {list.arriving.map((a) => (
            <div key={a} style={{ fontSize: '0.875rem' }}>
              {a}
            </div>
          ))}
        </>
      )}

      {list.heldOff.length > 0 && (
        <>
          <div style={head}>Held, not expected</div>
          {list.heldOff.map((c) => (
            <div key={c.pkg.id} style={{ fontSize: '0.875rem' }}>
              <CompanyName c={c} />
              {c.bars.map((b) => (
                <div key={b.lineId} style={{ color: 'var(--text-amber-800)', paddingLeft: '0.75rem' }}>
                  {b.name} {b.flags.filter((f) => f.words.startsWith('waits on')).map((f) => f.words).join(' and ')}.
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {list.foot && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>{list.foot}</div>}
    </Card>
  )
}
