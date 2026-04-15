import type { DispatchSecondaryBand } from '@/components/schedule/DispatchAddBlockTimeRange'
import {
  DISPATCH_ADD_BLOCK_SLOT_COUNT,
  dispatchMinutesToSlotIndex,
  MAX_MIN,
  MIN_MIN,
} from '@/lib/dispatchAddBlockTime'
import { APP_CALENDAR_TZ, denverCalendarDayKey } from '@/utils/dateUtils'

export type ClockSessionForDispatchBand = {
  id: string
  user_id: string
  clocked_in_at: string
  clocked_out_at: string | null
  job_ledger_id: string | null
  bid_id: string | null
  notes: string | null
}

function instantToMinutesFromMidnightInZone(iso: string, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  })
  const parts = dtf.formatToParts(new Date(iso))
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0
  return h * 60 + m
}

function formatClockTimeLabel(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

function associationLabel(
  s: ClockSessionForDispatchBand,
  jobTitleById: Map<string, string>,
  bidTitleById: Map<string, string>,
): string {
  if (s.job_ledger_id) {
    const t = jobTitleById.get(s.job_ledger_id)?.trim()
    if (t) return t
  }
  if (s.bid_id) {
    const t = bidTitleById.get(s.bid_id)?.trim()
    if (t) return t
  }
  return 'No job'
}

/**
 * Maps clock_sessions to dispatch strip bands (4:00–20:00 Central, 30m slots).
 * Open punch: end = now in zone if workDate is today, else bar runs through MAX_MIN.
 */
export function clockSessionsToDispatchSecondaryBands(
  sessions: ClockSessionForDispatchBand[],
  workDateYmd: string,
  nowMs: number,
  jobTitleById: Map<string, string>,
  bidTitleById: Map<string, string>,
): DispatchSecondaryBand[] {
  const todayYmd = denverCalendarDayKey(nowMs)
  const out: DispatchSecondaryBand[] = []

  for (const s of sessions) {
    const startRaw = instantToMinutesFromMidnightInZone(s.clocked_in_at, APP_CALENDAR_TZ)
    let endRaw: number
    if (s.clocked_out_at) {
      endRaw = instantToMinutesFromMidnightInZone(s.clocked_out_at, APP_CALENDAR_TZ)
    } else if (workDateYmd === todayYmd) {
      endRaw = instantToMinutesFromMidnightInZone(new Date(nowMs).toISOString(), APP_CALENDAR_TZ)
    } else {
      endRaw = MAX_MIN
    }

    const lo0 = Math.min(startRaw, endRaw)
    const hi0 = Math.max(startRaw, endRaw)
    const a = Math.max(lo0, MIN_MIN)
    const b = Math.min(hi0, MAX_MIN)
    if (b <= a) continue

    let startSlotIndex = dispatchMinutesToSlotIndex(a)
    let endSlotIndex = dispatchMinutesToSlotIndex(b)
    if (endSlotIndex < startSlotIndex) {
      const t = startSlotIndex
      startSlotIndex = endSlotIndex
      endSlotIndex = t
    }
    const maxSlot = DISPATCH_ADD_BLOCK_SLOT_COUNT - 1
    if (endSlotIndex === startSlotIndex) {
      if (startSlotIndex < maxSlot) {
        endSlotIndex = startSlotIndex + 1
      } else if (startSlotIndex > 0) {
        startSlotIndex = startSlotIndex - 1
      }
    }

    const inLabel = formatClockTimeLabel(s.clocked_in_at, APP_CALENDAR_TZ)
    const outLabel = s.clocked_out_at
      ? formatClockTimeLabel(s.clocked_out_at, APP_CALENDAR_TZ)
      : workDateYmd === todayYmd
        ? formatClockTimeLabel(new Date(nowMs).toISOString(), APP_CALENDAR_TZ)
        : 'no clock out (past day)'
    const assoc = associationLabel(s, jobTitleById, bidTitleById)
    const noteTrim = (s.notes ?? '').trim()
    const displayLabel = noteTrim ? `${assoc} · ${noteTrim}` : assoc
    const label = `${inLabel}–${outLabel} · ${assoc}${noteTrim ? ` · ${noteTrim}` : ''}`

    out.push({
      id: s.id,
      startSlotIndex,
      endSlotIndex,
      label,
      displayLabel,
      sessionUserId: s.user_id,
    })
  }

  return out
}
