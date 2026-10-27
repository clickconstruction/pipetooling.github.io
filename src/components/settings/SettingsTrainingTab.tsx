import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth, type UserRole } from '../../hooks/useAuth'
import { ROLES } from '../../lib/userRoles'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { loadTrainingCatalog, loadTrainingStandings, loadTrainingTakenCount, saveTrainingPolicy, type TrainingStandingRow } from '../../lib/training/trainingIo'
import { ymdWords, type TrainingColour, type TrainingPolicy } from '../../lib/training/trainingState'
import { flowButton, flowHead, flowInput, flowNote, flowPrimary, flowQuiet, flowSwitch } from './flows/flowStyles'
import { formatErrorMessage } from '../../utils/errorHandling'

/**
 * Settings → Training (punch list #111, v2.5569): a dev's view of every course the app ships, each with its
 * policy and its counts. On or off; who must take it (role chips); how long a pass is good for and the amber
 * window; where everyone stands (`training_standings`: current, lapsed, not done, and See who); and
 * **Everyone takes it again…**, which stamps today as the day before which no pass counts, after a confirm that
 * says how many current people it turns red. The lessons live in the app: the bundle's facts (lessons, minutes)
 * come from a dynamic import so the course text never rides in the Settings chunk.
 *
 * v2.5577: **Preview the course** opens `/training/<slug>` as the dev sees it (a course previews while off); the
 * retake day is an amber chip with a quiet **Clear** that puts the old passes back to counting; the content hash
 * left the facts line (it is on every pass record, where a dev reads it).
 *
 * v2.5610 (punch list #119): **Also open to · Everyone** on each course is the offered state: a role not in
 * Required for may take it with no colour and no clock, and the row says how many took it.
 */

const ROLE_WORDS: Record<UserRole, string> = {
  dev: 'Devs',
  master_technician: 'Masters',
  assistant: 'Assistants',
  controller: 'Controllers',
  superintendent: 'Superintendents',
  estimator: 'Estimators',
  primary: 'Primaries',
  helpers: 'Helpers',
  subcontractor: 'Subcontractors',
}

