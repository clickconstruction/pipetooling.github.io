import { useState } from 'react'
import {
  dailyLogOn,
  logTrades,
  missingLogs,
  newDailyLog,
  partnerById,
  shortDate,
  weekdayDate,
  weekOfLogs,
  type DailyLog,
  type GcProject,
  type GcState,
  type LookAheadReason,
  type WeatherSky,
} from '../../lib/gcMode/gcModel'
import type { GcPaneProps } from './GcOfficeTabs'
import { Btn, Card, Chip, Why, input } from './gcUi'

/**
 * GC mode design spike: the superintendent's daily log (Building lane, owner 2026-10-04). Today's
 * log on top: the weather, who was on site and how many, what got done, what held work up and
 * who came by. A day missed in the last week can be caught up. The week at a glance, then the days before.
 */

type Draft = Omit<DailyLog, 'writtenOn'>

const SKIES: { key: WeatherSky; word: string }[] = [
  { key: 'clear', word: 'Clear' },
  { key: 'cloudy', word: 'Cloudy' },
  { key: 'rain', word: 'Rain' },
  { key: 'storm', word: 'Storm' },
  { key: 'wind', word: 'Wind' },
]
const SKY_WORD: Record<WeatherSky, string> = { clear: 'clear', cloudy: 'cloudy', rain: 'rain', storm: 'storm', wind: 'wind' }
const REASONS: LookAheadReason[] = ['weather', 'trade before', 'materials', 'crew', 'other']

function companyOf(state: GcState, project: GcProject, packageId: string | null): string {
  if (packageId === null) return 'The job'
  const pkg = project.packages.find((k) => k.id === packageId)
  if (!pkg) return packageId
  if (pkg.selfPerform) return `${pkg.trade} · our own crew`
  const invite = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
  const company = invite ? partnerById(state, invite.partnerId)?.company : undefined
  return company ? `${pkg.trade} · ${company}` : pkg.trade
}

