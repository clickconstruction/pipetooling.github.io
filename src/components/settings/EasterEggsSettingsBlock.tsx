import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { APP_SETTINGS_KEY_EASTER_EGGS } from '../../lib/appSettingsKeys'
import {
  EASTER_EGG_SPRITES,
  EASTER_EGG_SURFACES,
  parseEasterEggsSetting,
  serializeEasterEggsSetting,
  type EasterEggConfig,
} from '../../lib/easterEggsConfig'
import { EASTER_EGG_PREVIEW_EVENT } from '../FloatingEasterEgg'

type UserRow = { id: string; name: string | null }

/**
 * Settings → Easter eggs (dev, v2.2074): one card per sprite — on/off, who
 * (targeted users), where (surface registry), and a Preview button that plays
 * the visit right here without the 1-in-50 roll. The whole admin is those
 * three choices; frequency (1-in-50) and personality (7s visit, flee radius)
 * are hard-coded gentle defaults on purpose.
 */
export default function EasterEggsSettingsBlock({ users }: { users: UserRow[] }) {
  const { showToast } = useToastContext()
  const [configs, setConfigs] = useState<EasterEggConfig[]>([])
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addUserOpenFor, setAddUserOpenFor] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = (await withSupabaseRetry(
        async () =>
          supabase.from('app_settings').select('value_text').eq('key', APP_SETTINGS_KEY_EASTER_EGGS).maybeSingle(),
        'load easter eggs setting',
      )) as { value_text: string | null } | null
      setConfigs(parseEasterEggsSetting(data?.value_text))
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save(next: EasterEggConfig[]) {
    setConfigs(next)
    setSaving(true)
    try {
      await withSupabaseRetry(
        async () =>
          supabase
            .from('app_settings')
            .upsert({ key: APP_SETTINGS_KEY_EASTER_EGGS, value_text: serializeEasterEggsSetting(next) }, { onConflict: 'key' }),
        'save easter eggs setting',
      )
    } catch (err) {
      showToast(formatErrorMessage(err, 'Could not save easter eggs'), 'error')
      void load()
    } finally {
      setSaving(false)
    }
  }

  function configFor(key: string): EasterEggConfig {
    return configs.find((c) => c.key === key) ?? { key, enabled: false, targetUserIds: [], surfaces: [] }
  }

  function patch(key: string, p: Partial<EasterEggConfig>) {
    const current = configFor(key)
    const next = { ...current, ...p }
    void save([...configs.filter((c) => c.key !== key), next])
  }

  const userName = (id: string) => (users.find((u) => u.id === id)?.name ?? '').trim() || id.slice(0, 8)

  if (!loaded) return null

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem 1.25rem', marginTop: '1rem' }}>
      <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>Easter eggs</h3>
      <p style={{ margin: '0 0 0.9rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        Small visitors for specific people on specific screens. 1-in-50 page opens, a 7-second visit, never clickable, never on reduced-motion. Changes apply instantly — no deploy.
      </p>
      {Object.entries(EASTER_EGG_SPRITES).map(([key, sprite]) => {
        const cfg = configFor(key)
        return (
          <div key={key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem', maxWidth: '42rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.7rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <img src={sprite.asset} alt="" style={{ width: 34, height: 'auto' }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{sprite.label}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>1-in-50 page opens · plays 7s · flees the cursor</div>
                </div>
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={cfg.enabled} disabled={saving} onChange={(e) => patch(key, { enabled: e.target.checked })} />
                Enabled
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
              <span style={{ fontSize: '0.63rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Who</span>
              {cfg.targetUserIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => patch(key, { targetUserIds: cfg.targetUserIds.filter((u) => u !== id) })}
                  title="Remove"
                  style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0.12rem 0.55rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', cursor: 'pointer' }}
                >
                  {userName(id)} ×
                </button>
              ))}
              {addUserOpenFor === key ? (
                <select
                  autoFocus
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) patch(key, { targetUserIds: [...cfg.targetUserIds, e.target.value] })
                    setAddUserOpenFor(null)
                  }}
                  onBlur={() => setAddUserOpenFor(null)}
                  style={{ font: 'inherit', fontSize: '0.78rem', padding: '0.15rem 0.35rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)' }}
                >
                  <option value="">pick a person…</option>
                  {users
                    .filter((u) => !cfg.targetUserIds.includes(u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {(u.name ?? '').trim() || u.id.slice(0, 8)}
                      </option>
                    ))}
                </select>
              ) : (
                <button type="button" onClick={() => setAddUserOpenFor(key)} style={{ font: 'inherit', fontSize: '0.75rem', padding: '0.12rem 0.55rem', borderRadius: 999, border: '1px dashed var(--border-strong)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  + add person
                </button>
              )}
              <span style={{ fontSize: '0.63rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginLeft: '0.6rem' }}>Where</span>
              {Object.entries(EASTER_EGG_SURFACES).map(([sKey, surface]) => {
                const on = cfg.surfaces.includes(sKey)
                return (
                  <button
                    key={sKey}
                    type="button"
                    onClick={() => patch(key, { surfaces: on ? cfg.surfaces.filter((s) => s !== sKey) : [...cfg.surfaces, sKey] })}
                    style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: on ? 600 : 400, padding: '0.12rem 0.55rem', borderRadius: 999, border: `1px solid ${on ? 'var(--border-strong)' : 'var(--border)'}`, background: on ? 'var(--bg-blue-tint)' : 'none', color: on ? 'var(--text-blue-700)' : 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    {surface.label}
                    {on ? ' ×' : ''}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent(EASTER_EGG_PREVIEW_EVENT, { detail: { key } }))}
                style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.6rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--bg-subtle)', color: 'var(--text-700)', cursor: 'pointer', marginLeft: 'auto' }}
                title="Play the 7-second visit on this screen, skipping the 1-in-50 roll"
              >
                Preview here now
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
