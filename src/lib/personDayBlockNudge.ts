/**
 * One-tap ±30 nudges for the Manage-day modal's block rows (v2.1817): shift
 * the whole block, or grow/shrink its end, without opening the Edit form. The
 * modal feeds the result straight into the same save path Edit uses, so
 * linked-crew semantics (apply to every leg) come along for free.
 */

export const PERSON_DAY_NUDGE_STEP_MIN = 30

/** Day view's floor (v-era "a job can never shrink below 30 minutes"). */
export const PERSON_DAY_MIN_BLOCK_MIN = 30

export type PersonDayNudgeAction = 'shift-back' | 'shift-fwd' | 'end-back' | 'end-fwd'

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})/.exec(hhmm ?? '')
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

function toHHmm(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Apply a nudge to "HH:MM[:SS]" block times. Refusals come back as friendly
 * one-liners for a toast — a nudge never clamps silently (a block that lands
 * somewhere other than exactly ±30 from where the user saw it reads as a bug).
 */
export function nudgeScheduleBlockTimes(
  timeStart: string,
  timeEnd: string,
  action: PersonDayNudgeAction,
): { ok: true; timeStart: string; timeEnd: string } | { ok: false; error: string } {
  const start = toMinutes(timeStart)
  const end = toMinutes(timeEnd)
  if (start == null || end == null || end <= start) {
    return { ok: false, error: 'This block has unusual times — use Edit instead.' }
  }
  const step = PERSON_DAY_NUDGE_STEP_MIN
  const dayEnd = 23 * 60 + 59
  switch (action) {
    case 'shift-back': {
      if (start - step < 0) return { ok: false, error: 'Already at the start of the day.' }
      return { ok: true, timeStart: toHHmm(start - step), timeEnd: toHHmm(end - step) }
    }
    case 'shift-fwd': {
      if (end + step > dayEnd) return { ok: false, error: 'That would run past the end of the day.' }
      return { ok: true, timeStart: toHHmm(start + step), timeEnd: toHHmm(end + step) }
    }
    case 'end-back': {
      if (end - step - start < PERSON_DAY_MIN_BLOCK_MIN) {
        return { ok: false, error: `Blocks can't shrink below ${PERSON_DAY_MIN_BLOCK_MIN} minutes — use Edit or Remove.` }
      }
      return { ok: true, timeStart: toHHmm(start), timeEnd: toHHmm(end - step) }
    }
    case 'end-fwd': {
      if (end + step > dayEnd) return { ok: false, error: 'That would run past the end of the day.' }
      return { ok: true, timeStart: toHHmm(start), timeEnd: toHHmm(end + step) }
    }
  }
}
