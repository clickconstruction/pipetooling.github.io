import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../../../lib/supabase'
import { getAccessTokenForEdgeFunctions } from '../../../lib/supabaseAccessTokenForEdge'
import { withSupabaseRetry } from '../../../utils/errorHandling'
import { useToastContext } from '../../../contexts/ToastContext'
import { APP_CALENDAR_TZ } from '../../../utils/dateUtils'
import { ACTIVITY_SCOPE_UI, CREW_FILTER_UI, calendarDayKeyWithZone, type ActivityScope, type CrewFilter } from '../../../lib/reports/digestScheduleFields'
import type { RosterUser } from '../../../lib/reports/emailReportPeople'

type CompactSelectStyle = CSSProperties & { fieldSizing?: 'content' }
const labelStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem', flex: '0 0 auto', width: 'fit-content' }
const wideSelect: CompactSelectStyle = { width: 'max-content', maxWidth: 'min(280px, 40vw)', padding: '0.4rem 0.5rem', boxSizing: 'border-box', fieldSizing: 'content' }
const narrowSelect: CompactSelectStyle = { width: 'max-content', maxWidth: 'max-content', padding: '0.4rem 0.5rem', boxSizing: 'border-box', fieldSizing: 'content' }

/**
 * Preview or send a test (v2.3595; the sandbox half of the retired `RecurringDigestsPanel`,
 * same controls, same edge functions): render a digest as HTML for any recipient / scope /
 * filter, or send one to your own login email. Never sends to anyone else.
 */
export function DigestPreviewToolbar({
  scopeMasterChoices,
  roster,
  authUserId,
}: {
  scopeMasterChoices: readonly { id: string; label: string }[]
  roster: readonly RosterUser[]
  authUserId: string | undefined
}) {
  const { showToast } = useToastContext()
  const [scopeMasterId, setScopeMasterId] = useState<string | null>(() => scopeMasterChoices[0]?.id ?? null)
  const [recipientUserId, setRecipientUserId] = useState<string | null>(authUserId ?? null)
  const [activityScope, setActivityScope] = useState<ActivityScope>('calendar_yesterday')
  const [crewFilter, setCrewFilter] = useState<CrewFilter>('all_users')
  const [includeCosts, setIncludeCosts] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [testSendLoading, setTestSendLoading] = useState(false)

  useEffect(() => {
    setScopeMasterId((prev) => (prev && scopeMasterChoices.some((c) => c.id === prev) ? prev : scopeMasterChoices[0]?.id ?? null))
  }, [scopeMasterChoices])
  useEffect(() => {
    setRecipientUserId(authUserId ?? null)
  }, [authUserId])

  async function run(kind: 'preview' | 'test') {
    if (!scopeMasterId) return
    const setBusy = kind === 'preview' ? setPreviewLoading : setTestSendLoading
    setBusy(true)
    try {
      const token = await getAccessTokenForEdgeFunctions()
      if (!token) {
        showToast('Your session expired. Sign in again, then retry.', 'error')
        return
      }
      const body = {
        scope_master_user_id: scopeMasterId,
        recipient_user_id: recipientUserId ?? undefined,
        activity_scope: activityScope,
        crew_filter: crewFilter,
        timezone: APP_CALENDAR_TZ,
        anchor_date: calendarDayKeyWithZone(Date.now(), APP_CALENDAR_TZ),
        include_costs: includeCosts,
      }
      const fn = kind === 'preview' ? 'recurring-job-report-preview' : 'recurring-job-report-test-send'
      const data = await withSupabaseRetry(async () => supabase.functions.invoke(fn, { headers: { Authorization: `Bearer ${token}` }, body }), fn)
      if (kind === 'preview') {
        const payload = data as unknown as { html?: string }
        setPreviewHtml(typeof payload.html === 'string' ? payload.html : '')
      } else showToast('Test email sent (to your login email)', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const busy = previewLoading || testSendLoading
  return (
    <div data-testid="digest-preview-toolbar">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 12 }}>
        <label style={labelStyle}>
          <span>Org</span>
          <select value={scopeMasterId ?? ''} onChange={(e) => setScopeMasterId(e.target.value || null)} style={wideSelect}>
            {scopeMasterChoices.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          <span>Recipient</span>
          <select value={recipientUserId ?? ''} onChange={(e) => setRecipientUserId(e.target.value || null)} style={wideSelect}>
            {roster.map((u) => (
              <option key={u.id} value={u.id}>{(u.name ?? '').trim() || u.email}</option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          <span>Scope</span>
          <select value={activityScope} onChange={(e) => setActivityScope(e.target.value as ActivityScope)} style={narrowSelect}>
            {ACTIVITY_SCOPE_UI.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          <span>Filter</span>
          <select value={crewFilter} onChange={(e) => setCrewFilter(e.target.value as CrewFilter)} style={narrowSelect}>
            {CREW_FILTER_UI.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label style={{ ...labelStyle, justifyContent: 'flex-end', marginBottom: 2 }}>
          <span aria-hidden />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.4rem 0' }}>
            <input type="checkbox" checked={includeCosts} onChange={(e) => setIncludeCosts(e.target.checked)} style={{ width: '1.1rem', height: '1.1rem', flexShrink: 0 }} />
            Include costs
          </span>
        </label>
        <button type="button" onClick={() => void run('preview')} disabled={busy || !scopeMasterId} style={{ padding: '0.45rem 0.75rem', flexShrink: 0, background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: busy ? 'wait' : !scopeMasterId ? 'not-allowed' : 'pointer' }}>
          {previewLoading ? 'Preview…' : 'Preview HTML'}
        </button>
        <button type="button" onClick={() => void run('test')} disabled={busy || !scopeMasterId} style={{ padding: '0.45rem 0.75rem', flexShrink: 0, background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: busy ? 'wait' : !scopeMasterId ? 'not-allowed' : 'pointer' }}>
          {testSendLoading ? 'Sending…' : 'Send test email'}
        </button>
      </div>
      {previewHtml ? (
        <div style={{ marginBottom: 12, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <iframe title="Email preview" sandbox="" style={{ width: '100%', minHeight: 280, border: 'none', background: 'var(--bg-page)' }} srcDoc={previewHtml} />
        </div>
      ) : null}
    </div>
  )
}
