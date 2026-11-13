import { useEffect, useMemo, useState } from 'react'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { KEPT_PLAN_AMBER_DAYS, daysBetweenYmd, keptByWords, keptPlanAgeWords, keptPlanSubject, keptPlansHeadWords, keptPlansToShow, type KeptPlanRow } from '../../lib/people/keptPlans'
import { loadKeptPlans } from '../../lib/people/keptPlansIo'

const capital = (words: string): string => words.charAt(0).toUpperCase() + words.slice(1)

/**
 * People → HR → "Waiting on you" (punch list #315, upgrade 3a): the plans an agent kept on a person's HR file for a
 * yes, oldest first, as words. A plan that went stale this week is listed under them with why, so nobody looks for a
 * plan that is gone.
 *
 * Words only. There is no Apply press here: who may press one in the app is the owner's call, so a kept plan is
 * applied in a session on his word, as every plan is today, and the session checks it again first. The list reads the
 * words of a plan and never its arguments.
 *
 * With `personId` the list is that person's alone and says how many wait on other files. The whole section hides when
 * nothing waits and nothing went stale, and when the read is refused (before the table's migration is pushed).
 */
export function HrKeptPlansSection({
  nameForPerson,
  onOpenPerson,
  personId = null,
  reloadKey = 0,
}: {
  nameForPerson: (personId: string) => string
  onOpenPerson: (personId: string) => void
  /** Narrow the list to one person's file. */
  personId?: string | null
  /** Bump to read the list again. */
  reloadKey?: number
}) {
  const [rows, setRows] = useState<KeptPlanRow[]>([])

  useEffect(() => {
    let live = true
    void loadKeptPlans().then((r) => {
      if (live) setRows(r.rows)
    })
    return () => {
      live = false
    }
  }, [reloadKey])

  const todayYmd = calendarYmdInAppTzFromIso(new Date().toISOString())
  const all = useMemo(() => keptPlansToShow(rows, todayYmd, calendarYmdInAppTzFromIso), [rows, todayYmd])
  const waiting = personId ? all.waiting.filter((r) => r.person_id === personId) : all.waiting
  const stale = personId ? all.stale.filter((r) => r.person_id === personId) : all.stale
  const elsewhere = personId ? all.waiting.length - waiting.length : 0

  if (waiting.length === 0 && stale.length === 0) return null

  const chip = (amber: boolean) => ({
    display: 'inline-block',
    padding: '0.1rem 0.55rem',
    borderRadius: 999,
    fontSize: '0.72rem',
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
    background: amber ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)',
    color: amber ? 'var(--text-amber-800)' : 'var(--text-muted)',
  })

  const row = (r: KeptPlanRow) => {
    const keptYmd = calendarYmdInAppTzFromIso(r.kept_at)
    const isStale = r.state === 'stale'
    return (
      <li key={r.id} data-testid={`kept-plan-${r.id}`} style={{ border: '1px solid var(--border)', borderRadius: 9, padding: '0.6rem 0.75rem', background: 'var(--surface)', minWidth: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.5rem', alignItems: 'baseline' }}>
          {personId ? null : (
            <button type="button" onClick={() => onOpenPerson(r.person_id)} style={{ font: 'inherit', fontWeight: 600, color: 'var(--text-strong)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}>
              {nameForPerson(r.person_id)}
            </button>
          )}
          <span style={{ fontWeight: 600, color: 'var(--text-base)' }}>{personId ? capital(keptPlanSubject(r.verb)) : keptPlanSubject(r.verb)}</span>
          <span style={chip(isStale || daysBetweenYmd(keptYmd, todayYmd) >= KEPT_PLAN_AMBER_DAYS)}>{isStale ? 'no longer matches' : keptPlanAgeWords(keptYmd, todayYmd)}</span>
        </div>
        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{keptByWords(r, keptYmd)}</div>
        <p style={{ margin: '0.4rem 0 0', fontSize: '0.84rem', color: 'var(--text-base)', background: 'var(--bg-subtle)', borderRadius: 7, padding: '0.4rem 0.55rem', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.words}</p>
        {isStale && r.decided_why ? <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem', overflowWrap: 'anywhere' }}>{r.decided_why} The agent plans again.</div> : null}
      </li>
    )
  }

  return (
    <section aria-label="Waiting on you" data-testid="hr-kept-plans" style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '0.75rem 0.9rem', marginBottom: '0.9rem', maxWidth: '88ch' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.75rem', alignItems: 'baseline', marginBottom: '0.5rem' }}>
        <strong style={{ color: 'var(--text-strong)' }}>{keptPlansHeadWords(waiting.length)}</strong>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Plans an agent kept for a yes, oldest first. Say yes in a session and the agent applies it. It is checked again first.
        </span>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.5rem' }}>
        {waiting.map(row)}
        {stale.map(row)}
      </ul>
      {elsewhere > 0 ? (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem' }} data-testid="hr-kept-plans-elsewhere">
          {elsewhere} more {elsewhere === 1 ? 'waits' : 'wait'} on other files.
        </div>
      ) : null}
    </section>
  )
}
