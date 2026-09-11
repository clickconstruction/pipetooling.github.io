import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { APP_SETTINGS_KEY_EASTER_EGGS } from '../../lib/appSettingsKeys'
import {
  EASTER_EGG_CATCH_DEFAULTS,
  EASTER_EGG_KNOBS,
  EASTER_EGG_SPRITES,
  EASTER_EGG_TUNING_DEFAULTS,
  defaultEasterEggConfig,
  parseEasterEggsSetting,
  serializeEasterEggsSetting,
  type EasterEggCatch,
  type EasterEggConfig,
  type EasterEggKnob,
  type EasterEggTuning,
} from '../../lib/easterEggsConfig'
import { eggSurfaceLabel, eggSurfaceVisibleForRole } from '../../lib/easterEggSurfaceTree'
import EasterEggScreenPickerModal, { type EggTargetPerson } from './EasterEggScreenPickerModal'
import { EASTER_EGG_PREVIEW_EVENT } from '../FloatingEasterEgg'
import type { UserRole } from '../../hooks/useAuth'

type UserRow = { id: string; name: string | null; role?: UserRole | null; estimator_prospects_access?: boolean | null }

const EYEBROW: React.CSSProperties = { fontSize: '0.63rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }
const PILL: React.CSSProperties = { font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0.12rem 0.55rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', cursor: 'pointer' }
const DASHED: React.CSSProperties = { font: 'inherit', fontSize: '0.75rem', padding: '0.12rem 0.55rem', borderRadius: 999, border: '1px dashed var(--border-strong)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }

/** One knob row: label · range · value. Drags update the row live; the save fires once on release. */
function KnobRow({ knob, value, disabled, onChange, onCommit }: { knob: EasterEggKnob; value: number; disabled: boolean; onChange: (v: number) => void; onCommit: () => void }) {
  const id = `egg-knob-${knob.key}`
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '8.5rem 1fr 4.5rem', alignItems: 'center', gap: '0.6rem', fontSize: '0.78rem' }}>
      <label htmlFor={id} style={{ color: 'var(--text-muted)' }}>
        {knob.label}
      </label>
      <input
        id={id}
        type="range"
        min={knob.min}
        max={knob.max}
        step={knob.step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        onBlur={onCommit}
        style={{ width: '100%', margin: 0, accentColor: '#e8792f' }}
      />
      <output htmlFor={id} style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-strong)' }}>
        {knob.format(value)}
      </output>
    </div>
  )
}

function summaryLine(cfg: EasterEggConfig): string {
  const t = cfg.tuning
  const c = cfg.catch
  const flee = t.fleeRampPerDay > 0 ? `flees ${t.fleeScale.toFixed(2)}× → ${Math.min(1.8, t.fleeScale + t.fleeRampPerDay).toFixed(2)}× by 6pm` : `flees ${t.fleeScale.toFixed(2)}×`
  const visit = `daily debut + 1-in-${t.oddsOneIn} · plays ${t.playSec}s · ${flee}`
  return c.enabled ? `${visit} · catch & ring: ${c.shots} shot${c.shots === 1 ? '' : 's'}, holds ${c.holdSec}s` : `${visit} · catch & ring off`
}

/**
 * Settings → Easter eggs (dev, v2.2074): one card per sprite — on/off, who
 * (targeted users), where (surface registry), a Preview button that plays the
 * visit right here without the dice roll, and (v2.3282) every number behind
 * the visit and the ring game as sliders. Changes apply instantly — no deploy.
 */
