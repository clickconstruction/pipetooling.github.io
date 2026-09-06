/**
 * Settings → Company → Defaults for everyone (T5-08 / Tier 5 X16, decision 19).
 * One row per switch; a select for everyone, field roles and office roles. Each device can
 * still override its own copy; this is what a fresh device starts on.
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

const selectStyle: React.CSSProperties = { font: 'inherit', fontSize: '0.85rem', padding: '0.25rem 0.4rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)' }

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

  return (
    <section id="settings-org-defaults" aria-label="Defaults for everyone" style={{ marginTop: '1rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.25rem' }}>Defaults for everyone</h3>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '70ch' }}>
        What a fresh phone or browser starts on. A role column beats Everyone; a device that has chosen for itself beats both. Leave a cell on
        "No default" and each device decides as it does today. Job Mode already has its own role default.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: 640 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
              <th style={{ padding: '0.35rem 0.5rem', fontWeight: 600 }}>Setting</th>
              <th style={{ padding: '0.35rem 0.5rem', fontWeight: 600 }}>Everyone</th>
              {(Object.keys(ORG_DEFAULT_ROLE_GROUPS) as OrgDefaultRoleGroup[]).map((g) => (
                <th key={g} style={{ padding: '0.35rem 0.5rem', fontWeight: 600 }} title={ORG_DEFAULT_ROLE_GROUPS[g].roles.join(', ')}>
                  {ORG_DEFAULT_ROLE_GROUPS[g].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ORG_DEFAULT_KEYS.map((key) => {
              const def = ORG_DEFAULTS[key]
              const options = orgDefaultOptions(def)
              return (
                <tr key={key} style={{ borderTop: '1px solid var(--border)', verticalAlign: 'top' }}>
                  <td style={{ padding: '0.45rem 0.5rem', maxWidth: 320 }}>
                    <div style={{ fontWeight: 600 }}>{def.label}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{def.hint}</div>
                  </td>
                  <td style={{ padding: '0.45rem 0.5rem' }}>
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
                  </td>
                  {(Object.keys(ORG_DEFAULT_ROLE_GROUPS) as OrgDefaultRoleGroup[]).map((g) => {
                    const gv = rows ? groupValue(key, g, rows) : ''
                    return (
                      <td key={g} style={{ padding: '0.45rem 0.5rem' }}>
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
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