const CHIP: Record<TrainingColour, CSSProperties> = {
  red: { background: 'var(--bg-red-100)', color: 'var(--text-red-700)' },
  amber: { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' },
  green: { background: 'var(--bg-green-100)', color: 'var(--text-green-800)' },
}

type BundleFacts = { lessons: number; minutes: number }

/** Settings → Training's lede, rendered before the catalog loads. */
export const TRAINING_LEDE =
  'Every course the app ships, with its policy. A course is off until you turn it on. The lessons are in the app; this page says who must take them and how long a pass is good for.'

export function SettingsTrainingTab() {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const confirm = useConfirmDialog()
  const [policies, setPolicies] = useState<TrainingPolicy[] | null>(null)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bundle, setBundle] = useState<Record<string, BundleFacts>>({})
  const [standings, setStandings] = useState<Record<string, TrainingStandingRow[]>>({})
  const [taken, setTaken] = useState<Record<string, number>>({})
  const [seeWho, setSeeWho] = useState<string | null>(null)
  const [numbers, setNumbers] = useState<Record<string, { months: string; days: string }>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const today = todayYmdInAppTz()

  const load = useCallback(async () => {
    try {
      const catalog = await loadTrainingCatalog()
      setMissing(catalog.missing)
      setPolicies(catalog.policies)
      const next: Record<string, { months: string; days: string }> = {}
      for (const p of catalog.policies) next[p.slug] = { months: String(p.goodForMonths), days: String(p.dueSoonDays) }
      setNumbers(next)
      const rows: Record<string, TrainingStandingRow[]> = {}
      for (const p of catalog.policies) rows[p.slug] = p.on ? (await loadTrainingStandings(p.slug)).rows : []
      setStandings(rows)
      const took: Record<string, number> = {}
      for (const p of catalog.policies) if (p.on && p.offered) took[p.slug] = await loadTrainingTakenCount(p.slug)
      setTaken(took)
    } catch (e) {
      setError(formatErrorMessage(e, 'Could not read the courses'))
    }
  }, [])

  useEffect(() => {
    void load()
    // The bundle's facts, without the lessons riding in this chunk.
    void import('../../lib/training/courseRegistry')
      .then((m) => {
        const facts: Record<string, BundleFacts> = {}
        for (const c of m.TRAINING_COURSES) facts[c.slug] = { lessons: c.lessons.length, minutes: c.minutes }
        setBundle(facts)
      })
      .catch(() => setBundle({}))
  }, [load])

  const save = useCallback(
    async (slug: string, patch: Parameters<typeof saveTrainingPolicy>[1], said: string) => {
      if (!user?.id) return
      setSaving(slug)
      try {
        await saveTrainingPolicy(slug, patch, user.id)
        showToast(said, 'success')
        await load()
      } catch (e) {
        showToast(formatErrorMessage(e, 'Could not save'), 'error')
      } finally {
        setSaving(null)
      }
    },
    [user?.id, showToast, load],
  )

  const counts = useMemo(() => {
    const out: Record<string, { current: number; lapsed: number; notDone: number }> = {}
    for (const [slug, rows] of Object.entries(standings)) {
      out[slug] = {
        current: rows.filter((r) => r.colour === 'green').length,
        lapsed: rows.filter((r) => r.colour === 'amber').length,
        notDone: rows.filter((r) => r.colour === 'red').length,
      }
    }
    return out
  }, [standings])

  if (error) return <p style={{ color: 'var(--text-red-700)' }}>{error}</p>
  if (!policies) return <p style={flowNote}>{TRAINING_LEDE}</p>
  if (missing) return <p style={flowNote}>Training is not switched on yet. Its tables arrive with the next update.</p>

  return (
    <div style={{ display: 'grid', gap: '1rem' }} data-settings-training>
      <p style={flowNote}>{TRAINING_LEDE}</p>
      {policies.length === 0 && <p style={flowNote}>No course yet. A dev adds a course by adding its lessons to the app; it shows here, switched off.</p>}
      {policies.map((p) => {
        const facts = bundle[p.slug]
        const c = counts[p.slug] ?? { current: 0, lapsed: 0, notDone: 0 }
        const rows = standings[p.slug] ?? []
        const n = numbers[p.slug] ?? { months: String(p.goodForMonths), days: String(p.dueSoonDays) }
        const busy = saving === p.slug
        const numbersChanged = n.months !== String(p.goodForMonths) || n.days !== String(p.dueSoonDays)
        const monthsOk = /^\d{1,3}$/.test(n.months) && Number(n.months) <= 120
        const daysOk = /^\d{1,3}$/.test(n.days) && Number(n.days) <= 365
        return (
          <section key={p.slug} data-training-policy={p.slug} style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.85rem 1rem 1rem', display: 'grid', gap: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>{p.title}</h3>
              <button
                type="button"
                onClick={() => void save(p.slug, { enabled: !p.on }, p.on ? `${p.title} is off.` : `${p.title} is on.`)}
                disabled={busy}
                aria-pressed={p.on}
                style={flowSwitch(p.on, busy)}
                data-training-switch
              >
                {p.on ? 'On' : 'Off'}
              </button>
              <span style={flowNote}>
                {facts ? `${facts.lessons} lessons and a final check · about ${Math.round(facts.minutes / 60)} h · ships with the app` : 'ships with the app'}
              </span>
              <Link to={`/training/${p.slug}`} style={{ fontSize: '0.85rem', fontWeight: 600 }} data-training-preview>
                Preview the course
              </Link>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ ...flowHead, width: 110 }}>Required for</span>
              {ROLES.map((r) => {
                const on = p.requiredRoles.includes(r)
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      const next = on ? p.requiredRoles.filter((x) => x !== r) : [...p.requiredRoles, r]
                      void save(p.slug, { required_roles: next }, on ? `${ROLE_WORDS[r]} no longer must take ${p.title}.` : `${ROLE_WORDS[r]} must take ${p.title}.`)
                    }}
                    disabled={busy}
                    aria-pressed={on}
                    data-training-role={r}
                    style={{
                      ...flowButton,
                      borderRadius: 999,
                      padding: '0.1rem 0.6rem',
                      fontSize: '0.8rem',
                      background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
                      borderColor: on ? 'var(--border-blue)' : 'var(--border)',
                      color: on ? 'var(--text-blue-700)' : 'var(--text-base)',
                      fontWeight: on ? 600 : 400,
                    }}
                  >
                    {on ? '✓ ' : ''}
                    {ROLE_WORDS[r]}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ ...flowHead, width: 110 }}>Also open to</span>
              <button
                type="button"
                onClick={() => void save(p.slug, { offered: !p.offered }, p.offered ? `${p.title} is for the required roles only.` : `${p.title} is open to everyone.`)}
                disabled={busy}
                aria-pressed={p.offered}
                data-training-offered
                style={{
                  ...flowButton,
                  borderRadius: 999,
                  padding: '0.1rem 0.6rem',
                  fontSize: '0.8rem',
                  background: p.offered ? 'var(--bg-blue-tint)' : 'var(--surface)',
                  borderColor: p.offered ? 'var(--border-blue)' : 'var(--border)',
                  color: p.offered ? 'var(--text-blue-700)' : 'var(--text-base)',
                  fontWeight: p.offered ? 600 : 400,
                }}
              >
                {p.offered ? '✓ ' : ''}
                Everyone
              </button>
              <span style={flowNote}>
                {p.offered
                  ? `Any role may take it, with no colour and no clock.${p.on ? ` ${taken[p.slug] ?? 0} took it.` : ''}`
                  : 'Off: only the required roles see it.'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ ...flowHead, width: 110 }}>Good for</span>
              <input
                id={`training-months-${p.slug}`}
                aria-label="Months a pass is good for"
                value={n.months}
                onChange={(e) => setNumbers((prev) => ({ ...prev, [p.slug]: { ...n, months: e.target.value } }))}
                style={{ ...flowInput, width: 56, textAlign: 'right' }}
                inputMode="numeric"
              />
              <span>months · amber from</span>
              <input
                id={`training-days-${p.slug}`}
                aria-label="Days before the day it turns amber"
                value={n.days}
                onChange={(e) => setNumbers((prev) => ({ ...prev, [p.slug]: { ...n, days: e.target.value } }))}
                style={{ ...flowInput, width: 56, textAlign: 'right' }}
                inputMode="numeric"
              />
              <span>days before the day</span>
              {numbersChanged && (
                <button
                  type="button"
                  disabled={busy || !monthsOk || !daysOk}
                  onClick={() => void save(p.slug, { good_for_months: Number(n.months), due_soon_days: Number(n.days) }, `${p.title}: a pass is good for ${n.months} months.`)}
                  style={{ ...flowPrimary, padding: '0.2rem 0.7rem', fontSize: '0.8rem' }}
                >
                  Save
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ ...flowHead, width: 110 }}>Where everyone stands</span>
              {p.on ? (
                <>
                  <span style={{ ...CHIP.green, borderRadius: 999, padding: '0.1rem 0.6rem', fontSize: '0.78rem', fontWeight: 600 }} data-count="current">
                    {c.current} current
                  </span>
                  <span style={{ ...CHIP.amber, borderRadius: 999, padding: '0.1rem 0.6rem', fontSize: '0.78rem', fontWeight: 600 }} data-count="lapsed">
                    {c.lapsed} lapsed
                  </span>
                  <span style={{ ...CHIP.red, borderRadius: 999, padding: '0.1rem 0.6rem', fontSize: '0.78rem', fontWeight: 600 }} data-count="notDone">
                    {c.notDone} not done
                  </span>
                  {rows.length > 0 && (
                    <button type="button" onClick={() => setSeeWho((s) => (s === p.slug ? null : p.slug))} style={flowQuiet}>
                      {seeWho === p.slug ? 'Hide who' : 'See who'}
                    </button>
                  )}
                </>
              ) : (
                <span style={flowNote}>Off: nobody is counted until it is on.</span>
              )}
            </div>
            {seeWho === p.slug && rows.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: '1.1rem', columns: 2, fontSize: '0.85rem' }} data-training-who>
                {rows.map((r) => (
                  <li key={r.user_id} style={{ breakInside: 'avoid' }}>
                    {r.name ?? 'Someone'}{' '}
                    <span style={{ ...CHIP[r.colour], borderRadius: 999, padding: '0 0.45rem', fontSize: '0.72rem', fontWeight: 600 }}>
                      {r.colour === 'green' ? `done ${r.passed_on ? ymdWords(r.passed_on, today) : ''}` : r.colour === 'amber' ? `due ${r.due_on ? ymdWords(r.due_on, today) : ''}` : 'not done'}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {p.retakeFrom && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }} data-training-retake-chip>
                <span style={{ ...CHIP.amber, borderRadius: 999, padding: '0.1rem 0.6rem', fontSize: '0.78rem', fontWeight: 600 }}>
                  Everyone takes it again from {ymdWords(p.retakeFrom, today)}
                </span>
                <button type="button" disabled={busy} onClick={() => void save(p.slug, { retake_from: null }, `${p.title}: the old passes count again.`)} style={flowQuiet} data-training-retake-clear>
                  Clear
                </button>
                <span style={flowNote}>Passes before that day do not count. Clear puts them back.</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', paddingTop: '0.25rem' }}>
              <button
                type="button"
                disabled={busy || !p.on}
                data-training-retake
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Everyone takes it again?',
                    message: `Today becomes the day before which no pass of ${p.title} counts. ${c.current} current ${c.current === 1 ? 'person turns' : 'people turn'} red until they pass it again. The old passes stay on record.`,
                    confirmLabel: 'Everyone takes it again',
                    cancelLabel: 'Not now',
                    danger: true,
                  })
                  if (ok) void save(p.slug, { retake_from: today }, `${p.title}: everyone takes it again from today.`)
                }}
                style={{ ...flowButton, color: 'var(--text-red-700)' }}
              >
                Everyone takes it again…
              </button>
              <span style={flowNote}>A changed lesson never voids a pass. This press is the one thing that does.</span>
            </div>
          </section>
        )
      })}
    </div>
  )
}
