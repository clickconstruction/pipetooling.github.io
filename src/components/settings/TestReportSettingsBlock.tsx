import { useEffect, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { DEFAULT_TEST_REPORT_SETTINGS, type TestReportSettings } from '../../lib/jobs/testReport'
import { cachedTestReportSettings, fetchTestReportSettings, saveTestReportSettings } from '../../lib/jobs/testReportSettings'

/**
 * Settings → Jobs & billing → "Test reports" (v2.3298): the certifier and the
 * paper's text, org-wide. Everything the external app hard-coded lives here
 * now; a blank field falls back to the seeded default at render time.
 */
type FieldDef = { key: keyof TestReportSettings; label: string; hint?: string; multiline?: boolean }

const IDENTITY: FieldDef[] = [
  { key: 'certifierName', label: 'Certified by', hint: 'The licensed master whose name signs every report.' },
  { key: 'certifierLicense', label: 'License', hint: 'Printed after the name exactly as written, e.g. #RMP41130.' },
  { key: 'companyName', label: 'Company name' },
  { key: 'companyTagline', label: 'Tagline', hint: 'Second line under the company name on the paper.' },
  { key: 'officePhone', label: 'Office phone' },
  { key: 'mailingAddress', label: 'Mailing address' },
  { key: 'tsbpeAddress', label: 'TSBPE address' },
]

const TEXTS: FieldDef[] = [
  { key: 'systemTestedSupply', label: 'System tested · supply', multiline: true },
  { key: 'systemTestedSewer', label: 'System tested · sewer', multiline: true },
  { key: 'testMethod', label: 'Test method', multiline: true },
  { key: 'testPressure', label: 'Test pressure' },
  { key: 'passConclusionSupply', label: 'PASS conclusion · supply', multiline: true },
  { key: 'passConclusionSewer', label: 'PASS conclusion · sewer', multiline: true },
  { key: 'failConclusionSupply', label: 'FAIL conclusion · supply', multiline: true },
  { key: 'failConclusionSewer', label: 'FAIL conclusion · sewer', multiline: true },
  { key: 'pinpointMethodDefault', label: 'Pinpoint test method (default)' },
  { key: 'certificationHydrostatic', label: 'Certification · hydrostatic', multiline: true },
  { key: 'certificationPinpoint', label: 'Certification · pinpoint', multiline: true },
  { key: 'certificationGas', label: 'Certification · gas', multiline: true },
]

const EMAIL: FieldDef[] = [
  { key: 'emailBodyTemplate', label: 'Report email body', hint: 'Placeholders: {report} {address} {payLink} {company} {phone}. The link line drops out when the job has no Stripe bill.', multiline: true },
  { key: 'emailCc', label: 'Always copy', hint: 'Addresses copied on every report email, comma-separated — e.g. the master who certifies.' },
]

export default function TestReportSettingsBlock() {
  const { showToast } = useToastContext()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<TestReportSettings>(() => cachedTestReportSettings())

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      const s = await fetchTestReportSettings()
      if (!cancelled) setDraft(s)
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: '0.45rem 0.5rem',
    fontSize: '0.875rem',
    border: '1px solid var(--border-strong)',
    borderRadius: 4,
    background: 'var(--surface)',
    color: 'var(--text-strong)',
    fontFamily: 'inherit',
  }

  const set = (key: keyof TestReportSettings, value: string) => setDraft((d) => ({ ...d, [key]: value }))

  const save = async () => {
    setSaving(true)
    try {
      await saveTestReportSettings(draft)
      showToast('Test report settings saved.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the test report settings'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const renderField = (f: FieldDef) => (
    <label key={f.key} style={{ display: 'block', marginBottom: '0.7rem' }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 3 }}>{f.label}</div>
      {f.multiline ? (
        <textarea rows={3} value={draft[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={DEFAULT_TEST_REPORT_SETTINGS[f.key]} style={inputStyle} />
      ) : (
        <input type="text" value={draft[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={DEFAULT_TEST_REPORT_SETTINGS[f.key]} style={inputStyle} />
      )}
      {f.hint ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{f.hint}</div> : null}
    </label>
  )

  return (
    <div style={{ marginBottom: '1.5rem', border: '1px solid var(--border)', borderRadius: 8 }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', margin: 0, padding: '1rem', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)', textAlign: 'left' }}
      >
        <span aria-hidden style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' }}>▸</span>
        Test reports — who certifies, and the words on the paper
      </button>
      {open ? (
        <div style={{ padding: '0 1rem 1rem' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 0 }}>
            Hydrostatic, pinpoint and gas test reports print this certifier and these sentences. A blank field uses the shown default. Sent reports keep the certifier they were sent with.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0 1rem' }}>{IDENTITY.map(renderField)}</div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0.5rem 0 0.6rem' }}>The paper's text</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0 1rem' }}>{TEXTS.map(renderField)}</div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0.5rem 0 0.6rem' }}>The email</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0 1rem' }}>{EMAIL.map(renderField)}</div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button type="button" disabled={saving} onClick={() => void save()} style={{ padding: '0.5rem 1rem', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600, cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" disabled={saving} onClick={() => setDraft({ ...DEFAULT_TEST_REPORT_SETTINGS })} style={{ padding: '0.5rem 0.8rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }}>
              Reset to defaults
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
