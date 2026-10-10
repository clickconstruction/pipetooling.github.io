import { useEffect, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { fetchGcOfficeNoticesSince, setGcOfficeNoticesOn } from '../../lib/gc/officeNoticesSetting'
import { previewOfficeNotices, sendOfficeNoticesTest, type OfficeNoticePreview } from '../../lib/gc/gcIo'
import { shortDate } from '../../lib/gc/words'
import { todayYmdInAppTz } from '../../utils/dateUtils'

/**
 * Settings → Jobs & billing → "Email the office's GC notices" (GC mode, Owner Billing's O10): bill day in two days to
 * the project manager, a pay application still with the architect after 3 days and after 5. Off on day one; the owner
 * turns it on once the live walk is done. Turning it on keeps the day it went on, and only pay applications sent from
 * that day get notices, so nothing old goes out. Dev and the owner. **Preview** shows today's as they would go and
 * **Email me a test** sends each one to you alone, marked [TEST]; neither sends a notice for real. Both read as if the
 * notices went on the day in *Count pay applications sent since* (O10c): the switch's day while on, else today, never a
 * later day, so a walk can see a reminder for a pay application sent days ago while the switch is still off.
 */
export default function GcOfficeNoticesSettingsBlock() {
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
      const day = await fetchGcOfficeNoticesSince()
      setSince(day)
      setSentSince(day ?? todayYmdInAppTz())
      setLoaded(true)
    })()
  }, [])

  const toggle = async (next: boolean) => {
    setSaving(true)
    const prev = since
    try {
      const day = await setGcOfficeNoticesOn(next)
      setSince(day)
      setSentSince(day ?? todayYmdInAppTz())
      showToast(next ? 'On. Pay applications sent from today get the office’s notices.' : 'Off. The app sends no GC notices.', 'success')
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
      const read = await previewOfficeNotices(sentSince)
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
      const sent = await sendOfficeNoticesTest(sentSince)
      showToast(sent === 0 ? 'Nothing is due today, so no test went.' : `${sent} ${sent === 1 ? 'test' : 'tests'} went to your email.`, 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'The test did not go.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const on = since !== null
  return (
    <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }} data-testid="gc-office-notices-block">
      <h3 style={{ margin: '0 0 0.6rem', fontSize: '1rem' }}>GC jobs · the office’s notices</h3>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: loaded ? 'pointer' : 'default' }}>
        <input type="checkbox" checked={on} disabled={!loaded || saving} onChange={(e) => void toggle(e.target.checked)} style={{ marginTop: 3 }} aria-label="Email the office’s GC notices" />
        <span>
          <span style={{ display: 'block', fontWeight: 600, fontSize: '1rem' }}>Email the office’s GC notices</span>
          <span style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 2 }}>
            The project manager hears two days before bill day. The architect gets a reminder when a pay application waits 3 days for their certificate. The project manager hears at 5. Each goes once.
          </span>
          <span style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {on
              ? `On since ${shortDate(since)}. Only pay applications sent from that day get notices.`
              : 'Turning it on keeps today as its day. Only pay applications sent from then get notices, so nothing old goes out.'}
          </span>
        </span>
      </label>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}>
          Count pay applications sent since
          <input type="date" value={sentSince} max={today} disabled={!loaded} onChange={(e) => setSentSince(e.target.value)} aria-label="Count pay applications sent since" />
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
        <div style={{ marginTop: '0.75rem', fontSize: '0.875rem' }} data-testid="gc-office-notices-preview">
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
          {previewSince && <div style={{ color: 'var(--text-muted)', marginTop: '0.3rem' }}>{`As if the notices went on ${shortDate(previewSince)}.`}</div>}
        </div>
      )}
    </div>
  )
}
