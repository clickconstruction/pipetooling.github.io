/**
 * Add or change a trip (punch list #379, PR 3): three questions, who went, which days, what for. The days
 * are painted: picking the first and last day paints each At the site and a tap turns a day's kind.
 * Everything else waits under More and can be left empty for good. One person and one day is a whole trip.
 *
 * The moves are `lib/trips/tripSheet.ts`; this file draws them. Saving a trip changes no clock row, bill
 * or cost, and nothing is sent to anyone. Drawn through a portal on the body, as the page's other sheets.
 */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { TRIP_STANDING_LABEL } from '../../lib/trips/tripDays'
import { TRIP_ASKED_MAX, TRIP_BILLINGS, TRIP_BILLING_LABEL, TRIP_NAME_MAX, TRIP_OUTCOME_MAX, TRIP_PURPOSE_MAX, type TripRecord, type TripRosterPerson } from '../../lib/trips/tripRecord'
import {
  addSheetPerson,
  clearSheetPersonDays,
  recordFromSheet,
  removeSheetPerson,
  setSheetRange,
  sheetDays,
  sheetFromRecord,
  sheetHasMore,
  sheetPersonDays,
  sheetProblem,
  sheetRosterLeft,
  sheetStanding,
  tapSheetDay,
  tapSheetPersonDay,
  type TripSheetState,
} from '../../lib/trips/tripSheet'
import { monthDay } from '../../lib/trips/tripsLook'
import { capStyle, LinkButton, SmallButton } from '../developments/developmentPageBits'
import { TripLegend, TripPaintDays } from './TripDayBits'

export type TripSheetJob = { id: string; label: string; name: string }

