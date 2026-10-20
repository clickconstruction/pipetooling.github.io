import { useEffect, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { fetchGcOfficeNoticesSince, setGcOfficeNoticesOn } from '../../lib/gc/officeNoticesSetting'
import { GC_CUSTOMER_DUE_NOTICES_SETTING_KEY } from '../../../supabase/functions/_shared/gcOfficeNotices'
import { previewOfficeNotices, sendOfficeNoticesTest, type OfficeNoticePreview } from '../../lib/gc/gcIo'
import { shortDate } from '../../lib/gc/words'
import { todayYmdInAppTz } from '../../utils/dateUtils'

/**
 * Settings → Jobs & billing → "Email GC customers 3 days before a bill is due" (GC mode, Owner Billing's O12): the
 * customer hears once for each certified bill, from 3 days before its due day, on the due day Bill the customer shows.
 * Not a bill on card. Off on day one; the owner turns it on after a test copy. Turning it on keeps the day it went
 * on, and only bills certified from that day get the notice, so nothing old goes out. Dev and the owner. **Preview**
 * shows today's as they would go and **Email me a test** sends each one to you alone, marked [TEST]; neither sends a
 * notice for real. Both read as if the notice went on the day in *Count bills certified since* (O10c's field). The
 * office's block beside it is `GcOfficeNoticesSettingsBlock`.
 */
export default function GcCustomerDueNoticesSettingsBlock() {
  const { showToast } = useToastContext()
  const [since, setSince] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<OfficeNoticePreview[] | null>(null)
  const [busy, setBusy] = useState<'preview' | 'test' | null>(null)
  const today = todayYmdInAppTz()
  // The day Preview and the test read from: the switch's while on, else today; the person may pick an earlier one.
  const [sentSince, setSentSince] = useState(today)
  const [previewSince, setPreviewSince] = useState<string | null>(null)
  const sinceOk = /^\d{4}-\d{2}-\d{2}$/.test(sentSince) && sentSince <= today

  useEffect(() => {
    void (async () => {
      const day = await fetchGcOfficeNoticesSince(GC_CUSTOMER_DUE_NOTICES_SETTING_KEY)
      setSince(day)
      setSentSince(day ?? todayYmdInAppTz())
      setLoaded(true)
    })()
  }, [])

  const toggle = async (next: boolean) => {
    setSaving(true)
    const prev = since
    try {
      const day = await setGcOfficeNoticesOn(next, GC_CUSTOMER_DUE_NOTICES_SETTING_KEY)
      setSince(day)
      setSentSince(day ?? todayYmdInAppTz())
      showToast(next ? 'On. Bills certified from today get the customer’s notice.' : 'Off. The app tells no customer a bill is due.', 'success')
    } catch (e) {
      setSince(prev)
      showToast(`Could not save: ${e instanceof Error ? e.message : 'write failed'}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const look = async () => {
    setBusy('preview')
    try {
      const read = await previewOfficeNotices(sentSince, 'customer')
      setPreview(read.notices)
      setPreviewSince(read.since || sentSince)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'The notices did not load.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const test = async () => {
    setBusy('test')
    try {
      const sent = await sendOfficeNoticesTest(sentSince, 'customer')
      showToast(sent === 0 ? 'Nothing is due today, so no test went.' : `${sent} ${sent === 1 ? 'test' : 'tests'} went to your email.`, 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'The test did not go.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const on = since !== null
  return (
    <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }} data-testid="gc-customer-due-notices-block">
      <h3 style={{ margin: '0 0 0.6rem', fontSize: '1rem' }}>GC jobs · the customer’s notice before a bill is due</h3>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: loaded ? 'pointer' : 'default' }}>
        <input type="checkbox" checked={on} disabled={!loaded || saving} onChange={(e) => void toggle(e.target.checked)} style={{ marginTop: 3 }} aria-label="Email GC customers 3 days before a bill is due" />
        <span>
          <span style={{ display: 'block', fontWeight: 600, fontSize: '1rem' }}>Email GC customers 3 days before a bill is due</span>
          <span style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Each customer hears once for each bill, from 3 days before its due day. Not a bill on card.
          </span>
          <span style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {on
              ? `On since ${shortDate(since)}. Only bills certified from that day get the notice.`
              : 'Turning it on keeps today as its day. Only bills certified from then get the notice, so nothing old goes out.'}
          </span>
        </span>
      </label>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}>
          Count bills certified since
          <input type="date" value={sentSince} max={today} disabled={!loaded} onChange={(e) => setSentSince(e.target.value)} aria-label="Count bills certified since" />
        </label>
        <button type="button" disabled={busy !== null || !sinceOk} onClick={() => void look()}>
          Preview today’s notices
        </button>
        <button type="button" disabled={busy !== null || !sinceOk} onClick={() => void test()}>
          Email me a test
        </button>
      </div>
      {!sinceOk && <div style={{ marginTop: '0.4rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Pick today or an earlier day.</div>}
      {preview && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.875rem' }} data-testid="gc-customer-due-notices-preview">
          {preview.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>Nothing is due today.</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: '0.3rem' }}>
              {preview.map((n) => (
                <li key={`${n.kind}-${n.project}-${n.number}`}>
                  <strong>{n.subject}</strong>
                  <span style={{ color: 'var(--text-muted)' }}>{` · to ${n.to ?? 'no one'}${n.email ? ` at ${n.email}` : ', no email on file'}`}</span>
                </li>
              ))}
            </ul>
          )}
          {previewSince && <div style={{ color: 'var(--text-muted)', marginTop: '0.3rem' }}>{`As if the notice went on ${shortDate(previewSince)}.`}</div>}
        </div>
      )}
    </div>
  )
}
