/**
 * The Workflow page's Expected dates window: how it opens for a step, and how
 * its three fields — start, end, length in days — keep each other in line as
 * one of them is typed.
 *
 * Each `…Changed` function takes the fields as they stand and the value just
 * typed, and returns only the fields to set.
 *
 * The Forecast stage modal carries its own copy of the three handlers. It
 * differs in one place: there, a new start moves the end only when the length
 * is zero or more; here a negative length moves it too.
 */

import { ymdAddDays, ymdDaysBetween, ymdFromDateLike } from '../../utils/dateUtils'

export type ExpectedDatesFields = {
  expectedStart: string
  expectedEnd: string
  lengthDays: string
}

type StepForExpectedDates = {
  id: string
  scheduled_start_date?: string | null
  scheduled_end_date?: string | null
}

export type ExpectedDatesSeed = ExpectedDatesFields & {
  /** A step follows this one in the list. */
  hasNextStage: boolean
  /** The start shown is the previous step's end, because this step had none. */
  seededFromPrior: boolean
}

/**
 * The window's opening values. A step with no start of its own borrows the
 * previous step's expected end; the length is worked out from whichever start
 * is shown. Previous and next go by position in `steps`.
 */
export function seedExpectedDates<S extends StepForExpectedDates>(steps: ReadonlyArray<S>, step: S): ExpectedDatesSeed {
  const idx = steps.findIndex((s) => s.id === step.id)
  const prev = idx > 0 ? steps[idx - 1] : null
  const next = idx >= 0 && idx < steps.length - 1 ? steps[idx + 1] : null
  const currentStart = ymdFromDateLike(step.scheduled_start_date)
  const currentEnd = ymdFromDateLike(step.scheduled_end_date)
  const priorEnd = ymdFromDateLike(prev?.scheduled_end_date)
  const seededFromPrior = !currentStart && !!priorEnd
  const startVal = currentStart || priorEnd
  const length = startVal && currentEnd ? ymdDaysBetween(startVal, currentEnd) : null
  return {
    expectedStart: startVal,
    expectedEnd: currentEnd,
    lengthDays: length != null ? String(length) : '',
    hasNextStage: !!next,
    seededFromPrior,
  }
}

/** A new start keeps the length and moves the end; with no length, it re-counts the length to the end. */
export function expectedStartChanged(current: ExpectedDatesFields, value: string): Partial<ExpectedDatesFields> {
  const len = current.lengthDays.trim()
  const lenNum = len === '' ? NaN : Number(len)
  if (value && len !== '' && Number.isFinite(lenNum)) {
    return { expectedStart: value, expectedEnd: ymdAddDays(value, lenNum) }
  } else if (value && current.expectedEnd) {
    const newLen = ymdDaysBetween(value, current.expectedEnd)
    return { expectedStart: value, lengthDays: newLen != null ? String(newLen) : '' }
  } else {
    return { expectedStart: value }
  }
}

/** A new end re-counts the length from the start. */
export function expectedEndChanged(current: ExpectedDatesFields, value: string): Partial<ExpectedDatesFields> {
  if (value && current.expectedStart) {
    const newLen = ymdDaysBetween(current.expectedStart, value)
    return { expectedEnd: value, lengthDays: newLen != null ? String(newLen) : '' }
  } else {
    return { expectedEnd: value }
  }
}

/** A new length moves the end from the start. What was typed is kept as typed, readable or not. */
export function expectedLengthChanged(current: ExpectedDatesFields, value: string): Partial<ExpectedDatesFields> {
  const trimmed = value.trim()
  if (trimmed === '') {
    return { lengthDays: '' }
  }
  const num = Number(trimmed)
  if (!Number.isFinite(num)) {
    return { lengthDays: value }
  }
  if (current.expectedStart) {
    return { lengthDays: value, expectedEnd: ymdAddDays(current.expectedStart, num) }
  } else {
    return { lengthDays: value }
  }
}

/** What the window warns about: a length that is not a number or is below zero, an end before its start. */
export function expectedDatesProblems(current: ExpectedDatesFields): { lengthInvalid: boolean; endBeforeStart: boolean } {
  const lengthNum = current.lengthDays.trim() === '' ? null : Number(current.lengthDays)
  const lengthInvalid = current.lengthDays.trim() !== '' && (!Number.isFinite(lengthNum ?? NaN) || (lengthNum != null && lengthNum < 0))
  const endBeforeStart = !!current.expectedStart && !!current.expectedEnd && (ymdDaysBetween(current.expectedStart, current.expectedEnd) ?? 0) < 0
  return { lengthInvalid, endBeforeStart }
}
