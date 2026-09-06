import type { UserRole } from '../hooks/useAuth'

/**
 * Org / role defaults (journey map Tier 5 X16, cluster C27; decision 19).
 *
 * Four switches lived only in each browser's localStorage — Mobile cards on Pipeline, payroll
 * auto-apply on Tally, the Stripe mode, and alert dismissals — so every fresh or wiped phone
 * started on the weaker state and nothing on the server knew what the company preferred.
 * Job Mode got a hard-coded role default in #26 (v2.2877); this generalises it: one small
 * `org_defaults(key, role, value)` table read at sign-in, merged **device → role → everyone →
 * fallback** — a device override still wins on that device. Alert dismissals move to a
 * per-user server store instead (they follow the person, not the browser).
 */

export type OrgDefaultKind = 'bool' | 'stripe_mode'

export type OrgDefaultDef = {
  key: OrgDefaultKey
  label: string
  hint: string
  kind: OrgDefaultKind
  /** What applies when neither the device nor the org has said anything. */
  fallback: string
}

export const ORG_DEFAULT_KEYS = ['jobs.stages.mobile_cards', 'tally.payroll_auto_apply', 'billing.stripe_mode'] as const
export type OrgDefaultKey = (typeof ORG_DEFAULT_KEYS)[number]

export const ORG_DEFAULTS: Record<OrgDefaultKey, OrgDefaultDef> = {
  'jobs.stages.mobile_cards': {
    key: 'jobs.stages.mobile_cards',
    label: 'Mobile cards on Pipeline',
    hint: 'Pipeline sections render as full-width cards instead of tables. With no default, phones under 560 px start on cards.',
    kind: 'bool',
    fallback: 'auto',
  },
  'tally.payroll_auto_apply': {
    key: 'tally.payroll_auto_apply',
    label: 'Payroll auto-apply on Tally',
    hint: 'Apply the payroll auto-mark rules as soon as the tally loads.',
    kind: 'bool',
    fallback: 'false',
  },
  'billing.stripe_mode': {
    key: 'billing.stripe_mode',
    label: 'Stripe mode',
    hint: 'Which Stripe account billing talks to. Live is the real one; test is for rehearsals.',
    kind: 'stripe_mode',
    fallback: 'live',
  },
}

/** `role = '*'` is the org-wide row; a role row overrides it. */
export const ORG_DEFAULT_EVERYONE = '*'

export type OrgDefaultRow = { key: string; role: string; value: string }

export type OrgDefaultRoleGroup = 'field' | 'office'
export const ORG_DEFAULT_ROLE_GROUPS: Record<OrgDefaultRoleGroup, { label: string; roles: UserRole[] }> = {
  field: { label: 'Field roles', roles: ['subcontractor', 'helpers', 'superintendent'] },
  office: { label: 'Office roles', roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary'] },
}

export type OrgDefaultSource = 'device' | 'role' | 'everyone' | 'fallback'

/** Pure: device → role → everyone → fallback. `deviceRaw` is the localStorage value, null when unset. */
export function resolveOrgDefault(
  key: OrgDefaultKey,
  role: UserRole | string | null | undefined,
  rows: ReadonlyArray<OrgDefaultRow> | null,
  deviceRaw: string | null | undefined,
): { value: string; source: OrgDefaultSource } {
  const def = ORG_DEFAULTS[key]
  if (deviceRaw != null && deviceRaw !== '' && isValidValue(def, deviceRaw)) return { value: deviceRaw, source: 'device' }
  if (rows) {
    const roleRow = role ? rows.find((r) => r.key === key && r.role === role) : undefined
    if (roleRow && isValidValue(def, roleRow.value)) return { value: roleRow.value, source: 'role' }
    const everyone = rows.find((r) => r.key === key && r.role === ORG_DEFAULT_EVERYONE)
    if (everyone && isValidValue(def, everyone.value)) return { value: everyone.value, source: 'everyone' }
  }
  return { value: def.fallback, source: 'fallback' }
}

export function isValidValue(def: OrgDefaultDef, value: string): boolean {
  if (def.kind === 'bool') return value === 'true' || value === 'false' || value === 'auto'
  return value === 'live' || value === 'test'
}

/** Bool keys resolve to on/off; 'auto' hands the decision back to the caller (e.g. the width gate). */
export function orgDefaultBool(value: string): boolean | null {
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

/** The options a Settings select offers for one key. */
export function orgDefaultOptions(def: OrgDefaultDef): Array<{ value: string; label: string }> {
  if (def.kind === 'bool') {
    return [
      { value: '', label: 'No default (each device decides)' },
      { value: 'true', label: 'On' },
      { value: 'false', label: 'Off' },
    ]
  }
  return [
    { value: '', label: 'No default (each device decides)' },
    { value: 'live', label: 'Live' },
    { value: 'test', label: 'Test' },
  ]
}

/** What one group of roles currently resolves to, for the Settings table. Mixed = the roles disagree. */
export function groupValue(key: OrgDefaultKey, group: OrgDefaultRoleGroup, rows: ReadonlyArray<OrgDefaultRow>): string | 'mixed' {
  const values = new Set(ORG_DEFAULT_ROLE_GROUPS[group].roles.map((r) => rows.find((x) => x.key === key && x.role === r)?.value ?? ''))
  if (values.size === 1) return [...values][0]!
  return 'mixed'
}
