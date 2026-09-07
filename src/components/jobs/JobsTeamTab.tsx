import { useEffect, useMemo, useRef, useState } from 'react'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { useTeamBoardWeek } from '../../hooks/useTeamBoardWeek'
import { formatBoardDay, type TeamBoardBlock } from '../../lib/teamBoard'
import { companyWeekStartSundayContaining, getDefaultWeekRange, todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'
import { TeamBoardTable } from './team/TeamBoardTable'
import { TeamExceptionsDrawer } from './team/TeamExceptionsDrawer'
import { TeamLedgerTable } from './team/TeamLedgerTable'
import { TeamSummaryStrip } from './team/TeamSummaryStrip'
import { TONE } from './team/teamBoardStyles'

type View = 'board' | 'ledger'
type Lens = 'job' | 'person'

const btn: React.CSSProperties = { padding: '0.4rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer', font: 'inherit' }
const segBtn = (on: boolean): React.CSSProperties => ({ padding: '0.4rem 0.75rem', border: 0, background: on ? 'var(--text-link)' : 'var(--surface)', color: on ? '#ffffff' : 'var(--text-700)', cursor: 'pointer', fontWeight: on ? 600 : 400, font: 'inherit' })

function Swatch({ tone, dashed }: { tone: keyof typeof TONE; dashed?: boolean }) {
  const t = TONE[tone]
  return <span style={{ display: 'inline-block', width: 13, height: 13, borderRadius: 4, verticalAlign: -2, marginRight: '0.3rem', background: dashed ? 'transparent' : t.bg, border: `1px ${dashed ? 'dashed' : 'solid'} ${t.edge}` }} />
}

/**
 * Jobs → Team (v2.2974): the in-house twin of Subs. One week of clock
 * sessions against the dispatch plan — Board (jobs × days, or people × days)
 * and Ledger (one row per person-day-job in the Subs "where it stands"
 * vocabulary), a summary strip, and the week's exceptions.
 */
export function JobsTeamTab({ focusJobId = null, onFocusConsumed }: { focusJobId?: string | null; onFocusConsumed?: () => void }) {
  const prefixMap = useLedgerPrefixMap()
  const [weekStart, setWeekStart] = useState(() => companyWeekStartSundayContaining(todayYmdInAppTz()) ?? getDefaultWeekRange().start)
  const [view, setView] = useState<View>('board')
  const [lens, setLens] = useState<Lens>('job')
  const [hideOffice, setHideOffice] = useState(false)
  const [onlyExceptions, setOnlyExceptions] = useState(false)
  const { days, board, data, loading, error } = useTeamBoardWeek(weekStart, prefixMap)

  const blocksByDayPerson = useMemo(() => {
    const m = new Map<string, TeamBoardBlock[]>()
    for (const b of data?.blocks ?? []) {
      const k = `${b.workDate}|${b.personName}`
      const list = m.get(k) ?? []
      list.push(b)
      m.set(k, list)
    }
    return m
  }, [data])

  // `?teamLaborJob=` deep link: land on the job's row, flash it, hand the param back.
  const focusKey = focusJobId ? `job:${focusJobId}` : null
  const focusHandledRef = useRef<string | null>(null)
  useEffect(() => {
    if (!focusKey || !board || loading) return
    if (focusHandledRef.current === focusKey) return
    focusHandledRef.current = focusKey
    const el = document.querySelector<HTMLElement>(`[data-team-row="${CSS.escape(focusKey)}"]`)
    if (el) {
      setLens('job')
      setView('board')
      el.scrollIntoView({ block: 'center' })
    }
    const t = setTimeout(() => onFocusConsumed?.(), 2500)
    return () => clearTimeout(t)
  }, [focusKey, board, loading, onFocusConsumed])

  const weekLabel = `${formatBoardDay(days[0]!)} – ${formatBoardDay(days[6]!)}`
  const isThisWeek = weekStart === (companyWeekStartSundayContaining(todayYmdInAppTz()) ?? '')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
        <button type="button" style={btn} aria-label="Previous week" onClick={() => setWeekStart((w) => ymdAddDays(w, -7))}>‹</button>
        <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{weekLabel}</span>
        <button type="button" style={btn} aria-label="Next week" onClick={() => setWeekStart((w) => ymdAddDays(w, 7))}>›</button>
        {!isThisWeek ? (
          <button type="button" style={{ ...btn, fontSize: '0.8125rem' }} onClick={() => setWeekStart(companyWeekStartSundayContaining(todayYmdInAppTz()) ?? getDefaultWeekRange().start)}>This week</button>
        ) : null}
        <span role="group" aria-label="View" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }}>
          <button type="button" style={segBtn(view === 'board')} aria-pressed={view === 'board'} onClick={() => setView('board')}>Board</button>
          <button type="button" style={{ ...segBtn(view === 'ledger'), borderLeft: '1px solid var(--border-strong)' }} aria-pressed={view === 'ledger'} onClick={() => setView('ledger')}>Ledger</button>
        </span>
        <select aria-label="Rows" value={lens} disabled={view !== 'board'} onChange={(e) => setLens(e.target.value as Lens)} style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit' }}>
          <option value="job">Rows: jobs</option>
          <option value="person">Rows: people</option>
        </select>
        <label style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', color: 'var(--text-700)', cursor: 'pointer' }}>
          <input type="checkbox" checked={hideOffice} onChange={(e) => setHideOffice(e.target.checked)} /> Hide Office
        </label>
        <label style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', color: 'var(--text-700)', cursor: 'pointer' }}>
          <input type="checkbox" checked={onlyExceptions} onChange={(e) => setOnlyExceptions(e.target.checked)} /> Only exceptions
        </label>
        <span style={{ flex: 1 }} />
        <div aria-label="Legend" style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--text-muted)', alignItems: 'center' }}>
          <span><Swatch tone="ok" />On plan</span>
          <span><Swatch tone="warn" />Clocked, not planned · ran long</span>
          <span><Swatch tone="miss" dashed />Planned, no clock</span>
          <span><Swatch tone="sub" />Sub sheet</span>
          <span><Swatch tone="office" />Office</span>
        </div>
      </div>

      {error ? <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p> : null}
      {loading && !board ? <p style={{ color: 'var(--text-muted)' }}>Loading the week…</p> : null}
      {board ? (
        <>
          <TeamSummaryStrip board={board} />
          {view === 'board' ? (
            <TeamBoardTable board={board} lens={lens} hideOffice={hideOffice} onlyExceptions={onlyExceptions} blocksByDayPerson={blocksByDayPerson} focusKey={focusKey} />
          ) : (
            <TeamLedgerTable board={board} hideOffice={hideOffice} onlyExceptions={onlyExceptions} />
          )}
          <TeamExceptionsDrawer board={board} />
          <p style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.8125rem', maxWidth: '72ch' }}>
            Each chip runs 6 am to midnight: the outlined band is the Schedule Dispatch block, the filled bar is the clock session. Man hours and cost per job stay on Pipeline and Job Summary.
          </p>
        </>
      ) : null}
    </div>
  )
}
