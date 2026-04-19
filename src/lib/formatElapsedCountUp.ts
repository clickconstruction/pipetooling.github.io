/** Count-up duration: `m:ss` under one hour, else `h:mm:ss`. */
export function formatElapsedCountUp(elapsedMs: number): string {
  const s = Math.floor(elapsedMs / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }
  return `${m}:${String(sec).padStart(2, '0')}`
}

/** Elapsed since `certified_at` ISO; `—` if missing or invalid. */
export function formatWaitingLabelFromCertifiedAt(
  nowMs: number,
  certifiedAt: string | null | undefined,
): string {
  if (certifiedAt == null || certifiedAt === '') return '—'
  const t = Date.parse(certifiedAt)
  if (Number.isNaN(t)) return '—'
  return formatElapsedCountUp(Math.max(0, nowMs - t))
}
