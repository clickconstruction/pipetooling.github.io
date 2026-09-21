/**
 * Settings → Company → Defaults for everyone (T5-08 / Tier 5 X16, decision 19).
 * One block per switch: its name and what it does at full width, then a select for everyone,
 * field roles and office roles beneath. Each device can still override its own copy; this is
 * what a fresh device starts on.
 *
 * Not a table: a select cannot shrink below its longest option, so three select columns beside
 * a text column squeezed the text into a ribbon and pushed Office roles off the page.
 */
import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import {
  ORG_DEFAULTS,
  ORG_DEFAULT_EVERYONE,
  ORG_DEFAULT_KEYS,
  ORG_DEFAULT_ROLE_GROUPS,
  groupValue,
  orgDefaultOptions,
  type OrgDefaultKey,
  type OrgDefaultRoleGroup,
  type OrgDefaultRow,
} from '../../lib/orgDefaults'
import { loadOrgDefaults, saveOrgDefault, subscribeOrgDefaults } from '../../lib/orgDefaultsStore'

const selectStyle: React.CSSProperties = { font: 'inherit', fontSize: '0.85rem', width: '100%', minWidth: 0, padding: '0.35rem 0.4rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)' }
const audienceLabelStyle: React.CSSProperties = { display: 'block', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.2rem' }
/** Three selects side by side while there is room; they stack on a phone. */
const audienceGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.6rem 0.75rem', marginTop: '0.6rem' }

export function SettingsOrgDefaultsSection() {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [rows, setRows] = useState<OrgDefaultRow[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    void loadOrgDefaults(true).then(setRows)
    return subscribeOrgDefaults(setRows)
  }, [])

  const save = async (key: OrgDefaultKey, target: OrgDefaultRoleGroup | typeof ORG_DEFAULT_EVERYONE, value: string) => {
    setBusy(`${key}:${target}`)
    const err = await saveOrgDefault(key, target, value, user?.id ?? null)
    setBusy(null)
    if (err) showToast(err, 'error')
    else showToast('Default saved — new devices start on it; a device that chose for itself keeps its choice.', 'success')
  }

  const everyoneValue = (key: OrgDefaultKey) => rows?.find((r) => r.key === key && r.role === ORG_DEFAULT_EVERYONE)?.value ?? ''
  const groups = Object.keys(ORG_DEFAULT_ROLE_GROUPS) as OrgDefaultRoleGroup[]

  return (
    <section id="settings-org-defaults" aria-label="Defaults for everyone" style={{ marginTop: '1rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem 1.25rem' }}>
      <h2 style={{ fontSize: '1.125rem', margin: '0 0 0.25rem' }}>Defaults for everyone</h2>
      <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '75ch' }}>
        What a fresh phone or browser starts on. A role default beats Everyone; a device that has chosen for itself beats both. Leave a setting on
        "No default" and each device decides as it does today. Job Mode already has its own role default.
      </p>
      {ORG_DEFAULT_KEYS.map((key) => {
        const def = ORG_DEFAULTS[key]
        const options = orgDefaultOptions(def)
        return (
          <div key={key} role="group" aria-label={def.label} style={{ borderTop: '1px solid var(--border)', marginTop: '0.9rem', paddingTop: '0.8rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{def.label}</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '75ch' }}>{def.hint}</div>
            <div style={audienceGridStyle}>
              <label style={{ minWidth: 0 }}>
                <span style={audienceLabelStyle}>Everyone</span>
                <select
                  value={everyoneValue(key)}
                  disabled={rows === null || busy === `${key}:*`}
                  onChange={(e) => void save(key, ORG_DEFAULT_EVERYONE, e.target.value)}
                  aria-label={`${def.label} — everyone`}
                  style={selectStyle}
                >
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              {groups.map((g) => {
                const gv = rows ? groupValue(key, g, rows) : ''
                return (
                  <label key={g} style={{ minWidth: 0 }} title={ORG_DEFAULT_ROLE_GROUPS[g].roles.join(', ')}>
                    <span style={audienceLabelStyle}>{ORG_DEFAULT_ROLE_GROUPS[g].label}</span>
                    <select
                      value={gv === 'mixed' ? '' : gv}
                      disabled={rows === null || busy === `${key}:${g}`}
                      onChange={(e) => void save(key, g, e.target.value)}
                      aria-label={`${def.label} — ${ORG_DEFAULT_ROLE_GROUPS[g].label}`}
                      style={selectStyle}
                    >
                      {options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.value === '' && gv === 'mixed' ? 'Mixed — set to unify' : o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}
    </section>
  )
}