export function TripSheet({
  record,
  isNew,
  siteName,
  roster,
  jobs,
  todayYmd,
  busy,
  zIndex = 760,
  onSave,
  onClose,
}: {
  /** The trip the sheet opens on: a kept one, or a new one with nobody on it yet. */
  record: TripRecord
  isNew: boolean
  siteName: string
  /** The roster for Who went; null while it is being read. */
  roster: ReadonlyArray<TripRosterPerson> | null
  jobs: ReadonlyArray<TripSheetJob>
  todayYmd: string
  busy: boolean
  zIndex?: number
  /** Saves the trip; true when it saved, so the sheet closes. */
  onSave: (record: TripRecord) => Promise<boolean>
  onClose: () => void
}) {
  const [state, setState] = useState<TripSheetState>(() => sheetFromRecord(record, todayYmd))
  const [typing, setTyping] = useState(false)
  const [typed, setTyped] = useState('')
  const [moreOpen, setMoreOpen] = useState(() => sheetHasMore(sheetFromRecord(record, todayYmd)))
  const [ownOpen, setOwnOpen] = useState(() => sheetFromRecord(record, todayYmd).people.some((p) => p.own))
  useModalStackEntry(true)
  useEffect(() => {
    // Taken in the capture phase and marked handled, so a window under the sheet keeps its own Escape for the next press.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const left = useMemo(() => sheetRosterLeft(state, roster ?? []), [state, roster])
  const problem = sheetProblem(state, record)
  const standing = sheetStanding(state, record, todayYmd)
  const days = sheetDays(state)
  const jobsLeft = jobs.filter((j) => !state.jobIds.includes(j.id))
  const set = (patch: Partial<TripSheetState>) => setState((s) => ({ ...s, ...patch }))
  const addTyped = () => {
    setState((s) => addSheetPerson(s, { name: typed }))
    setTyped('')
    setTyping(false)
  }
  const save = async () => {
    if (problem || busy) return
    const ok = await onSave(recordFromSheet(state, record))
    if (ok) onClose()
  }
  const chip = { fontSize: '0.78rem' } as const
  const input = { font: 'inherit', fontSize: '0.84rem', padding: '6px 9px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', minWidth: 0 } as const

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`A trip to ${siteName}`}
      data-testid="trip-sheet"
      style={{ position: 'fixed', inset: 0, zIndex, background: 'rgba(17, 24, 39, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(16px + env(safe-area-inset-top, 0px)) 16px 16px' }}
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="developmentHistoryBox" style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 12, boxShadow: '0 20px 50px rgba(17, 24, 39, 0.3)', width: 560, maxWidth: '100%', maxHeight: 'calc(100vh - 32px - env(safe-area-inset-top, 0px))', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <strong style={{ fontSize: '1rem' }}>A trip to {siteName}</strong>
          <button type="button" onClick={onClose} aria-label="Close" title="Close" style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', font: 'inherit', fontSize: '1.2rem', lineHeight: 1, padding: '0 2px' }}>
            ×
          </button>
        </div>
        <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14, overflow: 'auto' }}>
          <div>
            <div style={{ ...capStyle, marginBottom: 5 }}>Who went?</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {state.people.map((p, i) => (
                <button key={`${p.personId ?? ''}:${p.name}`} type="button" className="developmentHistoryChip" data-on="1" style={chip} title={`Take ${p.name} off this trip`} aria-label={`Take ${p.name} off this trip`} onClick={() => setState((s) => removeSheetPerson(s, i))} data-testid="trip-person-chip">
                  {p.name} ✕
                </button>
              ))}
              {roster == null ? (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Reading the roster…</span>
              ) : left.length > 0 ? (
                <select
                  value=""
                  aria-label="Add a person"
                  data-testid="trip-add-person"
                  style={{ ...input, padding: '4px 6px', fontSize: '0.78rem', maxWidth: 170 }}
                  onChange={(e) => {
                    const pick = left.find((r) => r.id === e.target.value)
                    if (pick) setState((s) => addSheetPerson(s, pick))
                  }}
                >
                  <option value="">+ a person</option>
                  {left.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              ) : null}
              {typing ? (
                <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <input
                    autoFocus
                    value={typed}
                    maxLength={TRIP_NAME_MAX}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder="Their name"
                    aria-label="The name of someone not in the app"
                    data-testid="trip-typed-name"
                    style={{ ...input, width: 150 }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addTyped()
                      }
                    }}
                  />
                  <SmallButton onClick={addTyped} disabled={!typed.trim()} title={typed.trim() ? 'Add them to this trip' : 'Type their name first'}>
                    Add
                  </SmallButton>
                </span>
              ) : (
                <button type="button" className="developmentHistoryChip" style={{ ...chip, borderStyle: 'dashed' }} onClick={() => setTyping(true)} data-testid="trip-add-typed">
                  + someone not in the app
                </button>
              )}
            </div>
          </div>

          <div>
            <div style={{ ...capStyle, marginBottom: 5 }}>Which days?</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
              <input type="date" value={state.first} aria-label="The first day" data-testid="trip-first-day" style={input} onChange={(e) => e.target.value && setState((s) => setSheetRange(s, e.target.value, s.last))} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>to</span>
              <input type="date" value={state.last} min={state.first} aria-label="The last day" data-testid="trip-last-day" style={input} onChange={(e) => e.target.value && setState((s) => setSheetRange(s, s.first, e.target.value))} />
            </div>
            <TripPaintDays days={days} dayWords={monthDay} onTap={(ymd) => setState((s) => tapSheetDay(s, ymd))} />
            <TripLegend noPlace={false} />
            <p style={{ margin: '4px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>Tap a day to change its kind. Add a day before it to count getting ready.</p>
            {state.people.length > 1 ? (
              <div style={{ marginTop: 8, fontSize: '0.78rem' }}>
                <LinkButton onClick={() => setOwnOpen((v) => !v)} title="One person can have days of their own: a late start, a day off, an early drive home">
                  {ownOpen ? 'Hide each person’s days' : 'Give one person their own days ›'}
                </LinkButton>
                {ownOpen ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8, marginTop: 8 }} data-testid="trip-own-days">
                    {state.people.map((p, i) => (
                      <div key={`${p.personId ?? ''}:${p.name}`}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: '0.78rem', marginBottom: 3 }}>
                          <strong>{p.name}</strong>
                          {p.own ? <LinkButton onClick={() => setState((s) => clearSheetPersonDays(s, i))}>Same days as the trip</LinkButton> : <span style={{ color: 'var(--text-muted)' }}>the trip’s days</span>}
                        </div>
                        <TripPaintDays days={sheetPersonDays(state, p)} dayWords={(ymd) => `${p.name}, ${monthDay(ymd)}`} onTap={(ymd) => setState((s) => tapSheetPersonDay(s, i, ymd))} testId="trip-person-days" />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div>
            <div style={{ ...capStyle, marginBottom: 5 }}>What for?</div>
            <input value={state.purpose} maxLength={TRIP_PURPOSE_MAX} onChange={(e) => set({ purpose: e.target.value })} placeholder="What the trip was for, in a few words" aria-label="What for" data-testid="trip-purpose" style={{ ...input, width: '100%', boxSizing: 'border-box' }} />
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', background: 'var(--bg-subtle)' }}>
            <button type="button" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} data-testid="trip-more" style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-700)', cursor: 'pointer' }}>
              {moreOpen ? '▾' : '▸'} More · all of it can wait
            </button>
            {moreOpen ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12, marginTop: 10 }}>
                <div>
                  <div style={{ ...capStyle, marginBottom: 5 }}>Who asked for it?</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }} role="radiogroup" aria-label="Who asked for it">
                    {(['us', 'them'] as const).map((k) => (
                      <button key={k} type="button" role="radio" aria-checked={state.askedBy === k} className="developmentHistoryChip" data-on={state.askedBy === k ? '1' : undefined} style={chip} onClick={() => set({ askedBy: state.askedBy === k ? null : k })} data-testid={`trip-asked-${k}`}>
                        {k === 'us' ? 'Us' : 'Them'}
                      </button>
                    ))}
                    {state.askedBy === 'them' ? (
                      <>
                        <input value={state.askedWho} maxLength={TRIP_ASKED_MAX} onChange={(e) => set({ askedWho: e.target.value })} placeholder="Who, and their role" aria-label="Who asked" data-testid="trip-asked-who" style={{ ...input, flex: '1 1 150px' }} />
                        <input value={state.askedHow} maxLength={TRIP_ASKED_MAX} onChange={(e) => set({ askedHow: e.target.value })} placeholder="How and when" aria-label="How and when they asked" data-testid="trip-asked-how" style={{ ...input, flex: '1 1 150px' }} />
                      </>
                    ) : null}
                  </div>
                </div>
                <div>
                  <div style={{ ...capStyle, marginBottom: 5 }}>Work goes on</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    {state.jobIds.map((id) => {
                      const j = jobs.find((x) => x.id === id)
                      const words = j ? `${j.label} ${j.name}`.trim() : 'A job no longer on this site'
                      return (
                        <button key={id} type="button" className="developmentHistoryChip" data-on="1" style={chip} title={`Take ${words} off this trip`} aria-label={`Take ${words} off this trip`} onClick={() => set({ jobIds: state.jobIds.filter((x) => x !== id) })} data-testid="trip-job-chip">
                          {words} ✕
                        </button>
                      )
                    })}
                    {jobsLeft.length > 0 ? (
                      <select value="" aria-label="Add a job" data-testid="trip-add-job" style={{ ...input, padding: '4px 6px', fontSize: '0.78rem', maxWidth: 220 }} onChange={(e) => e.target.value && set({ jobIds: [...state.jobIds, e.target.value] })}>
                        <option value="">+ a job</option>
                        {jobsLeft.map((j) => (
                          <option key={j.id} value={j.id}>
                            {`${j.label} ${j.name}`.trim()}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                </div>
                <div>
                  <div style={{ ...capStyle, marginBottom: 5 }}>Billing</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="radiogroup" aria-label="Billing">
                    {TRIP_BILLINGS.map((k) => (
                      <button key={k} type="button" role="radio" aria-checked={state.billing === k} className="developmentHistoryChip" data-on={state.billing === k ? '1' : undefined} style={chip} onClick={() => set({ billing: state.billing === k ? null : k })} data-testid={`trip-billing-${k}`}>
                        {TRIP_BILLING_LABEL[k]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ ...capStyle, marginBottom: 5 }}>How it went</div>
                  <textarea value={state.outcome} maxLength={TRIP_OUTCOME_MAX} rows={2} onChange={(e) => set({ outcome: e.target.value })} placeholder="A sentence, once the trip is back" aria-label="How it went" data-testid="trip-outcome" style={{ ...input, width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.76rem', color: problem ? 'var(--text-amber-800)' : 'var(--text-muted)' }} data-testid="trip-sheet-foot">
            {problem ?? `Saves as ${TRIP_STANDING_LABEL[standing]}. Nothing is sent to anyone.`}
          </span>
          <span style={{ display: 'inline-flex', gap: 8 }}>
            <SmallButton onClick={onClose}>Cancel</SmallButton>
            <SmallButton onClick={() => void save()} primary disabled={!!problem || busy} title={problem ?? (isNew ? 'Save this trip' : 'Save the changes to this trip')}>
              {busy ? 'Saving…' : 'Save the trip'}
            </SmallButton>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
