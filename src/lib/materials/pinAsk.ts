/**
 * Pins as a side effect (punch list #372, step 3): after a count, a photo, a signed-in scan of the label and a new
 * box, the box screen asks once, *Pin A7 where you stand?*, with one press. Those are the four moments a person is
 * known to stand at the box. Pinning as a press of its own was live for weeks and no box was pinned, so the ask comes
 * to the person instead.
 *
 * The rules:
 * - Asked only of a live cage, box or pile with no pin, or with a pin older than `PIN_ASK_AFTER_DAYS`.
 * - Never twice in a day for one box on one device, whatever the person answers.
 * - The press takes one reading and holds it to I found it's rule (`foundVerdict` in `whereIsBox.ts`).
 *
 * Pure but for the two small memories at the foot, which take the storage handed in so a test hands a map.
 */
import type { Container } from './onSite'
import { boxIsPinned, boxPinAgeDays } from './whereIsBox'

/** A pin this old is asked for again: the person is standing at the box, and a week is long on a site. */
export const PIN_ASK_AFTER_DAYS = 7

export const PIN_ASK_PRESS = 'Pin it here'
export const PIN_ASK_LATER_PRESS = 'Not now'
export const PIN_ASK_WHY = 'The next person who looks for it starts from your pin.'

export function pinAskWords(label: string): string {
  return `Pin ${label} where you stand?`
}

/** Does this box want a pin, or a fresher one? */
export function boxWantsPin(box: Pick<Container, 'kind' | 'retiredAt' | 'lat' | 'lng' | 'pinnedAt'>, now: Date): boolean {
  if (box.kind === 'unsorted' || box.retiredAt) return false
  if (!boxIsPinned(box)) return true
  const days = boxPinAgeDays(box, now)
  // A pin from before the day was kept is asked for once more, so it gets its day.
  return days == null || days > PIN_ASK_AFTER_DAYS
}

type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem?(k: string): void }

function local(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}
function session(): Store | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

export const PIN_ASK_KEY = 'pt.box.pinAsked'
/** How many boxes the day's memory holds before the oldest go: a long day on a big site. */
const PIN_ASK_KEEP = 200

/** The boxes asked on this device on this day. A stored day that is not today reads as none. */
function askedOn(s: Store | null, todayYmd: string): string[] {
  try {
    const raw = s?.getItem(PIN_ASK_KEY)
    if (!raw) return []
    const v = JSON.parse(raw) as { day?: unknown; ids?: unknown }
    return v.day === todayYmd && Array.isArray(v.ids) ? v.ids.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function pinAskedToday(boxId: string, todayYmd: string, s: Store | null = local()): boolean {
  return askedOn(s, todayYmd).includes(boxId)
}

export function rememberPinAsk(boxId: string, todayYmd: string, s: Store | null = local()): void {
  try {
    const ids = askedOn(s, todayYmd).filter((x) => x !== boxId)
    s?.setItem(PIN_ASK_KEY, JSON.stringify({ day: todayYmd, ids: [...ids, boxId].slice(-PIN_ASK_KEEP) }))
  } catch {
    /* a device that keeps nothing asks again, which is the smaller harm */
  }
}

/**
 * May the box screen ask now? The box wants a pin and this device has not asked about it today. A yes is remembered
 * at once, so the ask is never drawn twice in a day whatever becomes of it.
 */
export function takePinAsk(box: Pick<Container, 'id' | 'kind' | 'retiredAt' | 'lat' | 'lng' | 'pinnedAt'>, now: Date, todayYmd: string, s: Store | null = local()): boolean {
  if (!boxWantsPin(box, now) || pinAskedToday(box.id, todayYmd, s)) return false
  rememberPinAsk(box.id, todayYmd, s)
  return true
}

export const SCANNED_BOX_KEY = 'pt.box.scanned'

/** A label's code just opened this box (`BoxCode.tsx`): kept for the tab that opens next, in this browser tab alone. */
export function noteScannedBox(boxId: string, s: Store | null = session()): void {
  try {
    s?.setItem(SCANNED_BOX_KEY, boxId)
  } catch {
    /* no memory, no ask */
  }
}

/** The box a scan just opened, read once: the next read answers null. */
export function takeScannedBox(s: Store | null = session()): string | null {
  try {
    const v = s?.getItem(SCANNED_BOX_KEY) ?? null
    if (v) s?.removeItem?.(SCANNED_BOX_KEY)
    return v
  } catch {
    return null
  }
}
