import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'

/**
 * Settings → Jobs & dispatch: the sub portal's pay schedule (sub-portal
 * train). Two app_settings keys, written once, shown to every sub:
 * sub_pay_run_day powers the "queued for the Friday pay run" math on the
 * portal, sub_pay_explainer is the "How pay works here" band. Self-contained
 * like HideHcpFieldSettingsBlock.
 */

const DAY_OPTIONS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const

export default function SubPortalPaySettingsBlock() {
  const { showToast } = useToastContext()
  const [day, setDay] = useState('')
  const [explainer, setExplainer] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value_text')
        .in('key', ['sub_pay_run_day', 'sub_pay_explainer'])
      for (const row of data ?? []) {
        if (row.key === 'sub_pay_run_day') setDay((row.value_text ?? '').trim())
        if (row.key === 'sub_pay_explainer') setExplainer(row.value_text ?? '')
      }
      setLoaded(true)
    })()
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from('app_settings').upsert([
        { key: 'sub_pay_run_day', value_text: day.trim() || null },
        { key: 'sub_pay_explainer', value_text: explainer.trim() || null },
      ])
      if (error) {
        showToast(`Could not save: ${error.message}`, 'error')
        return
      }
      setDirty(false)
      showToast('Sub portal pay settings saved.', 'success')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
      <div style={{ fontWeight: 600, fontSize: '1rem' }}>Sub portal · pay schedule</div>
      <p style={{ margin: '2px 0 0.8rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        Shown on every sub&#8217;s Work &amp; Pay portal. The pay-run day drives &#8220;queued for the {day ? day[0]!.toUpperCase() + day.slice(1) : 'Friday'} pay run&#8221;;
        the explainer is the &#8220;How pay works here&#8221; band.
      </p>
      <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ fontSize: '0.8125rem' }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 3 }}>Pay run day</span>
          <select
            value={day}
            disabled={!loaded || saving}
            onChange={(e) => {
              setDay(e.target.value)
              setDirty(true)
            }}
            style={{ padding: '0.4rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: '0.875rem', background: 'var(--surface)', color: 'var(--text-900)' }}
          >
            <option value="">— not set (portal makes no run-day promise) —</option>
            {DAY_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d[0]!.toUpperCase() + d.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label style={{ display: 'block', marginTop: '0.8rem', fontSize: '0.8125rem' }}>
        <span style={{ display: 'block', fontWeight: 600, marginBottom: 3 }}>&#8220;How pay works&#8221; — shown on every sub&#8217;s portal</span>
        <textarea
          value={explainer}
          disabled={!loaded || saving}
          onChange={(e) => {
            setExplainer(e.target.value)
            setDirty(true)
          }}
          rows={3}
          placeholder="We run payments every Friday. When your work passes inspection it's queued for the next run…"
          style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: '0.875rem', fontFamily: 'inherit', resize: 'vertical', background: 'var(--surface)', color: 'var(--text-900)' }}
        />
      </label>
      {dirty && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.6rem' }}>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            style={{ padding: '0.45rem 1rem', background: saving ? '#9ca3af' : '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.85rem', cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  )
}
