/**
 * Sub compliance badges (RUN_SUBS_PLAN Phase 3, PR 3.3). Pure: takes a
 * person's contract documents and answers "is their paperwork in order" as a
 * badge set — signed agreement, current COI, W-9 on file, license when they
 * have one. Consumed by the Subs HQ tab; warn-never-block by design.
 */

export type ComplianceDocInput = {
  doc_type: string
  status: string
  expires_at: string | null
}

export type ComplianceBadgeState = 'ok' | 'expiring' | 'expired' | 'missing'

export type ComplianceBadge = {
  key: 'agreement' | 'coi' | 'w9' | 'license'
  state: ComplianceBadgeState
  label: string
}

/** Days before expires_at at which a document starts warning. */
export const COMPLIANCE_EXPIRING_DAYS = 30

const TYPE_LABEL: Record<ComplianceBadge['key'], string> = {
  agreement: 'Agreement',
  coi: 'COI',
  w9: 'W-9',
  license: 'License',
}

function daysUntil(ymd: string, todayYmd: string): number | null {
  const pa = todayYmd.split('-').map(Number)
  const pb = ymd.split('-').map(Number)
  if (pa.length !== 3 || pb.length !== 3 || pa.some(Number.isNaN) || pb.some(Number.isNaN)) return null
  const [ay, am, ad] = pa as [number, number, number]
  const [by, bm, bd] = pb as [number, number, number]
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

function expiryState(docs: ComplianceDocInput[], todayYmd: string): ComplianceBadgeState {
  // Best document wins: an unexpiring doc is ok; otherwise judge the latest expiry.
  if (docs.some((d) => !d.expires_at)) return 'ok'
  let best: number | null = null
  for (const d of docs) {
    const days = d.expires_at ? daysUntil(d.expires_at, todayYmd) : null
    if (days != null && (best == null || days > best)) best = days
  }
  if (best == null) return 'ok'
  if (best < 0) return 'expired'
  if (best <= COMPLIANCE_EXPIRING_DAYS) return 'expiring'
  return 'ok'
}

/**
 * Badges for one person. Agreement judges signature status (plus expiry when
 * set); COI/W-9 judge presence + expiry; License appears only when a license
 * document exists at all. `doc_type: 'other'` is ignored.
 */
export function buildSubComplianceBadges(docs: ComplianceDocInput[], todayYmd: string): ComplianceBadge[] {
  const byType = (t: string) => docs.filter((d) => d.doc_type === t)

  const badges: ComplianceBadge[] = []

  const agreements = byType('agreement')
  const signed = agreements.filter((d) => d.status === 'signed')
  if (signed.length === 0) {
    badges.push({ key: 'agreement', state: 'missing', label: `${TYPE_LABEL.agreement} missing` })
  } else {
    const state = expiryState(signed, todayYmd)
    badges.push({
      key: 'agreement',
      state,
      label: state === 'ok' ? `${TYPE_LABEL.agreement} signed` : `${TYPE_LABEL.agreement} ${state}`,
    })
  }

  for (const key of ['coi', 'w9'] as const) {
    const typeDocs = byType(key)
    if (typeDocs.length === 0) {
      badges.push({ key, state: 'missing', label: `${TYPE_LABEL[key]} missing` })
    } else {
      const state = expiryState(typeDocs, todayYmd)
      badges.push({
        key,
        state,
        label: state === 'ok' ? `${TYPE_LABEL[key]} ✓` : `${TYPE_LABEL[key]} ${state}`,
      })
    }
  }

  const licenses = byType('license')
  if (licenses.length > 0) {
    const state = expiryState(licenses, todayYmd)
    badges.push({
      key: 'license',
      state,
      label: state === 'ok' ? `${TYPE_LABEL.license} ✓` : `${TYPE_LABEL.license} ${state}`,
    })
  }

  return badges
}

export type PickerComplianceSummary = {
  state: 'ok' | 'warn' | 'bad' | 'none'
  label: string
}

/**
 * One compact chip for assignment/offer pickers (Phase 4, PR 4.6). Collapses
 * the badge set to the worst finding, and is WINDOW-AWARE when an end date is
 * given: a COI/license that is fine today but lapses before the proposed
 * window ends warns now — the failure would land mid-job.
 */
export function pickerComplianceSummary(
  docs: ComplianceDocInput[],
  todayYmd: string,
  windowEndYmd?: string | null,
): PickerComplianceSummary {
  if (docs.length === 0) return { state: 'none', label: 'nothing on file' }
  const badges = buildSubComplianceBadges(docs, todayYmd)

  const expired = badges.find((b) => b.state === 'expired')
  if (expired) return { state: 'bad', label: expired.label }
  const missing = badges.find((b) => b.state === 'missing')
  if (missing) return { state: 'bad', label: missing.label }

  // Window-aware: judge dated docs against the end of the proposed work.
  if (windowEndYmd) {
    for (const key of ['coi', 'license'] as const) {
      const dated = docs.filter((d) => d.doc_type === key && d.expires_at)
      if (dated.length === 0) continue
      const sorted = dated.map((d) => d.expires_at!).sort()
      const latest = sorted[sorted.length - 1]!
      if (latest < windowEndYmd) {
        return { state: 'warn', label: `${key === 'coi' ? 'COI' : 'License'} lapses before the window ends (${latest})` }
      }
    }
  }

  const expiring = badges.find((b) => b.state === 'expiring')
  if (expiring) return { state: 'warn', label: expiring.label }
  return { state: 'ok', label: 'compliant' }
}
