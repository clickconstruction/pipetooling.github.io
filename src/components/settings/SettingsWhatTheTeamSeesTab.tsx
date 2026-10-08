import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth, type UserRole } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { APP_CALENDAR_TZ, todayYmdInAppTz } from '../../utils/dateUtils'
import { humanRoleLabel } from '../../lib/roleLabels'
import {
  TEAM_EMAILS,
  TEAM_EMAIL_FROM_LABEL,
  TEAM_EMAIL_WHEN_LABELS,
  groupTeamEmailsByWhen,
  teamCoverageLine,
  teamEmailCoverage,
  teamEmailsForPerson,
  teamEmailsForRole,
  type TeamEmail,
  type TeamRealPreviewStream,
  type TeamRecipientLists,
  type TeamSampleContext as TeamSubjectContext,
} from '../../lib/teamEmails'
import { buildTeamSampleEmail, type BuiltTeamEmail, type TeamEmailTemplateRow, type TeamSampleContext } from '../../lib/teamSampleEmails'
import { APP_SETTINGS_KEY_PAID_JOB_EMAIL_RECIPIENTS, APP_SETTINGS_KEY_PORTAL_REQUEST_EMAIL_RECIPIENTS, APP_SETTINGS_KEY_READY_TO_BILL_NOTIFY_RECIPIENTS_V2, APP_SETTINGS_KEY_SIGNED_AGREEMENTS_NOTIFY_RECIPIENTS } from '../../lib/appSettingsKeys'
import { parsePaidJobEmailRecipients } from '../../lib/paidJobEmail'
import { parseReadyToBillRecipientPrefs } from '../../lib/readyToBillNotify'
import { parseSignedAgreementRecipients } from '../../lib/signedAgreementsStream'
import { fetchCrewDayPreview, sendCrewDayTest } from '../../lib/crewDayEmailClient'
import { fetchMoneyWaitingPreview, sendMoneyWaitingTest } from '../../lib/moneyWaitingEmailClient'
import { fetchPaymentForecastPreview, sendPaymentForecastTest } from '../../lib/paymentForecastEmailClient'
import { fetchBilledReportPreview, sendBilledReportTest } from '../../lib/billedReportEmailClient'

/**
 * Settings → What the team sees (v2.4142, punch list #60, dev-only): every email the app sends
 * someone on the team as one person's week — when it lands, who gets it, the From, the subject
 * with sample values, and the email itself where the app can build one. Reads only; the doors
 * to change recipients or wording lead to Emails & reports and Email templates.
 */

type TeamUser = { id: string; name: string; role: UserRole; email: string }
type View = 'week' | 'email'

const ROLE_CHIPS: readonly UserRole[] = ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'helpers', 'subcontractor']

