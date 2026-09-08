/**
 * The People board on a phone (v2.3156).
 *
 * On a phone the Schedule Dispatch People tab renders as a board — one day at
 * a time, a card per tech — instead of the desktop week grid. This kernel
 * holds the pure parts: the day strip, what a tech card says while something
 * is being placed on it, the mode bar's wording, short time ranges, and the
 * per-device "phone board vs desktop grid" preference. The component
 * (`HubPeoplePhoneBoard`) only lays these out and forwards taps to the page's
 * existing callbacks.
 */

// ---------------------------------------------------------------------------
// Per-device view preference
// ---------------------------------------------------------------------------

export type PhonePeopleView = 'board' | 'grid'

/** localStorage key (same pattern as the People sort preference). */
export const PHONE_PEOPLE_VIEW_STORAGE_KEY = 'pipetooling_dispatch_people_phone_view_v1'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export function readPhonePeopleView(storage: StorageLike | null | undefined): PhonePeopleView {
  try {
    return storage?.getItem(PHONE_PEOPLE_VIEW_STORAGE_KEY) === 'grid' ? 'grid' : 'board'
  } catch {
    return 'board'
  }
}

export function writePhonePeopleView(storage: StorageLike | null | undefined, view: PhonePeopleView): void {
  try {
    storage?.setItem(PHONE_PEOPLE_VIEW_STORAGE_KEY, view)
  } catch {
    /* private mode / blocked storage — the choice just doesn't stick */
  }
}

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

/** 'HH:MM' or 'HH:MM:SS' → minutes since midnight; null when unparseable. */
export function timeToMinutes(t: string | null | undefined): number | null {
  if (!t) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 24 || min > 59) return null
  return h * 60 + min
}

function shortClock(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return m === 0 ? String(h12) : `${h12}:${String(m).padStart(2, '0')}`
}

/** "8–12", "12–4", "8:30–12" — the card's time column. A dash when either end is missing. */
export function formatShortRange(startMinutes: number | null, endMinutes: number | null): string {
  if (startMinutes == null || endMinutes == null) return '—'
  return `${shortClock(startMinutes)}–${shortClock(endMinutes)}`
}

/** "12:00 PM–4:00 PM" style, for places where the range is the whole message. */
export function formatLongRange(startMinutes: number | null, endMinutes: number | null): string {
  if (startMinutes == null || endMinutes == null) return 'all day'
  const f = (m: number) => {
    const h24 = Math.floor(m / 60) % 24
    const mm = String(m % 60).padStart(2, '0')
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12
    return `${h12}:${mm} ${h24 < 12 ? 'AM' : 'PM'}`
  }
  return `${f(startMinutes)}–${f(endMinutes)}`
}

export function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

/** Where a block sits on a 6 AM–6 PM ribbon, in percent (clamped). */
export function ribbonSpan(startMinutes: number | null, endMinutes: number | null): { leftPct: number; widthPct: number } | null {
  if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) return null
  const RIBBON_START = 6 * 60
  const RIBBON_END = 18 * 60
  const span = RIBBON_END - RIBBON_START
  const s = Math.max(RIBBON_START, Math.min(RIBBON_END, startMinutes))
  const e = Math.max(RIBBON_START, Math.min(RIBBON_END, endMinutes))
  if (e <= s) return null
  return { leftPct: ((s - RIBBON_START) / span) * 100, widthPct: ((e - s) / span) * 100 }
}

// ---------------------------------------------------------------------------
// Day strip
// ---------------------------------------------------------------------------

export type DayStripCounts = { blocks: number; missingNotes: number }

