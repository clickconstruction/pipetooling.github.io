import type { EstimatorUser } from '../types/bidWithBuilder'

export function normalizeBidDateInput(value: string | null | undefined): string {
  if (value == null || !String(value).trim()) return ''
  return String(value).slice(0, 10)
}

export function wholeCalendarDaysSinceSentDate(sentDateYyyyMmDd: string): number {
  const s = normalizeBidDateInput(sentDateYyyyMmDd)
  if (!s) return 0
  const now = new Date()
  const todayUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const parts = s.split('-').map(Number)
  const y = parts[0]!
  const mo = parts[1]!
  const da = parts[2]!
  const sentUtc = new Date(Date.UTC(y, mo - 1, da))
  const ms = todayUtc.getTime() - sentUtc.getTime()
  return Math.max(0, Math.floor(ms / 86400000))
}

export function bidAttestationDisplayName(
  users: EstimatorUser[],
  userId: string | null | undefined,
): string {
  if (!userId) return 'Unknown'
  const u = users.find((x) => x.id === userId)
  return (u?.name?.trim() || u?.email || userId).slice(0, 120)
}