export function GcBuildingLogTab({ state, project, dispatch }: GcPaneProps) {
  const today = state.today
  const missing = missingLogs(project, today)
  const [day, setDay] = useState(today)
  const [editing, setEditing] = useState(false)
  const building = project.stage === 'building' && Boolean(project.startedOn)
  const log = dailyLogOn(project, day)
  const earlier = [...(project.dailyLogs ?? [])].filter((l) => !weekOfLogs(project, today).some((w) => w.date === l.date)).reverse()

  return (
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      <Why>
        Our superintendent writes one log for each working day on the job. It says the weather, who was on site and how many,
        what got done, what held work up and who came by. It backs up the look-ahead marks.
      </Why>

      {!building ? (
        <Card>The daily log starts once work starts.</Card>
      ) : (
        <>
          {missing.length > 0 && (
            <Card style={{ border: '1px solid var(--border-strong)' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.875rem' }}>
                <Chip tone="amber">no log</Chip>
                <span>{missing.length === 1 ? 'One working day in the last week has no log.' : `${missing.length} working days in the last week have no log.`}</span>
                {missing.map((d) => (
                  <Btn
                    key={d}
                    kind={day === d ? 'primary' : 'quiet'}
                    onClick={() => {
                      setDay(d)
                      setEditing(true)
                    }}
                  >
                    Write {weekdayDate(d)}
                  </Btn>
                ))}
              </div>
            </Card>
          )}

          {log && !editing ? (
            <LogCard state={state} project={project} log={log} title={day === today ? "Today's log" : `The log for ${weekdayDate(day)}`} onChange={() => setEditing(true)} />
          ) : (
            <LogForm
              key={day}
              state={state}
              project={project}
              start={log ?? newDailyLog(project, day)}
              title={day === today ? `Today's log · ${weekdayDate(day)}` : `The log for ${weekdayDate(day)} · caught up`}
              onSave={(draft) => {
                dispatch({ type: 'saveDailyLog', projectId: project.id, log: draft })
                setEditing(false)
              }}
              onCancel={log ? () => setEditing(false) : undefined}
            />
          )}
          {day !== today && (
            <div>
              <Btn
                kind="quiet"
                onClick={() => {
                  setDay(today)
                  setEditing(false)
                }}
              >
                Back to today
              </Btn>
            </div>
          )}

          <WeekCard
            project={project}
            today={today}
            picked={day}
            onPick={(d) => {
              setDay(d)
              setEditing(false)
            }}
          />

          {earlier.length > 0 && (
            <Card>
              <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Earlier days</div>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {earlier.map((l) => (
                  <LogLine key={l.date} state={state} project={project} log={l} />
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

/** A log to fill in: the weather, the crews, what got done, the delays, the visitors. */
function LogForm({
  state,
  project,
  start,
  title,
  onSave,
  onCancel,
}: {
  state: GcState
  project: GcProject
  start: Draft
  title: string
  onSave: (draft: Draft) => void
  onCancel?: () => void
}) {
  const [d, setD] = useState<Draft>(start)
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }))
  const workers = (id: string) => d.crews.find((c) => c.packageId === id)?.workers ?? 0
  const setWorkers = (id: string, n: number) =>
    set({ crews: [...d.crews.filter((c) => c.packageId !== id), ...(n > 0 ? [{ packageId: id, workers: n }] : [])] })
  const label = { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)' } as const
  const trades = logTrades(project)
  return (
    <Card style={{ border: '2px solid #2563eb' }}>
      <div style={{ display: 'grid', gap: '0.75rem', fontSize: '0.875rem' }}>
        <strong>{title}</strong>

        <div style={{ display: 'grid', gap: '0.3rem' }}>
          <span style={label}>Weather</span>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {SKIES.map((s) => (
              <Btn key={s.key} kind={d.sky === s.key ? 'primary' : 'quiet'} onClick={() => set({ sky: s.key })}>
                {s.word}
              </Btn>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>High</span>
              <input type="number" value={d.high} onChange={(e) => set({ high: Number(e.target.value) })} style={{ ...input, width: '4.5rem' }} aria-label="High, degrees" />
            </label>
            <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Low</span>
              <input type="number" value={d.low} onChange={(e) => set({ low: Number(e.target.value) })} style={{ ...input, width: '4.5rem' }} aria-label="Low, degrees" />
            </label>
            <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <input type="checkbox" checked={d.weatherStop} onChange={(e) => set({ weatherStop: e.target.checked })} />
              <span>Work stopped for the weather</span>
            </label>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.3rem' }}>
          <span style={label}>Who was on site · how many workers</span>
          {trades.map((k) => (
            <label key={k.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ color: workers(k.id) > 0 ? undefined : 'var(--text-muted)' }}>{companyOf(state, project, k.id)}</span>
              <input
                type="number"
                min={0}
                value={workers(k.id)}
                onChange={(e) => setWorkers(k.id, Math.max(0, Number(e.target.value) || 0))}
                style={{ ...input, width: '4.5rem' }}
                aria-label={`Workers on site, ${k.trade}`}
              />
            </label>
          ))}
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>It starts from the day before. 0 means they were not there.</span>
        </div>

        <label style={{ display: 'grid', gap: '0.2rem' }}>
          <span style={label}>What got done</span>
          <textarea
            value={d.done}
            onChange={(e) => set({ done: e.target.value })}
            rows={3}
            placeholder="Membrane down on the east half. Ductwork in bay 4."
            style={{ ...input, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
          />
        </label>

        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={label}>What held work up</span>
          {d.delays.map((delay, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                value={delay.packageId ?? ''}
                onChange={(e) => set({ delays: d.delays.map((x, j) => (j === i ? { ...x, packageId: e.target.value || null } : x)) })}
                style={input}
                aria-label="Whose work it held up"
              >
                <option value="">The job</option>
                {trades.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.trade}
                  </option>
                ))}
              </select>
              <select
                value={delay.reason}
                onChange={(e) => set({ delays: d.delays.map((x, j) => (j === i ? { ...x, reason: e.target.value as LookAheadReason } : x)) })}
                style={input}
                aria-label="Why"
              >
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <input
                value={delay.note}
                onChange={(e) => set({ delays: d.delays.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)) })}
                placeholder="What happened"
                aria-label="What happened"
                style={{ ...input, flex: '1 1 12rem' }}
              />
              <Btn kind="quiet" onClick={() => set({ delays: d.delays.filter((_, j) => j !== i) })}>
                Take off
              </Btn>
            </div>
          ))}
          <div>
            <Btn kind="quiet" onClick={() => set({ delays: [...d.delays, { packageId: null, reason: 'weather', note: '' }] })}>
              Add a delay
            </Btn>
          </div>
        </div>

        <label style={{ display: 'grid', gap: '0.2rem' }}>
          <span style={label}>Inspections and visitors</span>
          <input value={d.visitors} onChange={(e) => set({ visitors: e.target.value })} placeholder="The city inspector, the customer's walk" style={input} />
        </label>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn kind="primary" onClick={() => onSave(d)}>
            Save the log
          </Btn>
          {onCancel && (
            <Btn kind="quiet" onClick={onCancel}>
              Keep it as it was
            </Btn>
          )}
        </div>
      </div>
    </Card>
  )
}

function LogCard({ state, project, log, title, onChange }: { state: GcState; project: GcProject; log: DailyLog; title: string; onChange: () => void }) {
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline', marginBottom: '0.4rem' }}>
        <strong>{title}</strong>
        <Btn kind="quiet" onClick={onChange}>
          Change it
        </Btn>
      </div>
      <LogLine state={state} project={project} log={log} full />
    </Card>
  )
}

/** One day's log: the weather, the crews, what got done, the delays, the visitors. */
function LogLine({ state, project, log, full = false }: { state: GcState; project: GcProject; log: DailyLog; full?: boolean }) {
  const workers = log.crews.reduce((n, c) => n + c.workers, 0)
  return (
    <div style={{ display: 'grid', gap: '0.2rem', fontSize: '0.875rem', paddingTop: full ? 0 : '0.45rem', borderTop: full ? 'none' : '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
        {!full && <strong>{weekdayDate(log.date)}</strong>}
        <span style={{ color: 'var(--text-muted)' }}>
          {SKY_WORD[log.sky]}, {log.high}° / {log.low}° · {workers} on site
        </span>
        {log.weatherStop && <Chip tone="amber">work stopped</Chip>}
        {log.writtenOn > log.date && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>written {shortDate(log.writtenOn)}</span>}
      </div>
      {full && log.crews.length > 0 && (
        <div style={{ color: 'var(--text-muted)' }}>
          {log.crews.map((c) => `${companyOf(state, project, c.packageId)}: ${c.workers}`).join(' · ')}
        </div>
      )}
      {log.done && <div>{log.done}</div>}
      {log.delays.map((d, i) => (
        <div key={i} style={{ color: 'var(--text-amber-800)' }}>
          Held up, {d.reason}: {companyOf(state, project, d.packageId)}. {d.note}
        </div>
      ))}
      {log.visitors && <div style={{ color: 'var(--text-muted)' }}>Visitors: {log.visitors}</div>}
    </div>
  )
}

/** The week at a glance: each working day's weather, crews and delays, or no log. */
function WeekCard({ project, today, picked, onPick }: { project: GcProject; today: string; picked: string; onPick: (date: string) => void }) {
  const week = weekOfLogs(project, today)
  return (
    <Card>
      <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>This week</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(7.5rem, 1fr))', gap: '0.5rem' }}>
        {week.map(({ date, log }) => {
          const future = date > today
          const workers = log ? log.crews.reduce((n, c) => n + c.workers, 0) : 0
          return (
            <button
              key={date}
              type="button"
              disabled={future}
              onClick={() => onPick(date)}
              style={{
                textAlign: 'left',
                border: `1px solid ${picked === date ? '#2563eb' : 'var(--border)'}`,
                borderRadius: 8,
                padding: '0.45rem 0.55rem',
                background: 'var(--surface)',
                color: 'var(--text-base)',
                cursor: future ? 'default' : 'pointer',
                opacity: future ? 0.55 : 1,
                font: 'inherit',
                fontSize: '0.82rem',
                display: 'grid',
                gap: '0.15rem',
              }}
            >
              <strong>{weekdayDate(date)}</strong>
              {log ? (
                <>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {SKY_WORD[log.sky]}, {log.high}°
                  </span>
                  <span>{workers} on site</span>
                  {log.delays.length > 0 && <span style={{ color: 'var(--text-amber-800)' }}>{log.delays.length === 1 ? '1 delay' : `${log.delays.length} delays`}</span>}
                </>
              ) : future ? (
                <span style={{ color: 'var(--text-muted)' }}>not yet</span>
              ) : (
                <span style={{ color: 'var(--text-amber-800)' }}>{date === today ? 'to write' : 'no log'}</span>
              )}
            </button>
          )
        })}
      </div>
    </Card>
  )
}