export type DayStripItem = {
  ymd: string
  /** 'Mon' … 'Sun' in the company calendar. */
  weekday: string
  dayNumber: number
  isToday: boolean
  isSelected: boolean
  blocks: number
  missingNotes: number
  /** "6 blocks" · "5 · 2 no note" · "—" */
  caption: string
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** The weekday of a 'YYYY-MM-DD' without timezone drift (UTC noon trick). */
export function weekdayOfYmd(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`)
  return WEEKDAY_SHORT[d.getUTCDay()] ?? ''
}

export function dayStripCaption(c: DayStripCounts | undefined): string {
  if (!c || c.blocks === 0) return '—'
  const base = `${c.blocks} block${c.blocks === 1 ? '' : 's'}`
  return c.missingNotes > 0 ? `${c.blocks} · ${c.missingNotes} no note` : base
}

export function buildDayStrip(args: {
  weekYmds: readonly string[]
  todayYmd: string
  selectedYmd: string
  countsByYmd: ReadonlyMap<string, DayStripCounts>
}): DayStripItem[] {
  return args.weekYmds.map((ymd) => {
    const c = args.countsByYmd.get(ymd)
    return {
      ymd,
      weekday: weekdayOfYmd(ymd),
      dayNumber: Number(ymd.slice(8, 10)),
      isToday: ymd === args.todayYmd,
      isSelected: ymd === args.selectedYmd,
      blocks: c?.blocks ?? 0,
      missingNotes: c?.missingNotes ?? 0,
      caption: dayStripCaption(c),
    }
  })
}

/** Which day the board opens on: the focused day if it is in the week, else today if in the week, else the week's first day. */
export function initialBoardYmd(args: { weekYmds: readonly string[]; todayYmd: string; preferredYmd?: string | null }): string {
  if (args.preferredYmd && args.weekYmds.includes(args.preferredYmd)) return args.preferredYmd
  if (args.weekYmds.includes(args.todayYmd)) return args.todayYmd
  return args.weekYmds[0] ?? args.todayYmd
}

// ---------------------------------------------------------------------------
// Placement modes → what a tech card says
// ---------------------------------------------------------------------------

export type PhonePlacementKind = 'copy' | 'move' | 'add-job' | 'linked-apply' | 'multi-cell'

export type PhonePlacementMode = {
  kind: PhonePlacementKind
  /** "J927 · Mike Holub" — the block being copied / moved, or the job being added. */
  label: string
  startMinutes: number | null
  endMinutes: number | null
  /** People who already hold the block(s) being copied — never a target. Empty for move / add-job / multi-cell. */
  sourceUserIds: ReadonlySet<string>
  /** Copies land linked (a crew that moves together). */
  linked?: boolean
  /** linked-apply: how many blocks are being copied. */
  count?: number
}

export type CardTargetState = {
  tone: 'free' | 'busy' | 'source' | 'selected'
  /** The big line: "Tap to add J927 · 12–4 here". */
  what: string
  /** The small line: why it is free / busy / the source. */
  why: string
  /** False for the source tech in a copy — tapping would copy onto themselves. */
  tappable: boolean
}

export type CardBlockSummary = { label: string; startMinutes: number | null; endMinutes: number | null }

function modeRange(mode: PhonePlacementMode): string {
  return formatShortRange(mode.startMinutes, mode.endMinutes)
}

function verbFor(mode: PhonePlacementMode): string {
  return mode.kind === 'move' ? 'move' : 'add'
}

/** The line a tech card shows while a placement mode is active. */
export function cardTargetState(args: {
  mode: PhonePlacementMode
  userId: string
  dayBlocks: readonly CardBlockSummary[]
  notComingIn?: boolean
  /** multi-cell: this tech/day is already in the selection. */
  multiSelected?: boolean
}): CardTargetState {
  const { mode } = args
  const range = modeRange(mode)

  if (mode.kind === 'multi-cell') {
    return args.multiSelected
      ? { tone: 'selected', what: 'Selected · tap to take it off', why: 'Choose the job from the bar below when you have every tech and day.', tappable: true }
      : { tone: 'free', what: 'Tap to add this tech and day', why: 'Pick more days from the strip; the job comes last.', tappable: true }
  }

  if (mode.sourceUserIds.has(args.userId)) {
    return { tone: 'source', what: `Already on ${mode.label}${range === '—' ? '' : ` ${range}`}`, why: "This is the block you're copying.", tappable: false }
  }

  const what = range === '—' ? `Tap to ${verbFor(mode)} ${mode.label} here` : `Tap to ${verbFor(mode)} ${mode.label} · ${range} here`

  const clash =
    mode.startMinutes != null && mode.endMinutes != null
      ? args.dayBlocks.find(
          (b) => b.startMinutes != null && b.endMinutes != null && intervalsOverlap(mode.startMinutes as number, mode.endMinutes as number, b.startMinutes, b.endMinutes),
        )
      : undefined
  if (clash) {
    return {
      tone: 'busy',
      what: `Busy ${formatShortRange(clash.startMinutes, clash.endMinutes)} · ${clash.label}`,
      why: "Tap anyway to overlap — you'll get an Undo.",
      tappable: true,
    }
  }
  if (args.notComingIn) {
    return { tone: 'busy', what: 'Not coming in today', why: 'Tap anyway to schedule them regardless.', tappable: true }
  }
  const others = args.dayBlocks.filter((b) => b.startMinutes != null && b.endMinutes != null)
  const why =
    others.length === 0
      ? 'Nothing scheduled this day'
      : `Also on ${others.map((b) => `${b.label} ${formatShortRange(b.startMinutes, b.endMinutes)}`).join(', ')}`
  return { tone: 'free', what, why, tappable: true }
}

/** The dark bar above the tab bar. */
export function modeBarText(mode: PhonePlacementMode): { text: string; suffix: string | null } {
  const range = modeRange(mode)
  const withRange = range === '—' ? mode.label : `${mode.label} · ${range}`
  switch (mode.kind) {
    case 'copy':
      return { text: `Copying ${withRange} to…`, suffix: mode.linked ? 'linked' : 'not linked' }
    case 'move':
      return { text: `Moving ${withRange} to…`, suffix: null }
    case 'add-job':
      return { text: `Adding ${mode.label} to…`, suffix: null }
    case 'linked-apply':
      return {
        text: mode.count && mode.count > 1 ? `Copying ${mode.count} blocks to… · tap each tech` : `Copying ${withRange} to… · tap each tech`,
        suffix: 'linked',
      }
    case 'multi-cell':
      return { text: 'Tap each tech and day to fill, then choose the job', suffix: null }
  }
}

// ---------------------------------------------------------------------------
// Card chrome
// ---------------------------------------------------------------------------

/** "2 people · 3 blocks" under a team band. */
export function teamBandCaption(people: number, blocks: number): string {
  return `${people} ${people === 1 ? 'person' : 'people'} · ${blocks} block${blocks === 1 ? '' : 's'}`
}

/** "linked with Paige" / "linked with Paige, Marcus" — the crew-mates on a shared block, never the person themself. */
export function linkedWithCaption(crewNames: readonly string[], selfName: string): string | null {
  const others = crewNames.filter((n) => n !== selfName)
  if (others.length === 0) return null
  return `linked with ${others.join(', ')}`
}

/** "free 12–4" / "busy 8–5" beside a person in the Copy to techs list. */
export function availabilityLabel(args: { window: { startMinutes: number | null; endMinutes: number | null }; dayBlocks: readonly CardBlockSummary[] }): { text: string; free: boolean } {
  const { startMinutes, endMinutes } = args.window
  if (startMinutes == null || endMinutes == null) {
    return args.dayBlocks.length === 0 ? { text: 'free all day', free: true } : { text: `${args.dayBlocks.length} block${args.dayBlocks.length === 1 ? '' : 's'}`, free: true }
  }
  const clash = args.dayBlocks.find((b) => b.startMinutes != null && b.endMinutes != null && intervalsOverlap(startMinutes, endMinutes, b.startMinutes, b.endMinutes))
  if (clash) return { text: `busy ${formatShortRange(clash.startMinutes, clash.endMinutes)}`, free: false }
  return { text: args.dayBlocks.length === 0 ? 'free all day' : `free ${formatShortRange(startMinutes, endMinutes)}`, free: true }
}