export default function EasterEggsSettingsBlock({ users }: { users: UserRow[] }) {
  const { showToast } = useToastContext()
  const [configs, setConfigs] = useState<EasterEggConfig[]>([])
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addUserOpenFor, setAddUserOpenFor] = useState<string | null>(null)
  const [screenPickerFor, setScreenPickerFor] = useState<string | null>(null)
  const [tuningOpenFor, setTuningOpenFor] = useState<string | null>(null)
  /** Slider drafts (per egg) — the row moves live, the save fires on release. */
  const [drafts, setDrafts] = useState<Record<string, EasterEggConfig>>({})

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
    return configs.find((c) => c.key === key) ?? defaultEasterEggConfig(key)
  }

  function patch(key: string, p: Partial<EasterEggConfig>) {
    const current = configFor(key)
    const next = { ...current, ...p }
    void save([...configs.filter((c) => c.key !== key), next])
  }

  /** The card's live view of an egg: the slider draft while one is being dragged, else the saved config. */
  const viewFor = (key: string): EasterEggConfig => drafts[key] ?? configFor(key)

  function draftKnob(key: string, knob: EasterEggKnob, v: number) {
    const base = viewFor(key)
    const next: EasterEggConfig =
      knob.group === 'tuning'
        ? { ...base, tuning: { ...base.tuning, [knob.key]: v } as EasterEggTuning }
        : { ...base, catch: { ...base.catch, [knob.key]: v } as EasterEggCatch }
    setDrafts((d) => ({ ...d, [key]: next }))
  }

  function commitKnobs(key: string) {
    const draft = drafts[key]
    if (!draft) return
    setDrafts((d) => {
      const { [key]: _drop, ...rest } = d
      return rest
    })
    const saved = configFor(key)
    if (JSON.stringify(saved.tuning) === JSON.stringify(draft.tuning) && JSON.stringify(saved.catch) === JSON.stringify(draft.catch)) return
    patch(key, { tuning: draft.tuning, catch: draft.catch })
  }

  const userName = (id: string) => (users.find((u) => u.id === id)?.name ?? '').trim() || id.slice(0, 8)

  if (!loaded) return null

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem 1.25rem', marginTop: '1rem' }}>
      <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>Easter eggs</h3>
      <p style={{ margin: '0 0 0.9rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        Small visitors for specific people on specific screens. First targeted-screen open each day is a guaranteed visit, then the dice; he plays near the cursor and, if you can catch him, a ring appears to shoot him through. Never on reduced-motion. Changes apply instantly — no deploy.
      </p>
      {Object.entries(EASTER_EGG_SPRITES).map(([key, sprite]) => {
        const cfg = viewFor(key)
        const targets: EggTargetPerson[] = cfg.targetUserIds.map((id) => {
          const u = users.find((x) => x.id === id)
          return {
            name: (u?.name ?? '').trim() || id.slice(0, 8),
            role: u?.role ?? null,
            estimatorProspectsAccess: u?.estimator_prospects_access === true,
          }
        })
        const unreachable = cfg.surfaces.flatMap((s) =>
          targets
            .filter((t) => !eggSurfaceVisibleForRole(s, t.role, t.estimatorProspectsAccess))
            .map((t) => ({ surface: eggSurfaceLabel(s), name: t.name })),
        )
        const tuningOpen = tuningOpenFor === key
        const knobValue = (k: EasterEggKnob): number =>
          k.group === 'tuning' ? cfg.tuning[k.key as keyof EasterEggTuning] : (cfg.catch[k.key as Exclude<keyof EasterEggCatch, 'enabled'>] as number)
        return (
          <div key={key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem', maxWidth: '42rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.7rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <img src={sprite.asset} alt="" style={{ width: 34, height: 'auto' }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{sprite.label}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{summaryLine(cfg)}</div>
                </div>
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={cfg.enabled} disabled={saving} onChange={(e) => patch(key, { enabled: e.target.checked })} />
                Enabled
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
              <span style={EYEBROW}>Who</span>
              {cfg.targetUserIds.map((id) => (
                <button key={id} type="button" onClick={() => patch(key, { targetUserIds: cfg.targetUserIds.filter((u) => u !== id) })} title="Remove" style={PILL}>
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
                <button type="button" onClick={() => setAddUserOpenFor(key)} style={DASHED}>
                  + add person
                </button>
              )}
              <span style={{ ...EYEBROW, marginLeft: '0.6rem' }}>Where</span>
              {cfg.surfaces.map((sKey) => (
                <button key={sKey} type="button" onClick={() => patch(key, { surfaces: cfg.surfaces.filter((s) => s !== sKey) })} title="Remove" style={PILL}>
                  {eggSurfaceLabel(sKey)} ×
                </button>
              ))}
              <button type="button" onClick={() => setScreenPickerFor(key)} style={DASHED}>
                + add screens
              </button>
              <button
                type="button"
                onClick={() => setTuningOpenFor(tuningOpen ? null : key)}
                aria-expanded={tuningOpen}
                style={{ ...DASHED, borderStyle: 'solid', marginLeft: 'auto' }}
              >
                {tuningOpen ? 'Hide tuning' : 'Tuning…'}
              </button>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent(EASTER_EGG_PREVIEW_EVENT, { detail: { key, config: cfg } }))}
                style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.6rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--bg-subtle)', color: 'var(--text-700)', cursor: 'pointer' }}
                title="Play a visit on this screen with the current sliders, skipping the dice roll"
              >
                Preview here now
              </button>
            </div>
            {tuningOpen ? (
              <div style={{ marginTop: '0.7rem', display: 'grid', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }}>
                <div style={{ display: 'grid', gap: '0.45rem' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                    <span style={EYEBROW}>The visit</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>how often, how long, how hard to catch — and how much faster he gets by evening (resets each day)</span>
                  </div>
                  {EASTER_EGG_KNOBS.filter((k) => k.group === 'tuning').map((k) => (
                    <KnobRow key={k.key} knob={k} value={knobValue(k)} disabled={saving} onChange={(v) => draftKnob(key, k, v)} onCommit={() => commitKnobs(key)} />
                  ))}
                </div>
                <div style={{ display: 'grid', gap: '0.45rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={EYEBROW}>Catch &amp; ring</span>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={cfg.catch.enabled} disabled={saving} onChange={(e) => patch(key, { catch: { ...cfg.catch, enabled: e.target.checked } })} />
                      on — press him to catch, a ring appears, pull back and let go
                    </label>
                  </div>
                  {EASTER_EGG_KNOBS.filter((k) => k.group === 'catch').map((k) => (
                    <KnobRow key={k.key} knob={k} value={knobValue(k)} disabled={saving || !cfg.catch.enabled} onChange={(v) => draftKnob(key, k, v)} onCommit={() => commitKnobs(key)} />
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <span>Aim preview is how much of the flight path the dotted arc shows — shorter is riskier. Ring width is the gap between the two ends he can bounce off.</span>
                  <button
                    type="button"
                    onClick={() => patch(key, { tuning: { ...EASTER_EGG_TUNING_DEFAULTS }, catch: { ...EASTER_EGG_CATCH_DEFAULTS, enabled: cfg.catch.enabled } })}
                    disabled={saving}
                    style={{ ...DASHED, marginLeft: 'auto', whiteSpace: 'nowrap' }}
                  >
                    Reset to defaults
                  </button>
                </div>
              </div>
            ) : null}
            {unreachable.length > 0 ? (
              <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'baseline', marginTop: '0.55rem', fontSize: '0.72rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber-soft)', borderRadius: 6, padding: '0.35rem 0.6rem' }}>
                <span aria-hidden="true">⚠</span>
                <span>
                  {unreachable
                    .slice(0, 3)
                    .map((u) => `${u.surface} is hidden for ${u.name}`)
                    .join(' · ')}
                  {unreachable.length > 3 ? ` · +${unreachable.length - 3} more` : ''} — {sprite.label} would never appear there for them. Harmless to keep.
                </span>
              </div>
            ) : null}
            {screenPickerFor === key ? (
              <EasterEggScreenPickerModal
                eggLabel={sprite.label}
                selected={cfg.surfaces}
                targets={targets}
                onChange={(next) => patch(key, { surfaces: next })}
                onClose={() => setScreenPickerFor(null)}
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
