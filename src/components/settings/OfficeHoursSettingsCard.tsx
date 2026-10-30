/**
 * Punch list #140 PR 1: Settings → Phone and texts → **Office hours**, for the owner and a dev. The days the office is
 * in and when it opens and closes, saved into the JSON `hasRule.ts` reads (`messages_office_hours_v1`) through
 * `officeHoursCardIo.ts`, the tech's hour and the after-hours number kept as they are (`officeHoursCard.ts`). Everyone
 * else on the page reads the line. After hours nothing answers on its own: the office hears first and the reply waits
 * for the morning, which is all the card says.
 *
 * Punch list #141 PR 1: the switch **The office is open around the clock** sits first, the On/Off pill the Reply push
 * card uses. On, the day toggles and the two times fold away, the line reads *Open around the clock*, and two lines
 * say what that means for the reply push. The days and times stay in the row under the switch, so Off puts them back.
 * The tech's hour is read back as a line for everyone; a field for it is a later PR.
 *
 * Punch list #141 PR 4 (v2.6060): while the switch is on, one amber line for the owner and a dev when every office
 * member's Push me hours leave a stretch with nobody pushed, *Nobody hears a reply from 11 PM to 6 AM. Rosa, Evan and
 * Taunya are all off then.* (`messages/whoIsOff.ts` over `pushCoverageIo.ts`). The company's switch says the office is
 * open; the people's hours say whether anyone is; the line is where the two meet, and it is the owner's to act on.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import type { UserRole } from '../../hooks/useAuth'
import { isOwnerOrDev } from '../../lib/gc/access'
import { parseOfficeHours, type OfficeHours } from '../../lib/messages/hasRule'
import {
  DAY_LONG,
  DAY_SHORT,
  draftFrom,
  draftProblem,
  hoursLine,
  OFFICE_HOURS_WORDS,
  sameDraft,
  serializeOfficeHours,
  techHourLine,
  toggleDay,
  type OfficeHoursDraft,
} from '../../lib/messages/officeHoursCard'
import { supabaseOfficeHoursIo, type OfficeHoursIo } from '../../lib/messages/officeHoursCardIo'
import { supabasePushCoverageIo, type PushCoverageIo } from '../../lib/messages/pushCoverageIo'
import { coverageGaps, coverageLine, type CoverageMember } from '../../lib/messages/whoIsOff'
import { formatErrorMessage } from '../../utils/errorHandling'

const DEFAULT_IO = supabaseOfficeHoursIo()
const DEFAULT_COVERAGE = supabasePushCoverageIo()
const W = OFFICE_HOURS_WORDS

const cardStyle: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.8rem 0.9rem', display: 'grid', gap: '0.6rem', background: 'var(--surface)' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }
const timeStyle: CSSProperties = { padding: '0.25rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)', fontSize: '0.9rem' }

function dayStyle(on: boolean, saving: boolean): CSSProperties {
  return {
    border: '1px solid var(--border-strong)',
    borderRadius: 999,
    padding: '0.15rem 0.6rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: saving ? 'default' : 'pointer',
    background: on ? 'var(--text-link)' : 'var(--surface)',
    color: on ? 'var(--surface)' : 'var(--text-base)',
    opacity: saving ? 0.6 : 1,
  }
}

/** The On/Off pill, as the Reply push card draws its switch. */
function switchStyle(on: boolean, saving: boolean): CSSProperties {
  return {
    border: '1px solid var(--border-strong)',
    borderRadius: 999,
    padding: '0.15rem 0.7rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: saving ? 'default' : 'pointer',
    background: on ? '#16a34a' : 'var(--surface)',
    color: on ? 'white' : 'var(--text-base)',
    opacity: saving ? 0.6 : 1,
  }
}

