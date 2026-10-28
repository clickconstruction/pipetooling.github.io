/**
 * Punch list #141 PR 2: **Push me**, inside the Push Notifications card on Settings → Your account, for everyone who
 * signs in. Two rows in My way's shape, *Push me any time* and *Push me only at these hours*, a press saving at once;
 * under the second the Office hours card's own controls, the day toggles and From and To, with **Save my hours** and
 * **Put them back**. The row is the person's own (`user_push_hours`, `pushHoursIo.ts`); the rules and the words are
 * `lib/messages/pushHours.ts`. Nothing holds a push until PR 3, and the last line says so.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import type { OfficeHours } from '../../lib/messages/hasRule'
import { DAY_LONG, DAY_SHORT, toggleDay } from '../../lib/messages/officeHoursCard'
import {
  PUSH_HOURS_WORDS,
  pushDraftFrom,
  pushDraftProblem,
  pushHoursLine,
  pushHoursOf,
  samePushDraft,
  type PushHoursDraft,
} from '../../lib/messages/pushHours'
import { supabasePushHoursIo, type PushHoursIo } from '../../lib/messages/pushHoursIo'
import { formatErrorMessage } from '../../utils/errorHandling'

const W = PUSH_HOURS_WORDS

const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }
const opt: CSSProperties = { display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.875rem' }
/** The day toggles and the time inputs, as the Office hours card draws them. */
const timeStyle: CSSProperties = { padding: '0.25rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)', fontSize: '0.9rem' }

function dayStyle(on: boolean, busy: boolean): CSSProperties {
  return {
    border: '1px solid var(--border-strong)',
    borderRadius: 999,
    padding: '0.15rem 0.6rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: busy ? 'default' : 'pointer',
    background: on ? 'var(--text-blue-500)' : 'var(--surface)',
    color: on ? 'white' : 'var(--text-base)',
    opacity: busy ? 0.6 : 1,
  }
}

export function PushHoursBlock({ userId: userIdProp, io: ioProp }: { userId?: string; io?: PushHoursIo }) {
  const { showToast } = useToastContext()
  const { user } = useAuth()
  const userId = userIdProp ?? user?.id ?? null
  const io = useMemo(() => ioProp ?? supabasePushHoursIo(), [ioProp])
  /** The hours as the row holds them; undefined while the row is read. */
  const [saved, setSaved] = useState<OfficeHours | null | undefined>(undefined)
  const [draft, setDraft] = useState<PushHoursDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let live = true
    io.load(userId).then(
      (h) => {
        if (!live) return
        setSaved(h)
        setDraft(pushDraftFrom(h))
      },
      () => {
        if (!live) return
        setSaved(null)
        setDraft(pushDraftFrom(null))
      },
    )
    return () => {
      live = false
    }
  }, [io, userId])

  if (!userId) return null

  const write = async (next: OfficeHours | null) => {
    setBusy(true)
    setProblem(null)
    try {
      if (next) await io.save(userId, next)
      else await io.clear(userId)
      setSaved(next)
      setDraft(pushDraftFrom(next))
      showToast(pushHoursLine(next), 'success')
    } catch (e) {
      setProblem(formatErrorMessage(e, W.notSaved))
    } finally {
      setBusy(false)
    }
  }

  /** A row pressed: any time removes the row at once; only at these hours saves the kept hours, else the default window, at once. */
  const pick = (only: boolean) => {
    if (!draft || only === draft.only) return
    if (!only) {
      void write(null)
      return
    }
    const next = pushHoursOf({ ...draft, only: true })
    if (next) void write(next)
    else setDraft({ ...draft, only: true })
  }

  const bad = draft ? pushDraftProblem(draft) : null
  const changed = !!draft && saved !== undefined && !samePushDraft(draft, pushDraftFrom(saved))

  const save = () => {
    if (!draft || bad || !changed) return
    const next = pushHoursOf(draft)
    if (next) void write(next)
  }

  const putBack = () => {
    if (saved !== undefined) setDraft(pushDraftFrom(saved))
  }

  return (
    <div id="settings-push-hours" data-push-hours style={{ borderTop: '1px solid var(--border)', marginTop: '1rem', paddingTop: '0.75rem', display: 'grid', gap: '0.5rem' }}>
      <h3 id="push-hours-title" style={{ margin: 0, fontSize: '0.95rem' }}>
        {W.title}
      </h3>
      {!draft && <p style={muted}>{W.loading}</p>}
      {draft && (
        <>
          <fieldset aria-labelledby="push-hours-title" style={{ border: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.35rem' }}>
            <label style={opt}>
              <input type="radio" name="push-hours" value="any" checked={!draft.only} disabled={busy} onChange={() => pick(false)} />
              {W.any}
            </label>
            <label style={opt}>
              <input type="radio" name="push-hours" value="only" checked={draft.only} disabled={busy} onChange={() => pick(true)} />
              {W.only}
            </label>
          </fieldset>
          {draft.only && (
            <div data-push-hours-form style={{ display: 'grid', gap: '0.5rem', paddingLeft: '1.4rem' }}>
              <div role="group" aria-label={W.days} style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', marginRight: '0.2rem' }}>{W.days}</span>
                {DAY_SHORT.map((short, d) => {
                  const on = draft.days.includes(d)
                  return (
                    <button
                      key={short}
                      type="button"
                      aria-pressed={on}
                      aria-label={DAY_LONG[d]}
                      disabled={busy}
                      onClick={() => setDraft({ ...draft, days: toggleDay(draft.days, d) })}
                      style={dayStyle(on, busy)}
                    >
                      {short}
                    </button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <label htmlFor="push-hours-from" style={{ fontSize: '0.9rem' }}>
                  {W.from}
                </label>
                <input id="push-hours-from" type="time" step={900} value={draft.opens} disabled={busy} onChange={(e) => setDraft({ ...draft, opens: e.target.value })} style={timeStyle} />
                <label htmlFor="push-hours-to" style={{ fontSize: '0.9rem' }}>
                  {W.to}
                </label>
                <input id="push-hours-to" type="time" step={900} value={draft.closes} disabled={busy} onChange={(e) => setDraft({ ...draft, closes: e.target.value })} style={timeStyle} />
              </div>
              <p data-push-hours-line style={bad ? { ...muted, color: 'var(--text-red-700)' } : muted}>
                {bad ?? pushHoursLine(pushHoursOf(draft))}
              </p>
              <p data-push-hours-hold style={muted}>
                {W.hold}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={save}
                  disabled={!changed || !!bad || busy}
                  style={{
                    border: '1px solid var(--border-strong)',
                    borderRadius: 6,
                    padding: '0.25rem 0.7rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: changed && !bad && !busy ? 'pointer' : 'default',
                    background: changed && !bad ? 'var(--text-blue-500)' : 'var(--surface)',
                    color: changed && !bad ? 'white' : 'var(--text-muted)',
                  }}
                >
                  {busy ? 'Saving…' : W.save}
                </button>
                <button
                  type="button"
                  onClick={putBack}
                  disabled={!changed || busy}
                  style={{
                    border: '1px solid var(--border-strong)',
                    borderRadius: 6,
                    padding: '0.25rem 0.7rem',
                    fontSize: '0.85rem',
                    background: 'var(--surface)',
                    color: changed ? 'var(--text-base)' : 'var(--text-muted)',
                    cursor: changed && !busy ? 'pointer' : 'default',
                  }}
                >
                  {W.putBack}
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
          {problem}
        </div>
      )}
    </div>
  )
}