const CARD: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '0.75rem 1rem', marginBottom: '0.75rem' }
const MUTED: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const PILL: CSSProperties = { font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.65rem', border: '1px solid var(--border)', borderRadius: 999, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }
const PILL_ON: CSSProperties = { ...PILL, background: 'var(--bg-blue-50)', borderColor: 'var(--border-blue)', color: 'var(--text-blue-700)' }
const CHIP: CSSProperties = { fontSize: '0.7rem', padding: '0.05rem 0.5rem', border: '1px solid var(--border)', borderRadius: 999, color: 'var(--text-700)', background: 'var(--surface)' }
const STATUS: Record<TeamEmail['render']['kind'], { label: string; style: CSSProperties }> = {
  sample: { label: 'renders live', style: { ...CHIP, background: 'var(--bg-green-50)', borderColor: 'var(--border-green)', color: 'var(--text-green-700)', fontFamily: 'ui-monospace, Menlo, monospace' } },
  real: { label: 'shows the real one', style: { ...CHIP, background: 'var(--bg-amber-50)', borderColor: 'var(--border-amber)', color: 'var(--text-amber-700)', fontFamily: 'ui-monospace, Menlo, monospace' } },
  soon: { label: 'next release', style: { ...CHIP, borderStyle: 'dashed', color: 'var(--text-muted)', fontFamily: 'ui-monospace, Menlo, monospace' } },
}

const REAL: Record<TeamRealPreviewStream, { preview: () => Promise<string>; test: () => Promise<void> }> = {
  crew_day: { preview: fetchCrewDayPreview, test: sendCrewDayTest },
  money_waiting: { preview: fetchMoneyWaitingPreview, test: sendMoneyWaitingTest },
  payment_forecast: { preview: fetchPaymentForecastPreview, test: sendPaymentForecastTest },
  billed_awaiting: { preview: fetchBilledReportPreview, test: sendBilledReportTest },
}

/** The digest stream a row can show for real: its own `real` beside a sample, or its render when it is only that. */
function realStreamOf(row: TeamEmail): TeamRealPreviewStream | null {
  return row.real ?? (row.render.kind === 'real' ? row.render.stream : null)
}

/** "Sep 21" — the Monday of the week that holds `ymd`, as the weekly emails print it. */
export function weekStartLabel(ymd: string): string {
  return weekEdgeLabel(ymd, 0)
}

/** "Sep 27" — that week's Sunday. */
export function weekEndLabel(ymd: string): string {
  return weekEdgeLabel(ymd, 6)
}

function weekEdgeLabel(ymd: string, offset: number): string {
  const [y = 1970, m = 1, d = 1] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dow = date.getUTCDay() // 0 = Sunday
  date.setUTCDate(date.getUTCDate() - ((dow + 6) % 7) + offset)
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(date)
}

/** A sample recipient for a role, when no real person is picked. */
export function sampleRecipientFor(role: UserRole): { name: string; email: string; role: string } {
  return { name: `${humanRoleLabel(role)} Sample`, email: `${role.replace(/_/g, '.')}@example.com`, role: humanRoleLabel(role).toLowerCase() }
}

export function SettingsWhatTheTeamSeesTab() {
  const { user, role: myRole, profileName } = useAuth()
  const { showToast } = useToastContext()
  const [role, setRole] = useState<UserRole>('controller')
  const [person, setPerson] = useState<TeamUser | null>(null)
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<TeamUser[]>([])
  const [templates, setTemplates] = useState<TeamEmailTemplateRow[]>([])
  const [lists, setLists] = useState<TeamRecipientLists>({})
  const [view, setView] = useState<View>('week')
  const [onlySoon, setOnlySoon] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [real, setReal] = useState<Record<string, { html: string } | { error: string } | 'loading'>>({})
  const [sending, setSending] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [usersRes, templatesRes, settingsRes, scheduleRes] = await Promise.all([
        withSupabaseRetry(() => supabase.from('users').select('id, name, role, email').is('archived_at', null).order('name'), 'what-the-team-sees users'),
        withSupabaseRetry(() => supabase.from('email_templates').select('template_type, subject, body'), 'what-the-team-sees templates'),
        withSupabaseRetry(
          () =>
            supabase
              .from('app_settings')
              .select('key, value_text')
              .in('key', [APP_SETTINGS_KEY_PAID_JOB_EMAIL_RECIPIENTS, APP_SETTINGS_KEY_READY_TO_BILL_NOTIFY_RECIPIENTS_V2, APP_SETTINGS_KEY_SIGNED_AGREEMENTS_NOTIFY_RECIPIENTS, APP_SETTINGS_KEY_PORTAL_REQUEST_EMAIL_RECIPIENTS]),
          'what-the-team-sees recipient lists',
        ),
        supabase.rpc('get_global_email_schedule').then((r) => r, () => ({ data: null, error: new Error('unavailable') })),
      ])
      if (cancelled) return
      setUsers(((usersRes ?? []) as Array<{ id: string; name: string | null; role: string | null; email: string | null }>).map((u) => ({ id: u.id, name: u.name ?? '', role: (u.role ?? 'helpers') as UserRole, email: u.email ?? '' })))
      setTemplates(((templatesRes ?? []) as Array<{ template_type: string; subject: string | null; body: string | null }>).map((t) => ({ template_type: t.template_type, subject: t.subject ?? '', body: t.body ?? '' })))
      const byKey = new Map(((settingsRes ?? []) as Array<{ key: string; value_text: string | null }>).map((r) => [r.key, r.value_text]))
      const schedule = (scheduleRes as { data: unknown }).data as { report_schedules?: Array<{ recipients?: Array<{ user_id: string }> }> } | null
      const next: TeamRecipientLists = {
        paid_job: byKey.has(APP_SETTINGS_KEY_PAID_JOB_EMAIL_RECIPIENTS) ? parsePaidJobEmailRecipients(byKey.get(APP_SETTINGS_KEY_PAID_JOB_EMAIL_RECIPIENTS)) : null,
        ready_to_bill: byKey.has(APP_SETTINGS_KEY_READY_TO_BILL_NOTIFY_RECIPIENTS_V2) ? parseReadyToBillRecipientPrefs(byKey.get(APP_SETTINGS_KEY_READY_TO_BILL_NOTIFY_RECIPIENTS_V2)).filter((p) => p.email).map((p) => p.id) : null,
        signed_agreements: byKey.has(APP_SETTINGS_KEY_SIGNED_AGREEMENTS_NOTIFY_RECIPIENTS) ? parseSignedAgreementRecipients(byKey.get(APP_SETTINGS_KEY_SIGNED_AGREEMENTS_NOTIFY_RECIPIENTS)) : null,
        portal_requests: byKey.has(APP_SETTINGS_KEY_PORTAL_REQUEST_EMAIL_RECIPIENTS) ? parseSignedAgreementRecipients(byKey.get(APP_SETTINGS_KEY_PORTAL_REQUEST_EMAIL_RECIPIENTS)) : null,
        recurring_job_report: schedule?.report_schedules ? schedule.report_schedules.flatMap((s) => (s.recipients ?? []).map((r) => r.user_id)) : null,
      }
      setLists(next)
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [reloadNonce])

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const todayYmd = todayYmdInAppTz()
  const dateLabel = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric', year: 'numeric' }).format(new Date())
  const recipient = person ? { name: person.name, email: person.email, role: humanRoleLabel(person.role).toLowerCase() } : sampleRecipientFor(role)
  const subjectCtx: TeamSubjectContext = { todayYmd, dateLabel, weekStartLabel: weekStartLabel(todayYmd), weekEndLabel: weekEndLabel(todayYmd), firstName: recipient.name.split(' ')[0] || 'Sam' }
  const sampleCtx: TeamSampleContext = useMemo(
    () => ({
      rows: [],
      origin,
      todayYmd,
      dateLabel,
      sender: user?.email ? { name: profileName?.trim() || '', email: user.email, phone: '' } : null,
      templates,
      recipient,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [origin, todayYmd, dateLabel, user?.email, profileName, templates, recipient.name, recipient.email, recipient.role],
  )

  const rowsAll = person ? teamEmailsForPerson({ id: person.id, role: person.role }, lists) : teamEmailsForRole(role)
  const rows = onlySoon ? rowsAll.filter((r) => r.render.kind === 'soon') : rowsAll
  const groups = view === 'week' ? groupTeamEmailsByWhen(rows) : [{ kind: 'once' as const, rows: [...rows].sort((a, b) => a.label.localeCompare(b.label)) }]
  const selected = rows.find((r) => r.id === selectedId) ?? null
  const matches = query.trim() ? users.filter((u) => u.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8) : []

  const built: BuiltTeamEmail | null = useMemo(() => {
    if (!selected || selected.render.kind !== 'sample') return null
    try {
      return buildTeamSampleEmail(selected.render.sample, sampleCtx)
    } catch {
      return null
    }
  }, [selected, sampleCtx])

  const showReal = async (row: TeamEmail) => {
    const stream = realStreamOf(row)
    if (!stream) return
    setReal((m) => ({ ...m, [row.id]: 'loading' }))
    try {
      const html = await REAL[stream].preview()
      setReal((m) => ({ ...m, [row.id]: { html } }))
    } catch (e) {
      setReal((m) => ({ ...m, [row.id]: { error: e instanceof Error ? e.message : String(e) } }))
    }
  }
  const emailMe = async (row: TeamEmail) => {
    const stream = realStreamOf(row)
    if (!stream) return
    setSending(row.id)
    try {
      await REAL[stream].test()
      showToast(`Sent — the real ${row.label} is on its way to ${user?.email ?? 'you'}.`, 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'The send failed.', 'error')
    } finally {
      setSending(null)
    }
  }

  return (
    <div data-testid="wtts-root">
      <div style={{ ...CARD, display: 'flex', flexWrap: 'wrap', gap: '0.5rem 0.9rem', alignItems: 'center' }} data-testid="wtts-mode">
        <span style={{ ...MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.68rem' }}>Whose week</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }} role="radiogroup" aria-label="Role">
          {ROLE_CHIPS.map((r) => (
            <button key={r} type="button" role="radio" aria-checked={!person && role === r} style={!person && role === r ? PILL_ON : PILL} onClick={() => { setPerson(null); setRole(r); setSelectedId(null) }}>
              {humanRoleLabel(r)}
            </button>
          ))}
        </div>
        <span style={MUTED}>or</span>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 0 }}>
          <input
            id="wtts-person-search"
            type="text"
            value={person ? person.name : query}
            placeholder="A person: type a name…"
            aria-label="A person"
            onChange={(e) => { setPerson(null); setQuery(e.target.value) }}
            onFocus={() => { if (person) { setQuery(''); setPerson(null) } }}
            style={{ width: '100%', font: 'inherit', fontSize: '0.85rem', padding: '0.3rem 0.6rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)' }}
          />
          {matches.length > 0 && !person ? (
            <ul role="listbox" style={{ position: 'absolute', zIndex: 5, left: 0, right: 0, top: '100%', margin: 0, padding: '0.25rem 0', listStyle: 'none', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}>
              {matches.map((u) => (
                <li key={u.id}>
                  <button type="button" role="option" aria-selected={false} onClick={() => { setPerson(u); setQuery(''); setSelectedId(null) }} style={{ width: '100%', textAlign: 'left', font: 'inherit', fontSize: '0.85rem', padding: '0.3rem 0.6rem', background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--text)' }}>
                    {u.name} <span style={MUTED}>· {humanRoleLabel(u.role)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {person ? (
          <button type="button" style={PILL} onClick={() => { setPerson(null); setSelectedId(null) }}>
            Back to the sample
          </button>
        ) : null}
      </div>

      <div style={{ ...CARD, display: 'flex', flexWrap: 'wrap', gap: '0.5rem 0.9rem', alignItems: 'center' }}>
        <span style={{ ...MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.68rem' }}>Show</span>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          <button type="button" style={view === 'week' ? PILL_ON : PILL} onClick={() => setView('week')}>Their week</button>
          <button type="button" style={view === 'email' ? PILL_ON : PILL} onClick={() => setView('email')}>By the email</button>
        </div>
        {rowsAll.some((r) => r.render.kind === 'soon') ? (
          <button type="button" style={onlySoon ? PILL_ON : { ...PILL, borderStyle: 'dashed' }} onClick={() => setOnlySoon((v) => !v)} aria-pressed={onlySoon}>
            Only what doesn't render yet
          </button>
        ) : null}
        <span style={MUTED}>
          {person ? (
            <>
              <strong style={{ color: 'var(--text-strong)' }}>{person.name}</strong> · {humanRoleLabel(person.role)} — {rowsAll.length} of {TEAM_EMAILS.length} emails reach them{loaded ? '' : ' (reading the recipient lists…)'}
            </>
          ) : (
            <>
              Sample data: a <strong style={{ color: 'var(--text-strong)' }}>{humanRoleLabel(role)}</strong>’s week — {rowsAll.length} of {TEAM_EMAILS.length} emails. Nothing here exists in the database.
            </>
          )}
        </span>
        <button type="button" style={{ ...PILL, marginLeft: 'auto' }} onClick={() => { setReal({}); setReloadNonce((n) => n + 1) }} title="Re-read the templates and the recipient lists">
          Refresh all
        </button>
      </div>

      <div style={{ ...CARD, padding: '0.55rem 1rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.9rem', alignItems: 'center', fontSize: '0.82rem' }} data-testid="wtts-coverage">
        <strong style={{ color: 'var(--text-strong)', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.78rem' }}>{teamCoverageLine(teamEmailCoverage(TEAM_EMAILS))}</strong>
        <span style={MUTED}>Every email the app sends someone on the team has a row here — a test checks it against the outbound catalog on every change. <em>Next release</em> rows name the function that builds them.</span>
      </div>

      {groups.length === 0 ? <div style={{ ...CARD, ...MUTED }}>Nothing to show for this pick.</div> : null}
      {groups.map((g) => (
        <section key={g.kind} style={{ marginBottom: '0.9rem' }} aria-label={view === 'week' ? TEAM_EMAIL_WHEN_LABELS[g.kind].title : 'By the email'}>
          {view === 'week' ? (
            <h3 style={{ margin: '0 0 0.4rem', fontSize: '0.72rem', fontFamily: 'ui-monospace, Menlo, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
              {TEAM_EMAIL_WHEN_LABELS[g.kind].title} <span style={{ fontFamily: 'inherit', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>· {g.rows.length} · {TEAM_EMAIL_WHEN_LABELS[g.kind].subtitle}</span>
            </h3>
          ) : null}
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            {g.rows.map((row) => {
              const isSel = selectedId === row.id
              const status = STATUS[row.render.kind]
              return (
                <div key={row.id} data-testid={`wtts-row-${row.id}`}>
                  <div
                    style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.3rem 0.75rem', alignItems: 'start', padding: '0.5rem 0.75rem', border: `1px solid ${isSel ? 'var(--border-blue)' : 'var(--border)'}`, borderRadius: 8, background: 'var(--surface)', boxShadow: isSel ? '0 0 0 2px var(--bg-blue-50)' : 'none' }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <button type="button" onClick={() => setSelectedId(isSel ? null : row.id)} style={{ font: 'inherit', background: 'transparent', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left', color: 'var(--text-strong)', fontWeight: 600, fontSize: '0.9rem' }} aria-expanded={isSel}>
                        {row.label}
                      </button>
                      <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.78rem', color: 'var(--text)', overflowWrap: 'anywhere' }}>{row.sampleSubject(subjectCtx)}</div>
                      <div style={MUTED}>
                        {row.when.label} · From {TEAM_EMAIL_FROM_LABEL}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center', marginTop: '0.25rem' }}>
                        {row.recipients.roles.map((r) => (
                          <span key={r} style={r === (person?.role ?? role) ? { ...CHIP, background: 'var(--bg-blue-50)', borderColor: 'var(--border-blue)', color: 'var(--text-blue-700)' } : CHIP}>{humanRoleLabel(r)}</span>
                        ))}
                        {row.recipients.decidedBy === 'setting' ? <span style={{ ...CHIP, borderStyle: 'dashed', color: 'var(--text-muted)' }}>a list on Settings decides</span> : null}
                        <Link to={`/settings?tab=${row.manage.tabId}${row.manage.anchorId ? `#${row.manage.anchorId}` : ''}`} style={{ ...CHIP, textDecoration: 'none', borderStyle: 'dashed', color: 'var(--text-blue-700)' }}>
                          Change who gets it →
                        </Link>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-end' }}>
                      <span style={status.style}>{status.label}</span>
                      {realStreamOf(row) ? (
                        <button type="button" style={PILL} disabled={sending === row.id} onClick={() => emailMe(row)}>
                          {sending === row.id ? 'Sending…' : 'Email me the real one'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {isSel ? (
                    <div style={{ border: '1px solid var(--border-blue)', borderTop: 0, borderRadius: '0 0 8px 8px', padding: '0.6rem 0.75rem', background: 'var(--surface)', marginTop: '-1px' }} data-testid="wtts-expanded">
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.4rem 1rem', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                        <div><span style={{ ...MUTED, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.66rem' }}>Who gets it</span>{row.recipients.rule}</div>
                        <div><span style={{ ...MUTED, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.66rem' }}>Reflects</span>{row.reflects.length ? row.reflects.join(' · ') : 'nothing on Settings — the words are the sender’s own'}</div>
                        <div><span style={{ ...MUTED, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.66rem' }}>Change it</span><Link to={`/settings?tab=${row.manage.tabId}${row.manage.anchorId ? `#${row.manage.anchorId}` : ''}`}>{row.manage.label} →</Link>{row.guide ? <> · <Link to={`/help?g=${encodeURIComponent(row.guide)}`}>How it’s sent →</Link></> : null}</div>
                      </div>
                      {row.render.kind === 'sample' ? (
                        built ? (
                          <>
                            <div style={{ ...MUTED, marginBottom: '0.3rem' }}>Subject: <span style={{ color: 'var(--text)' }}>{built.subject}</span></div>
                            <iframe key={`${row.id}-${reloadNonce}`} title={row.label} srcDoc={built.html} sandbox="" style={{ width: '100%', maxWidth: 640, height: 420, border: '1px solid var(--border)', borderRadius: 6, background: '#f3f5f7' }} />
                            {row.real ? (
                              <div style={{ marginTop: '0.5rem' }}>
                                {real[row.id] == null ? (
                                  <button type="button" style={PILL} onClick={() => showReal(row)}>Show the real one — today’s, over live rows, for your eyes only</button>
                                ) : real[row.id] === 'loading' ? (
                                  <span style={MUTED}>Building today’s email…</span>
                                ) : 'error' in (real[row.id] as object) ? (
                                  <span style={{ color: 'var(--text-red-700)', fontSize: '0.8rem' }}>{(real[row.id] as { error: string }).error}</span>
                                ) : (
                                  <iframe key={`${row.id}-real`} title={`${row.label} — real`} srcDoc={(real[row.id] as { html: string }).html} sandbox="" style={{ width: '100%', maxWidth: 640, height: 480, border: '1px solid var(--border)', borderRadius: 6, background: '#f3f5f7' }} />
                                )}
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <span style={{ color: 'var(--text-red-700)', fontSize: '0.8rem' }}>This sample could not be built — see the console.</span>
                        )
                      ) : row.render.kind === 'real' ? (
                        <div>
                          {real[row.id] == null ? (
                            <button type="button" style={PILL_ON} onClick={() => showReal(row)}>Show the real one — today’s, over live rows, for your eyes only</button>
                          ) : real[row.id] === 'loading' ? (
                            <span style={MUTED}>Building today’s email…</span>
                          ) : 'error' in (real[row.id] as object) ? (
                            <span style={{ color: 'var(--text-red-700)', fontSize: '0.8rem' }}>{(real[row.id] as { error: string }).error}</span>
                          ) : (
                            <iframe key={`${row.id}-real`} title={`${row.label} — real`} srcDoc={(real[row.id] as { html: string }).html} sandbox="" style={{ width: '100%', maxWidth: 640, height: 480, border: '1px solid var(--border)', borderRadius: 6, background: '#f3f5f7' }} />
                          )}
                        </div>
                      ) : (
                        <div style={{ ...MUTED, padding: '0.6rem 0.75rem', border: '1px dashed var(--border)', borderRadius: 6 }}>
                          <strong style={{ color: 'var(--text-700)' }}>Next release.</strong> {row.render.note} Once its builder is lifted into a kernel the sample renders here.
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>
      ))}
      {myRole !== 'dev' ? <div style={{ ...CARD, ...MUTED }}>This tab is for devs.</div> : null}
    </div>
  )
}
