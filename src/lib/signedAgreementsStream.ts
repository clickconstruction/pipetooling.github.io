/**
 * Signed agreements stream (v2.2743): who is emailed when a customer accepts an estimate or a GC
 * signs a bid-room proposal, and whether the job is created automatically. The server twin of
 * the recipient rule is `signed_agreement_notify_recipients()` (migration 20260904020000).
 */
export const SIGNED_AGREEMENT_DEFAULT_ROLES = ['dev', 'master_technician', 'assistant', 'controller'] as const

/** Roles that receive the email when no explicit list is saved. */
export function isSignedAgreementDefaultRole(role: string | null | undefined): boolean {
  return role != null && (SIGNED_AGREEMENT_DEFAULT_ROLES as readonly string[]).includes(role)
}

/** JSON array of user ids; anything malformed reads as "no explicit list" (= role defaults). */
export function parseSignedAgreementRecipients(valueText: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse((valueText ?? '').trim() || '[]')
    if (!Array.isArray(parsed)) return []
    return [...new Set(parsed.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim()))]
  } catch {
    return []
  }
}

export function serializeSignedAgreementRecipients(ids: ReadonlyArray<string>): string {
  return JSON.stringify([...new Set(ids.map((x) => x.trim()).filter(Boolean))])
}

/** '1' / 'true' / 'on' → on; everything else (including missing) → off. */
export function parseAutoCreateFlag(valueText: string | null | undefined): boolean {
  const v = (valueText ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'on'
}

export function serializeAutoCreateFlag(on: boolean): string {
  return on ? '1' : '0'
}
