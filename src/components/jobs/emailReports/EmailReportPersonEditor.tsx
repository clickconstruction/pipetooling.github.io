import { useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../../lib/supabase'
import { useToastContext } from '../../../contexts/ToastContext'
import { useConfirmDialog } from '../../../contexts/ConfirmDialogContext'
import { SearchableSelect } from '../../SearchableSelect'
import { SearchableMultiSelect } from '../../SearchableMultiSelect'
import {
  deleteReportEmailSubscription,
  saveReportEmailSubscription,
  validateSubscriptionDraft,
  type SubscriptionDraft,
  type SubscriptionWithAuthors,
  type TeamLeadOption,
} from '../../../lib/reportEmailSubscriptions'
import { ACTIVITY_SCOPE_UI, CREW_FILTER_UI, describeScheduleWhen, type ActivityScope, type CrewFilter } from '../../../lib/reports/digestScheduleFields'
import { digestDraftsFor, personKeyForEmail, personKeyForUser, planDigestRowWrites, type EmailReportPerson, type PersonDigestDraft, type RosterUser } from '../../../lib/reports/emailReportPeople'
import type { ScheduleRow } from './useEmailReportsData'

const LABEL: CSSProperties = { fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }
const INPUT: CSSProperties = { width: '100%', padding: '0.4rem 0.55rem', fontSize: '0.875rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-strong)', boxSizing: 'border-box' }
const SECTION: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.85rem', marginBottom: '0.75rem', background: 'var(--bg-subtle)' }
function segBtn(active: boolean): CSSProperties {
  return { padding: '0.3rem 0.6rem', fontSize: '0.8125rem', fontWeight: active ? 600 : 400, border: '1px solid var(--border-strong)', background: active ? '#3b82f6' : 'var(--surface)', color: active ? 'white' : 'var(--text-strong)', cursor: 'pointer' }
}

function draftFromSubscription(s: SubscriptionWithAuthors | null, person: EmailReportPerson | null): SubscriptionDraft {
  return {
    recipientKind: person?.outside ? 'email' : 'user',
    recipientUserId: person?.userId ?? null,
    recipientEmail: person?.outside ? person.email : '',
    label: s?.subscription.label ?? (person?.outside ? person.name : ''),
    allAuthors: s?.subscription.all_authors ?? true,
    authorUserIds: s?.authorUserIds ?? [],
    teamLeadUserIds: s?.teamLeadUserIds ?? [],
    autoSend: s?.subscription.auto_send ?? true,
    enabled: s?.subscription.enabled ?? true,
  }
}

/**
 * One person's report email (v2.3595 — Option B's editor): the digests they are on, one line
 * per schedule with their own scope · filter · costs, and their every-report subscription.
 * Saving writes digest rows **one by one** — insert, update or delete by id — so editing one
 * person never rewrites the schedule's other recipients; the subscription goes through the
 * same kernel the old cards used. An outside address has no digest section (the digest
 * recipient is a user). *Remove* takes the person off everything.
 */
export function EmailReportPersonEditor({
  person,
  roster,
  schedules,
  subscriptions,
  teamLeads,
  people,
  authUserId,
  onDone,
  onCancel,
}: {
  /** null = Add person */
  person: EmailReportPerson | null
  roster: readonly RosterUser[]
  schedules: readonly ScheduleRow[]
  subscriptions: readonly SubscriptionWithAuthors[]
  teamLeads: readonly TeamLeadOption[]
  people: readonly EmailReportPerson[]
  authUserId: string | undefined
  onDone: () => void | Promise<void>
  onCancel: () => void
}) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const existingSub = useMemo(() => (person?.everyReport ? subscriptions.find((s) => s.subscription.id === person.everyReport?.subscriptionId) ?? null : null), [person, subscriptions])

  const [kind, setKind] = useState<'user' | 'email'>(person?.outside ? 'email' : 'user')
  const [userId, setUserId] = useState<string | null>(person?.userId ?? null)
  const [email, setEmail] = useState(person?.outside ? person.email : '')
  const [label, setLabel] = useState(existingSub?.subscription.label ?? (person?.outside ? person.name : ''))
  const [digests, setDigests] = useState<PersonDigestDraft[]>(() => digestDraftsFor(schedules, person))
  const [getsEvery, setGetsEvery] = useState(Boolean(person?.everyReport))
  const [sub, setSub] = useState<SubscriptionDraft>(() => draftFromSubscription(existingSub, person))
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sendResult, setSendResult] = useState<string | null>(null)

  const isNew = person == null
  const listedKeys = useMemo(() => new Set(people.map((p) => p.key)), [people])
  const rosterOptions = useMemo(
    () => roster.filter((u) => isNew ? !listedKeys.has(personKeyForUser(u.id)) : true).map((u) => ({ value: u.id, label: u.email ? `${u.name ?? ''} (${u.email})`.trim() : u.name ?? u.id })),
    [roster, isNew, listedKeys],
  )
  const authorOptions = useMemo(() => roster.map((u) => ({ value: u.id, label: u.email ? `${u.name ?? ''} (${u.email})`.trim() : u.name ?? u.id })), [roster])
  const teamLeadOptions = useMemo(() => teamLeads.map((l) => ({ value: l.user_id, label: `${l.name} — leads ${l.member_count} ${l.member_count === 1 ? 'person' : 'people'}` })), [teamLeads])

  function patchDigest(scheduleId: string, patch: Partial<PersonDigestDraft>) {
    setDigests((d) => d.map((x) => (x.scheduleId === scheduleId ? { ...x, ...patch } : x)))
    setError(null)
  }
  function patchSub(patch: Partial<SubscriptionDraft>) {
    setSub((s) => ({ ...s, ...patch }))
    setError(null)
  }

  async function save() {
    if (!authUserId) return
    setError(null)
    const effectiveUserId = kind === 'user' ? userId : null
    const effectiveEmail = kind === 'email' ? email.trim() : ''
    if (kind === 'user' && !effectiveUserId) return setError('Pick a person.')
    if (kind === 'email' && !effectiveEmail) return setError('Type the email address.')
    if (isNew && kind === 'email' && listedKeys.has(personKeyForEmail(effectiveEmail))) return setError('That address is already on the list — edit its row instead.')
    const wantsDigest = kind === 'user' && digests.some((d) => d.on)
    if (!wantsDigest && !getsEvery) return setError('Tick at least one digest or Every report — or Remove the person.')

    setSaving(true)
    try {
      // 1. Digest rows, one by one (users only).
      if (kind === 'user' && effectiveUserId) {
        const plan = planDigestRowWrites(effectiveUserId, person?.digests ?? [], digests)
        if (plan.inserts.length > 0) {
          const { error: e } = await supabase.from('recurring_job_report_schedule_recipients').insert(plan.inserts)
          if (e) throw e
        }
        for (const u of plan.updates) {
          const { error: e } = await supabase.from('recurring_job_report_schedule_recipients').update({ activity_scope: u.activity_scope, crew_filter: u.crew_filter, include_costs: u.include_costs }).eq('id', u.id)
          if (e) throw e
        }
        if (plan.deletes.length > 0) {
          const { error: e } = await supabase.from('recurring_job_report_schedule_recipients').delete().in('id', plan.deletes)
          if (e) throw e
        }
      }
      // 2. The every-report subscription through the shared kernel.
      if (getsEvery) {
        const draft: SubscriptionDraft = { ...sub, recipientKind: kind, recipientUserId: effectiveUserId, recipientEmail: effectiveEmail, label: kind === 'email' ? label : sub.label }
        const valid = validateSubscriptionDraft(draft)
        if (!valid.ok) {
          setError(valid.error)
          return
        }
        await saveReportEmailSubscription(draft, authUserId, existingSub?.subscription.id)
      } else if (existingSub) {
        await deleteReportEmailSubscription(existingSub.subscription.id)
      }
      showToast(isNew ? 'Person added.' : 'Saved.', 'success')
      await onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  async function removePerson() {
    if (!person) return onCancel()
    const ok = await confirmDialog({ message: `Take ${person.name} off every report email?\n\nTheir digests and their every-report setting are removed.`, confirmLabel: 'Remove', danger: true })
    if (!ok) return
    setSaving(true)
    try {
      if (person.digests.length > 0) {
        const { error: e } = await supabase.from('recurring_job_report_schedule_recipients').delete().in('id', person.digests.map((d) => d.rowId))
        if (e) throw e
      }
      if (person.everyReport) await deleteReportEmailSubscription(person.everyReport.subscriptionId)
      showToast(`${person.name} removed.`, 'success')
      await onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove.')
    } finally {
      setSaving(false)
    }
  }

  async function sendNow() {
    const id = existingSub?.subscription.id
    if (!id) return
    setSending(true)
    setSendResult(null)
    setError(null)
    try {
      const { data, error: e } = await supabase.functions.invoke('send-report-email', { body: { mode: 'manual', subscription_id: id } })
      if (e) throw e
      const sent = (data as { sent?: number } | null)?.sent ?? 0
      setSendResult(sent === 0 ? 'No new reports to send (already up to date).' : `Emailed ${sent} report${sent === 1 ? '' : 's'}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send.')
    } finally {
      setSending(false)
    }
  }

  const title = isNew ? 'Add person' : person.name
  return (
    <div data-testid="email-report-person-editor">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>{title}</h3>
        {!isNew ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{person.email}</span> : null}
      </div>

      {isNew ? (
        <div style={SECTION}>
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
            <button type="button" onClick={() => setKind('user')} style={segBtn(kind === 'user')}>App user</button>
            <button type="button" onClick={() => setKind('email')} style={segBtn(kind === 'email')}>Outside address</button>
          </div>
          {kind === 'user' ? (
            <div>
              <span style={LABEL}>Person</span>
              <SearchableSelect value={userId ?? ''} onChange={(v) => { setUserId(v || null); setError(null) }} options={rosterOptions} placeholder="Pick a person…" searchable searchReplacesTrigger listAriaLabel="Person" portalZIndex={1200} />
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 220px' }}>
                <span style={LABEL}>Email address</span>
                <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null) }} placeholder="owner@example.com" style={INPUT} />
              </div>
              <div style={{ flex: '1 1 160px' }}>
                <span style={LABEL}>Label (optional)</span>
                <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Owner" style={INPUT} />
              </div>
            </div>
          )}
        </div>
      ) : null}

      {kind === 'user' ? (
        <div style={SECTION}>
          <span style={LABEL}>Digests — a bundle on a schedule</span>
          {schedules.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>No schedules yet — make one from the Schedules line first.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <tbody>
                {schedules.map((s) => {
                  const d = digests.find((x) => x.scheduleId === s.id)
                  if (!d) return null
                  return (
                    <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 6px 6px 0', whiteSpace: 'nowrap' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                          <input type="checkbox" checked={d.on} onChange={(e) => patchDigest(s.id, { on: e.target.checked })} aria-label={`On ${s.name}`} />
                          <strong>{s.name}</strong>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{describeScheduleWhen(s)}{s.enabled ? '' : ' · off'}</span>
                        </label>
                      </td>
                      <td style={{ padding: 6 }}>
                        <select value={d.activityScope} disabled={!d.on} onChange={(e) => patchDigest(s.id, { activityScope: e.target.value as ActivityScope })} style={{ padding: '0.3rem' }} aria-label={`Scope on ${s.name}`}>
                          {ACTIVITY_SCOPE_UI.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: 6 }}>
                        <select value={d.crewFilter} disabled={!d.on} onChange={(e) => patchDigest(s.id, { crewFilter: e.target.value as CrewFilter })} style={{ padding: '0.3rem' }} aria-label={`Filter on ${s.name}`}>
                          {CREW_FILTER_UI.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: 6, whiteSpace: 'nowrap' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', color: 'var(--text-muted)' }} title="Add a Cost column: hours × hourly wage from People pay config">
                          <input type="checkbox" checked={d.includeCosts} disabled={!d.on} onChange={(e) => patchDigest(s.id, { includeCosts: e.target.checked })} aria-label={`Costs on ${s.name}`} />
                          costs
                        </label>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>An outside address can get every report; digests go to app users only.</p>
      )}

      <div style={SECTION}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
          <input type="checkbox" checked={getsEvery} onChange={(e) => { setGetsEvery(e.target.checked); setError(null) }} />
          Every report — one email per report, the moment it&rsquo;s filed
        </label>
        {getsEvery ? (
          <div style={{ marginTop: '0.6rem' }}>
            <span style={LABEL}>Which reports</span>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input type="radio" name="every-scope" checked={sub.allAuthors} onChange={() => patchSub({ allAuthors: true })} />
                All reports
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input type="radio" name="every-scope" checked={!sub.allAuthors} onChange={() => patchSub({ allAuthors: false })} />
                Only from selected people or teams
              </label>
            </div>
            {!sub.allAuthors ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div>
                  <span style={LABEL}>People</span>
                  <SearchableMultiSelect options={authorOptions} value={sub.authorUserIds} onChange={(ids) => patchSub({ authorUserIds: ids })} listAriaLabel="Report authors" searchPlaceholder="Search people…" pinSelectedToTop />
                </div>
                <div>
                  <span style={LABEL}>Team leads — their whole team, kept current</span>
                  {teamLeadOptions.length > 0 ? (
                    <SearchableMultiSelect options={teamLeadOptions} value={sub.teamLeadUserIds} onChange={(ids) => patchSub({ teamLeadUserIds: ids })} listAriaLabel="Team leads" searchPlaceholder="Search team leads…" pinSelectedToTop />
                  ) : (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No team leads set up yet — People → Users → Team leads.</span>
                  )}
                </div>
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                <input type="checkbox" checked={sub.autoSend} onChange={(e) => patchSub({ autoSend: e.target.checked })} />
                Auto-send new reports
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                <input type="checkbox" checked={sub.enabled} onChange={(e) => patchSub({ enabled: e.target.checked })} />
                Enabled
              </label>
            </div>
          </div>
        ) : null}
      </div>

      {error ? <p style={{ color: 'var(--text-red-700)', fontSize: '0.8125rem', margin: '0 0 0.5rem' }}>{error}</p> : null}
      {sendResult ? <p style={{ color: 'var(--text-green-700)', fontSize: '0.8125rem', margin: '0 0 0.5rem' }}>{sendResult}</p> : null}

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" onClick={() => void save()} disabled={saving} style={{ padding: '0.4rem 0.9rem', fontSize: '0.875rem', fontWeight: 600, border: 'none', borderRadius: 4, background: '#3b82f6', color: 'white', cursor: saving ? 'wait' : 'pointer' }}>
          {saving ? '…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} style={{ padding: '0.4rem 0.9rem', fontSize: '0.875rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>
          Cancel
        </button>
        {existingSub ? (
          <button type="button" onClick={() => void sendNow()} disabled={sending || saving} title="Email recent matching reports now — up to 50 real reports from the last 14 days" style={{ padding: '0.4rem 0.9rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: sending ? 'wait' : 'pointer' }}>
            {sending ? 'Sending…' : 'Send now'}
          </button>
        ) : null}
        {!isNew ? (
          <button type="button" onClick={() => void removePerson()} disabled={saving} style={{ marginLeft: 'auto', padding: '0.4rem 0.9rem', fontSize: '0.875rem', background: 'none', color: 'var(--text-red-700)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>
            Remove
          </button>
        ) : null}
      </div>
    </div>
  )
}
