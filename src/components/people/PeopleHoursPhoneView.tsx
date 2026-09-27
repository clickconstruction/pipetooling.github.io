import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { CLOCK_SESSION_LIST_SELECT } from '../../lib/clockSessionSelect'
import { fetchAllPendingClockSessions } from '../../lib/people/fetchAllPendingClockSessions'
import { shortJobOrBidLabelFromEmbeds, type ClockSessionRow } from '../../types/clockSessions'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { denverCalendarDayKey, formatDenverTimeOnly } from '../../utils/dateUtils'
import { formatHoursShort } from '../../lib/myTeamApprovals'
import { approvalsPhonePeople, leftTodayRows, whosInRows, type HoursPhoneSession } from '../../lib/people/hoursPhone'
import type { PersonDeskViewer } from '../../lib/people/personDeskGates'
import { PersonDeskHoursSection } from '../personDesk/sections/PersonDeskHoursSection'

/**
 * People · Hours on a phone (v2.3889, punch list #30 PR 5d): three views behind
 * one sticky switch. *Who's in* and *Approvals* are lists drawn here; *Week &
 * sessions* is the tab as it was — the clock strip, the grid with its day
 * sheets, the sessions — drawn by the page under this component. A person —
 * from either list — opens as their own screen: the Person Desk's Hours
 * section, with now, the week, what is waiting and Approve.
 */

export type HoursPhoneViewKey = 'in' | 'approvals' | 'sessions'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const shortDay = (ymd: string) => `${MONTHS[Number(ymd.slice(5, 7)) - 1] ?? ''} ${Number(ymd.slice(8, 10))}`
const timeOf = (iso: string) => formatDenverTimeOnly(Date.parse(iso))

const listStyle: CSSProperties = { listStyle: 'none', margin: 0, padding: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }
const rowBtn: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 52, padding: '0.5rem 0.75rem', border: 'none', background: 'none', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer' }
const sub: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const groupLabel: CSSProperties = { margin: '0.9rem 0 0.3rem', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }

export function PeopleHoursPhoneView({
  view,
  onView,
  viewer,
  viewerUserId,
  reloadKey,
  onChanged,
}: {
  view: HoursPhoneViewKey
  onView: (v: HoursPhoneViewKey) => void
  viewer: PersonDeskViewer
  viewerUserId: string | null
  /** Bump to re-read — the page bumps it when hours change elsewhere. */
  reloadKey: number
  /** Hours changed from the person screen — the page refreshes its own lists. */
  onChanged: () => void
}) {
  const prefixMap = useLedgerPrefixMap()
  const [open, setOpen] = useState<ClockSessionRow[] | null>(null)
  const [today, setToday] = useState<ClockSessionRow[]>([])
  const [pending, setPending] = useState<ClockSessionRow[] | null>(null)
  const [person, setPerson] = useState<{ userId: string; name: string } | null>(null)
  const [changeKey, setChangeKey] = useState(0)
  const [failed, setFailed] = useState(false)
  const todayYmd = denverCalendarDayKey(Date.now())

  const load = useCallback(async () => {
    try {
      const [openRows, todayRows, pendingRows] = await Promise.all([
        withSupabaseRetry(async () => supabase.from('clock_sessions').select(CLOCK_SESSION_LIST_SELECT).is('clocked_out_at', null).is('revoked_at', null).is('rejected_at', null).order('clocked_in_at', { ascending: true }).limit(500), 'hours phone: who is in'),
        withSupabaseRetry(async () => supabase.from('clock_sessions').select(CLOCK_SESSION_LIST_SELECT).eq('work_date', todayYmd).not('clocked_out_at', 'is', null).is('revoked_at', null).is('rejected_at', null).limit(1000), 'hours phone: left today'),
        fetchAllPendingClockSessions(),
      ])
      setOpen((openRows ?? []) as unknown as ClockSessionRow[])
      setToday((todayRows ?? []) as unknown as ClockSessionRow[])
      setPending(pendingRows)
      setFailed(false)
    } catch {
      setOpen((prev) => prev ?? [])
      setPending((prev) => prev ?? [])
      setFailed(true)
    }
  }, [todayYmd])

  useEffect(() => {
    void load()
  }, [load, reloadKey, changeKey])

  const toPhone = useCallback(
    (r: ClockSessionRow): HoursPhoneSession => ({
      id: r.id,
      user_id: r.user_id,
      name: (r.users?.name ?? '').trim() || 'Unknown',
      clocked_in_at: r.clocked_in_at,
      clocked_out_at: r.clocked_out_at ?? null,
      work_date: r.work_date ?? null,
      label: shortJobOrBidLabelFromEmbeds(r, prefixMap),
    }),
    [prefixMap],
  )
  const inRows = useMemo(() => whosInRows((open ?? []).map(toPhone), Date.now()), [open, toPhone])
  const leftRows = useMemo(() => leftTodayRows(today.map(toPhone), new Set(inRows.map((r) => r.userId))), [today, toPhone, inRows])
  const waiting = useMemo(() => approvalsPhonePeople((pending ?? []).map(toPhone)), [pending, toPhone])
  const waitingSessions = waiting.reduce((n, p) => n + p.sessions, 0)

  const seg = (key: HoursPhoneViewKey, label: string, count: number | null) => {
    const active = view === key
    return (
      <button key={key} type="button" role="tab" aria-selected={active} data-hours-phone-tab={key} onClick={() => onView(key)} style={{ flex: 1, minHeight: 40, padding: '0 0.4rem', border: 'none', background: active ? 'var(--text-link)' : 'var(--surface)', color: active ? 'var(--surface)' : 'var(--text-700)', font: 'inherit', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {label}
        {count != null ? ` ${count}` : ''}
      </button>
    )
  }

  return (
    <div data-hours-phone>
      <div role="tablist" aria-label="Hours views" style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', border: '1px solid var(--border-strong)', borderRadius: 10, overflow: 'hidden', marginBottom: '0.75rem', background: 'var(--surface)' }}>
        {seg('in', 'Who’s in', open == null ? null : inRows.length)}
        {seg('approvals', 'Approvals', pending == null ? null : waitingSessions)}
        {seg('sessions', 'Week & sessions', null)}
      </div>
      {failed ? <p style={{ margin: '0 0 0.6rem', color: 'var(--text-red-700)', fontSize: '0.8125rem' }}>Could not read the clock just now. Pull to refresh, or try again in a moment.</p> : null}

      {view === 'in' ? (
        <>
          {open == null ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Reading the clock…</p>
          ) : inRows.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nobody is clocked in.</p>
          ) : (
            <ul style={listStyle}>
              {inRows.map((r) => (
                <li key={r.userId} style={{ borderBottom: '1px solid var(--border)' }}>
                  <button type="button" data-hours-phone-in={r.userId} onClick={() => setPerson({ userId: r.userId, name: r.name })} style={rowBtn}>
                    <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
                      <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</strong>
                      <span style={sub}>
                        in {timeOf(r.sinceIso)} · {r.label ?? <span style={{ color: 'var(--text-amber-800)', fontWeight: 600 }}>no job</span>}
                      </span>
                    </span>
                    <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r.elapsed}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {leftRows.length > 0 ? (
            <>
              <p style={groupLabel}>Left today · {leftRows.length}</p>
              <ul style={listStyle}>
                {leftRows.map((r) => (
                  <li key={r.userId} style={{ borderBottom: '1px solid var(--border)' }}>
                    <button type="button" data-hours-phone-left={r.userId} onClick={() => setPerson({ userId: r.userId, name: r.name })} style={rowBtn}>
                      <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
                        <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</strong>
                        <span style={sub}>
                          {timeOf(r.firstInIso)}–{timeOf(r.lastOutIso)}
                          {r.labels.length ? ` · ${r.labels.join(' · ')}` : ''}
                        </span>
                      </span>
                      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r.total}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <p style={{ margin: '0.9rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>A person’s week is one tap on their name. The week grid is under Week &amp; sessions.</p>
        </>
      ) : null}

      {view === 'approvals' ? (
        pending == null ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Reading what is waiting…</p>
        ) : waiting.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nothing is waiting on an approval.</p>
        ) : (
          <ul style={listStyle}>
            {waiting.map((p) => (
              <li key={p.userId} style={{ borderBottom: '1px solid var(--border)' }}>
                <button type="button" data-hours-phone-waiting={p.userId} onClick={() => setPerson({ userId: p.userId, name: p.name })} style={rowBtn}>
                  <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
                    <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</strong>
                    <span style={sub}>
                      {p.days} {p.days === 1 ? 'day' : 'days'} · {p.sessions} {p.sessions === 1 ? 'session' : 'sessions'} · since {shortDay(p.oldestYmd)}
                      {p.noJob > 0 ? <span style={{ color: 'var(--text-amber-800)', fontWeight: 600 }}> · {p.noJob} with no job</span> : null}
                    </span>
                  </span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatHoursShort(p.hours)}</span>
                  <span aria-hidden style={{ color: 'var(--text-muted)' }}>›</span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {person ? (
        <div role="dialog" aria-modal="true" aria-label={`${person.name} · hours`} data-hours-phone-person={person.userId} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--bg-page)', overflowY: 'auto', padding: 'calc(0.5rem + env(safe-area-inset-top, 0px)) 0.75rem calc(5rem + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.6rem' }}>
            <button type="button" onClick={() => setPerson(null)} aria-label="Back to hours" style={{ minHeight: 44, padding: '0 0.7rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontWeight: 600, cursor: 'pointer' }}>
              ‹ Back
            </button>
            <h2 style={{ flex: 1, minWidth: 0, margin: 0, fontSize: '1.0625rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.name}</h2>
          </div>
          <PersonDeskHoursSection
            userId={person.userId}
            payName={person.name}
            displayName={person.name}
            viewer={viewer}
            viewerUserId={viewerUserId}
            changeKey={changeKey}
            onChanged={() => {
              setChangeKey((k) => k + 1)
              onChanged()
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