export function OfficeHoursSettingsCard({
  role,
  io = DEFAULT_IO,
  coverage = DEFAULT_COVERAGE,
  now = () => new Date().toISOString(),
}: {
  role: UserRole | null | undefined
  io?: OfficeHoursIo
  /** The office team's Push me hours, for the coverage line (v2.6060). A test hands in a fake. */
  coverage?: PushCoverageIo
  /** When a save happened, for the row's `savedAt`. A test hands in a fixed clock. */
  now?: () => string
}) {
  const { showToast } = useToastContext()
  const canSet = isOwnerOrDev(role)
  const [hours, setHours] = useState<OfficeHours | null>(null)
  const [draft, setDraft] = useState<OfficeHoursDraft | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // The office team with their hours (v2.6060), read for whoever may set the hours; empty until read, and when the read fails.
  const [members, setMembers] = useState<CoverageMember[]>([])

  useEffect(() => {
    if (!canSet) return
    let live = true
    coverage.load().then(
      (m) => {
        if (live) setMembers(m)
      },
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [canSet, coverage])

  useEffect(() => {
    let live = true
    io.load().then(
      (r) => {
        if (!live) return
        setHours(r.hours)
        setDraft(draftFrom(r.hours))
      },
      (e: unknown) => {
        if (live) setProblem(formatErrorMessage(e))
      },
    )
    return () => {
      live = false
    }
  }, [io])

  const changed = !!hours && !!draft && !sameDraft(draft, draftFrom(hours))
  const bad = draft ? draftProblem(draft) : null
  // Where the switch and the people's hours meet (v2.6060): drawn only while the switch is on and a gap exists.
  const coverageWords = draft?.always ? coverageLine(coverageGaps(members), members.map((m) => m.name)) : null

  const save = async () => {
    if (!hours || !draft || bad || !changed) return
    setSaving(true)
    setProblem(null)
    try {
      const json = serializeOfficeHours(hours, draft, now())
      await io.save(json)
      // What the rule will read from the row, so the line and the next draft start from the saved hours.
      const saved = parseOfficeHours(json)
      setHours(saved)
      setDraft(draftFrom(saved))
      showToast(W.saved, 'success')
    } catch (e) {
      setProblem(formatErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const putBack = () => {
    if (hours) setDraft(draftFrom(hours))
  }

  /** The two lines under the switch while it is on, and the tech's hour for everyone. */
  const alwaysLines = (
    <>
      <p data-office-hours-always-line style={muted}>{W.alwaysWhoever}</p>
      <p style={muted}>{W.alwaysOffice}</p>
    </>
  )

  return (
    <section aria-labelledby="phone-texts-hours" id="settings-phone-texts-hours" data-settings-hours style={cardStyle}>
      <h3 id="phone-texts-hours" style={{ margin: 0, fontSize: '1rem' }}>
        {W.title}
      </h3>
      <p style={{ margin: 0, fontSize: '0.9rem' }}>{W.note}</p>
      {!hours && !problem && <p style={muted}>{W.loading}</p>}
      {hours && draft && canSet && (
        <div data-office-hours-form style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.9rem' }}>{W.always}</span>
            <button
              type="button"
              role="switch"
              aria-checked={draft.always}
              aria-label={W.always}
              disabled={saving}
              onClick={() => setDraft({ ...draft, always: !draft.always })}
              style={switchStyle(draft.always, saving)}
            >
              {draft.always ? 'On' : 'Off'}
            </button>
          </div>
          {!draft.always && (
            <>
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
                      disabled={saving}
                      onClick={() => setDraft({ ...draft, days: toggleDay(draft.days, d) })}
                      style={dayStyle(on, saving)}
                    >
                      {short}
                    </button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <label htmlFor="phone-texts-hours-opens" style={{ fontSize: '0.9rem' }}>
                  {W.opens}
                </label>
                <input
                  id="phone-texts-hours-opens"
                  type="time"
                  step={900}
                  value={draft.opens}
                  disabled={saving}
                  onChange={(e) => setDraft({ ...draft, opens: e.target.value })}
                  style={timeStyle}
                />
                <label htmlFor="phone-texts-hours-closes" style={{ fontSize: '0.9rem' }}>
                  {W.closes}
                </label>
                <input
                  id="phone-texts-hours-closes"
                  type="time"
                  step={900}
                  value={draft.closes}
                  disabled={saving}
                  onChange={(e) => setDraft({ ...draft, closes: e.target.value })}
                  style={timeStyle}
                />
              </div>
            </>
          )}
          <p data-office-hours-line style={bad ? { ...muted, color: 'var(--text-red-700)' } : muted}>
            {bad ?? hoursLine(draft)}
          </p>
          {coverageWords && (
            <p data-office-hours-coverage style={{ ...muted, color: 'var(--text-amber-700)' }}>
              {coverageWords}
            </p>
          )}
          {draft.always && alwaysLines}
          <p data-office-hours-tech style={muted}>
            {techHourLine(hours.techUntil)}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!changed || !!bad || saving}
              style={{
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                padding: '0.25rem 0.7rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: changed && !bad && !saving ? 'pointer' : 'default',
                background: changed && !bad ? 'var(--text-link)' : 'var(--surface)',
                color: changed && !bad ? 'var(--surface)' : 'var(--text-muted)',
              }}
            >
              {saving ? 'Saving…' : W.save}
            </button>
            <button
              type="button"
              onClick={putBack}
              disabled={!changed || saving}
              style={{
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                padding: '0.25rem 0.7rem',
                fontSize: '0.85rem',
                background: 'var(--surface)',
                color: changed ? 'var(--text-base)' : 'var(--text-muted)',
                cursor: changed && !saving ? 'pointer' : 'default',
              }}
            >
              {W.putBack}
            </button>
          </div>
        </div>
      )}
      {hours && !canSet && (
        <div data-office-hours-read style={{ display: 'grid', gap: '0.25rem' }}>
          <p data-office-hours-line style={{ margin: 0, fontSize: '0.9rem' }}>
            {hoursLine(hours)}
          </p>
          {hours.always && alwaysLines}
          <p data-office-hours-tech style={muted}>
            {techHourLine(hours.techUntil)}
          </p>
          <p style={muted}>{W.notAllowed}</p>
        </div>
      )}
      {problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
          {problem}
        </div>
      )}
    </section>
  )
}
