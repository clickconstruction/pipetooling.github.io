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
 * With `personId` the list is that person's alone and says how many wait on other files, each person a press, also
 * when this person has none (v2.8071: a file with no plan of its own used to hide the plans waiting elsewhere, and on a
 * wide screen an open file hides the list of every file). The section hides when nothing waits anywhere and nothing
 * went stale. A read that fails says so with its reason (v2.8071): a hidden list reads as nothing waiting.
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
  const [heldWhy, setHeldWhy] = useState<string | null>(null)
  const [again, setAgain] = useState(0)

  useEffect(() => {
    let live = true
    void loadKeptPlans().then((r) => {
      if (!live) return
      setRows(r.rows)
      setHeldWhy(r.heldWhy)
    })
    return () => {
      live = false
    }
  }, [reloadKey, again])

  const todayYmd = calendarYmdInAppTzFromIso(new Date().toISOString())
  const all = useMemo(() => keptPlansToShow(rows, todayYmd, calendarYmdInAppTzFromIso), [rows, todayYmd])
  const waiting = personId ? all.waiting.filter((r) => r.person_id === personId) : all.waiting
  const stale = personId ? all.stale.filter((r) => r.person_id === personId) : all.stale
  const elsewhere = personId ? all.waiting.length - waiting.length : 0
  /** The other files a plan waits on, each once, in the order their oldest plan was kept. */
  const elsewherePeople = personId ? [...new Set(all.waiting.filter((r) => r.person_id !== personId).map((r) => r.person_id))] : []

  const nameLink = { font: 'inherit', fontWeight: 600, color: 'var(--text-strong)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' } as const

  if (heldWhy) {
    return (
      <p role="alert" data-testid="hr-kept-plans-held" style={{ margin: '0 0 0.9rem', fontSize: '0.8rem', color: 'var(--text-amber-700)', maxWidth: '88ch', overflowWrap: 'anywhere' }}>
        Waiting on you could not be read: {heldWhy}{' '}
        <button type="button" onClick={() => setAgain((n) => n + 1)} style={{ ...nameLink, color: 'var(--text-link)' }}>
          Read it again
        </button>
      </p>
    )
  }

  const elsewhereLine =
    elsewhere > 0 ? (
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: waiting.length + stale.length > 0 ? '0.5rem' : 0 }} data-testid="hr-kept-plans-elsewhere">
        {waiting.length + stale.length > 0 ? `${elsewhere} more ${elsewhere === 1 ? 'waits' : 'wait'} on other files: ` : `${elsewhere} ${elsewhere === 1 ? 'plan waits' : 'plans wait'} on other files: `}
        {elsewherePeople.map((id, i) => (
          <span key={id}>
            {i > 0 ? ' · ' : ''}
            <button type="button" onClick={() => onOpenPerson(id)} style={nameLink}>
              {nameForPerson(id)}
            </button>
          </span>
        ))}
      </div>
    ) : null

  if (waiting.length === 0 && stale.length === 0) {
    if (!elsewhereLine) return null
    return (
      <section aria-label="Waiting on you" data-testid="hr-kept-plans" style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '0.6rem 0.9rem', marginBottom: '0.9rem', maxWidth: '88ch' }}>
        <strong style={{ color: 'var(--text-strong)', marginRight: '0.6rem' }}>Waiting on you</strong>
        {elsewhereLine}
      </section>
    )
  }

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
            <button type="button" onClick={() => onOpenPerson(r.person_id)} style={nameLink}>
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
      {elsewhereLine}
    </section>
  )
}
