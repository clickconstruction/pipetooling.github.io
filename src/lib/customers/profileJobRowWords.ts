/**
 * The words beside a job on the customer's profile window (punch list #301, the screens traced on 2026-11-21).
 *
 * An open bill describes itself, whatever stage the job sits in: *billed Jun 20 · 155d*, red at 90 days. A bill on a
 * job an in-kind deal pays is scheduled, never late, so it reads *billed · scheduled in kind* with no day, no age and
 * no red. The window drew these words inline before; they are here so the rule has a test.
 */
import type { ProfileJobRowMoney } from './customerProfileStats'

const CENT = 0.005

/** A bill this old reads red on the row. */
export const PROFILE_JOB_ROW_LATE_DAYS = 90

export type ProfileJobRowMeta = {
  text: string
  /** `late` is red, `undated` amber, `quiet` the muted grey. */
  tone: 'late' | 'undated' | 'quiet'
  /** The dollars are drawn bold beside a late bill. */
  strong: boolean
}

const shortDay = (ymd: string): string => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

/** `stage` is the job's stage as the Dashboard words it, shown when no bill is open. */
export function profileJobRowMeta(m: ProfileJobRowMoney, stage: string): ProfileJobRowMeta {
  if (m.openBilled > CENT) {
    if (m.scheduledInKind) return { text: 'billed · scheduled in kind', tone: 'quiet', strong: false }
    if (m.noBillDate) return { text: 'billed · no date', tone: 'undated', strong: false }
    const late = m.ageDays != null && m.ageDays >= PROFILE_JOB_ROW_LATE_DAYS
    const text = `billed ${m.oldestOpenBillYmd ? shortDay(m.oldestOpenBillYmd) : ''}${m.ageDays != null ? ` · ${m.ageDays}d` : ''}`
    return { text, tone: late ? 'late' : 'quiet', strong: late }
  }
  return { text: m.unbilled > CENT ? `${stage} · unbilled` : stage, tone: 'quiet', strong: false }
}

/** The colour each tone draws in. */
export const PROFILE_JOB_ROW_TONE_COLOR: Record<ProfileJobRowMeta['tone'], string> = {
  late: 'var(--text-red-600)',
  undated: 'var(--text-amber-800)',
  quiet: 'var(--text-muted)',
}
