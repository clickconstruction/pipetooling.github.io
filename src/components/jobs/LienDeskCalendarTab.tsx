import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import {
  LIEN_CALENDAR_KEY,
  groupPayYmd,
  kindsQueue,
  lienCalendarAxis,
  lienCalendarMarks,
  lienGroupLine,
  lienNoHoursChip,
  promiseConsequence,
  rowWord,
  whoseWordOptions,
  workMarkFor,
  type LienCalendarAxis,
  type LienCalendarGroup,
  type LienCalendarJob,
  type LienCalendarKeyEntry,
  type LienCalendarKeyGlyph,
  type LienCalendarMark,
} from '../../lib/jobs/lienCalendar'
import { LienJobNumber } from './LienJobNumber'
import { buildLienCalendarBoard, LIEN_WORKED_LATER, LIEN_WORKED_LATER_TITLE, lienGroupRows, lienNextDateCounts, lienPhoneLine, lienWorkedLaterLabel, type LienCalendarBoard, type LienCalendarBucket, type LienCalendarBucketKey, type LienNextDateCount, type LienPropertyTally } from '../../lib/jobs/lienCalendarBuckets'
import type { LienRunwayTone } from '../../lib/jobs/lienPayRunway'
import { formatMoneyShortK } from '../../lib/formatMoneyShortK'
import { payDateShortcuts } from '../../lib/jobs/gcWordPromise'
import { addJobPaymentPromise, addJobPaymentPromisesSettled } from '../../lib/jobs/paymentChaseIo'
import { savePropertyKind } from '../../lib/jobs/propertyKindWrite'
import { normalizePropertyKind, type PropertyKind } from '../../lib/jobs/propertyKind'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { formatErrorMessage } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import PropertyKindSwitch from './PropertyKindSwitch'
import { Store } from 'lucide-react'
import { LienSupplierMarkLine } from './LienJobSuppliers'
import type { LienSupplierMark } from '../../lib/jobs/lienJobSuppliers'
import { LienMarkHoverCard, type LienMarkCardView } from './LienMarkHoverCard'
import { EmptyState } from '../EmptyState'
import { LIEN_CALENDAR_EMPTY, lienCalendarSearchEmptyWords } from '../../lib/jobs/lienDeskEmptyWords'
import { lienMarkCard, lienMarkClusters, type LienMarkCard, type LienMarkCardDoor, type LienMarkDoors } from '../../lib/jobs/lienMarkCards'
import { LIEN_BILLED_AGE_NONE_TITLE, lienLaterLines, type LienBilledAgeTone, type LienLaterLine } from '../../lib/jobs/lienBilledAge'

/**
 * The Lien desk's Calendar tab (v2.4101 the shell; v2.4152 the body — punch
 * list #56 PR C): every billed and collections job on one shared axis with
 * Texas's 15ths as the columns. The first fold is a to-do the columns write;
 * under it the key, the density strip (what lands on each 15th), then the
 * rows — a GC row with its flags counted, its jobs beneath with the pay dot,
 * every unpaid month's hollow notice flag, the lien flag, the run between
 * and the kind bracket. One today line runs down the whole board. On a
 * phone there is no axis: three column cards, then two-line sentences.
 * Every mark and word comes from lib/jobs/lienCalendar.ts. The pen (PR D,
 * v2.4153): the pay dot opens "They said…" in place with the consequence
 * read back before Save, the GC row's one dot writes the GC's word for all
 * its jobs, a density bar leads the to-do, and the to-do's doors act.
 * v2.4265: every row starts at its work tick (the day the dates were counted
 * from — hollow and amber when it is the creation day), a dead row goes grey
 * past the day its lien died, a job row's words say only what its GC row does
 * not, the dashed dot sits on the GC row alone, and the key is a strip of
 * marks with a few words each — the long words open on a tap.
 * v2.4270 (the visual pass): two inks — notice flags amber, lien flags slate,
 * carried by the column headers and the GC row's counts; every mark stands on
 * one baseline; the work tick is short and its stand-in whispers; rows
 * alternate a faint tint instead of a hairline.
 * v2.4340 (the refresh): the to-do, the density strip and the summary line
 * gave way to one row of pills — All, Overdue, This month, Next month, Later,
 * each job counted once at its next date (lib/jobs/lienCalendarBuckets.ts) —
 * and the board is those buckets as sections: Overdue folded at the top, This
 * month with Draft the N on its bar. The 15ths carry their counts on the date
 * row, where the search now sits; the key is one line at the bottom.
 * v2.5531 (the hover cards): every mark's browser tooltip gave way to a card
 * (LienMarkHoverCard over lib/jobs/lienMarkCards.ts) that opens a beat into a
 * hover or on focus: what the mark is, when, the money, the board's door. Marks
 * that touch share one card, a column per mark; a GC row's folded flag lists
 * its jobs; a card wider than the track scrolls sideways; Esc closes it
 * wherever the focus is.
 * v2.7254 (three levels that read as three): every bucket is a tinted band with
 * a rail, its date in a pill and its count at the right; a group is one quiet
 * line with a hairline after it, its counts in its words and no lane of its own
 * (the GC's word is a press on the line); Later is a list, one line a job with
 * the days since its oldest open bill (lib/jobs/lienBilledAge.ts), oldest first,
 * and starts folded on every width; "Nov · no hours" is a chip beside the name.
 */

export type LienDeskCalendarTabProps = {
  /** Null while the Pipeline reads its billed jobs and their clocks: the tab says so instead of counting 0 jobs (v2.4321). */
  rows: ReadonlyArray<LienCalendarJob> | null
  todayYmd: string
  onOpenJob: (jobId: string) => void
  /** The job number opens the job itself (v2.4531): the Job window, with its history and Edit. Left out, the number is plain. */
  onOpenJobWindow?: (jobId: string) => void
  /** The last-day label at the start of a row's bar (v2.4735): the Lien window with the last day's line editing. Left out, the label is plain. */
  onOpenLastWork?: (jobId: string) => void
  /** Phone: no axis, the column cards and the sentences instead. */
  isMobile?: boolean
  /** Office roles write; everyone else reads (the dot opens the Lien window instead). */
  canWrite?: boolean
  /** Draft the N: the desk narrows its notice list to these jobs. */
  onDraft?: (ymd: string, jobIds: string[]) => void
  /** Record the mailing (v2.5522): the desk opens the run on recording for these printed notices. */
  onRecord?: (jobIds: string[]) => void
  /** Set property kind on a job with no linked property record — Edit Job on the Property record row. */
  onOpenEditJob?: (jobId: string) => void
  /** The pen wrote something: a promise, or a property kind. */
  onChanged?: (what: 'promise' | 'kind' | 'last_work') => void
  /** Jobs where a supply house is still owed (v2.4404): the row shows a storefront and the money. */
  supplierMarks?: ReadonlyMap<string, LienSupplierMark>
}

/** A GC can sit in two buckets, so a group's pen names its bucket too (`scope`). */
type PenTarget = { kind: 'job'; job: LienCalendarJob; pct: number } | { kind: 'group'; group: LienCalendarGroup; pct: number; scope: string }
type BoardPick = LienCalendarBucketKey | 'all'


const TONE: Record<LienRunwayTone, string> = {
  green: 'var(--text-green-700)',
  amber: 'var(--text-amber-800)',
  red: 'var(--text-red-700)',
  grey: 'var(--text-muted)',
}
/** Two inks for two deadlines (v2.4270): a notice is a letter — amber; a lien is a filing — slate. Red is the week's warning on either. */
const NOTICE_INK = '#d97706'
const LIEN_INK = 'var(--text-700)'
const RED_INK = '#b91c1c'
const GREEN_INK = '#15803d'
/** v2.5522: the in-the-mail circle — amber, the colour of a notice still owed. */
const MAILED_INK = '#d97706'
function noticeInk(tone: LienRunwayTone): string {
  return tone === 'red' ? RED_INK : tone === 'green' ? GREEN_INK : NOTICE_INK
}
function lienInk(tone: LienRunwayTone): string {
  return tone === 'red' ? RED_INK : tone === 'green' ? GREEN_INK : LIEN_INK
}
const HATCH = 'repeating-linear-gradient(135deg, #fca5a5 0 3px, var(--bg-red-tint) 3px 6px)'
const STRIPE = 'repeating-linear-gradient(90deg, #fcd34d 0 4px, #fef3c7 4px 8px)'
const LABEL_W = 'minmax(0, 300px)'
const RIGHT_W = '11rem'
const GRID: CSSProperties = { display: 'grid', gridTemplateColumns: `${LABEL_W} minmax(0, 1fr) ${RIGHT_W}`, alignItems: 'center' }
const ROW_H = 48
const TRACK_H = 40
/** One baseline per row: the track line, where every pole ends and every tick and dot sits. */
const LINE_Y = 26
const FLAG_H = LINE_Y - 8

/** The glyphs, drawn once for the key and once per row — the same shapes the runway draws (v2.4051). */
function Glyph({ kind, tone = 'amber', count }: { kind: LienCalendarKeyGlyph | 'notice_done'; tone?: LienRunwayTone; count?: number }): ReactNode {
  const flag = kind === 'lien' ? lienInk(tone) : noticeInk(tone)
  switch (kind) {
    case 'today':
      return <span style={{ display: 'inline-block', width: 2, height: 16, background: 'var(--text-strong)' }} />
    case 'work':
      return <span style={{ display: 'inline-block', width: 2, height: 10, background: 'var(--text-muted)' }} />
    case 'work_hollow':
      return <span style={{ display: 'inline-block', width: 0, height: 10, borderLeft: `2px dashed ${NOTICE_INK}` }} />
    case 'gone':
      return <span style={{ display: 'inline-block', width: 26, height: 14, background: 'var(--bg-subtle)', borderLeft: '2px solid #b91c1c' }} />
    case 'pay':
      return <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#16a34a', border: '2px solid var(--surface)', boxShadow: '0 0 0 1px #16a34a' }} />
    case 'pay_missing':
      return <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', border: '2px dashed #16a34a', background: 'var(--surface)', opacity: 0.8 }} />
    case 'notice':
      return (
        <span style={{ position: 'relative', display: 'inline-block', width: 12, height: 16 }}>
          <span style={{ position: 'absolute', left: 0, top: 0, width: 2, height: 16, background: flag }} />
          <span style={{ position: 'absolute', left: 2, top: 0, width: 9, height: 7, background: flag, clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />
          <span style={{ position: 'absolute', left: 3.5, top: 1.5, width: 5, height: 4, background: 'var(--surface)', clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />
        </span>
      )
    case 'check':
    case 'notice_done':
      return <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#15803d', color: '#fff', fontSize: 9, lineHeight: '12px', textAlign: 'center', fontWeight: 700 }}>✓</span>
    case 'mailed':
      // v2.5522: the same circle as Notice on file, amber, with an envelope — printed and in the mail, the number owed.
      return <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: MAILED_INK, color: '#fff', fontSize: 8, lineHeight: '12px', textAlign: 'center', fontWeight: 700 }}>✉</span>
    case 'lien':
      return (
        <span style={{ position: 'relative', display: 'inline-block', width: 12, height: 16 }}>
          <span style={{ position: 'absolute', left: 0, top: 0, width: 2, height: 16, background: flag }} />
          <span style={{ position: 'absolute', left: 2, top: 0, width: 9, height: 7, background: flag, clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />
        </span>
      )
    case 'room':
      return <span style={{ display: 'inline-block', width: 28, height: 6, borderRadius: 3, background: '#86efac' }} />
    case 'short':
      return <span style={{ display: 'inline-block', width: 28, height: 6, borderRadius: 3, background: HATCH }} />
    case 'bracket':
      return <span style={{ display: 'inline-block', width: 28, height: 6, borderRadius: 3, background: STRIPE }} />
    case 'count':
      return (
        <span style={{ position: 'relative', display: 'inline-block', width: 18, height: 16 }}>
          <span style={{ position: 'absolute', left: 0, top: 0, width: 2, height: 16, background: flag }} />
          <span style={{ position: 'absolute', left: 2, top: 0, width: 9, height: 7, background: flag, clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />
          <span style={{ position: 'absolute', left: 6, top: 6, fontSize: 9, fontWeight: 700, color: flag }}>{count ?? 3}</span>
        </span>
      )
  }
}

function markTitle(m: LienCalendarMark, j: LienCalendarJob, todayYmd?: string): string {
  switch (m.kind) {
    case 'work':
      return m.fromCreation ? `No approved hours — the board counts from the month ${m.fromBill ? 'of the bill' : 'the job was created'} (${labelOf(m.ymd)}). Approve the hours or check the month before a notice goes out.` : `Last day worked: ${labelOf(m.ymd)} — the lien date counts from its month, each notice from its own month`
    case 'gone':
      return m.by === 'notice' ? `The § 53.056 notice was due ${labelOf(m.ymd)} and none is recorded — the lien for that work is gone. Nothing can be filed after this day; the money is still owed.` : `The § 53.052 window closed ${labelOf(m.ymd)} with nothing filed — the lien is gone. Nothing can be filed after this day; the money is still owed.`
    case 'pay':
      return `Expected to pay ${labelOf(m.ymd)} — ${j.runway.lines[0] ?? ''}`.trim()
    case 'pay_missing':
      return 'No pay date yet — click to record what they said'
    case 'notice':
      return m.done
        ? `The ${monthWords(m.monthKey)} notice is on file`
        : m.mailed
          ? todayYmd && m.ymd < todayYmd
            ? // v2.5529: its date has passed — no "by" a day gone by; the record says when it went out.
              `The ${monthWords(m.monthKey)} notice is printed and in the mail; its date, ${labelOf(m.ymd)}, has passed — record its tracking number and the day it went out, and it is on file`
            : `The ${monthWords(m.monthKey)} notice is printed and in the mail — record its tracking number by ${labelOf(m.ymd)} and it is on file`
          : `A § 53.056 notice is owed for ${monthWords(m.monthKey)} — send it by ${labelOf(m.ymd)}`
    case 'lien':
      return m.closed ? (j.runway.closedBy === 'notice' ? `The notice window closed ${labelOf(m.ymd)} unsent — the lien is gone, the money still owed` : `The lien window closed ${labelOf(m.ymd)} — money still owed`) : `Last day to file the lien affidavit: ${labelOf(m.ymd)} (§ 53.052)`
    case 'run':
      return m.short ? 'File first — the lien date comes before the money' : 'Room — the money is expected before the lien date'
    case 'bracket':
      return `Property kind not set: residential would be the first date, commercial ${labelOf(m.toYmd)}. Set the kind to pin the flag.`
  }
}
function labelOf(ymd: string): string {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}
function monthWords(key: string | null): string {
  if (!key) return 'the last work month'
  return new Date(`${key}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

const HOVER_OPEN_MS = 120
const HOVER_CLOSE_MS = 220
/** A mark's hover card as the row holds it: which marks, where the first one sits, and (on a GC row) the cards themselves. */
type MarkHover = { key: string; pct: number; indexes: number[]; cards?: LienMarkCard[] }

/**
 * The hover's two timers (v2.5531): a card opens a beat into a hover and stays while the pointer
 * crosses into it; it closes a beat after the pointer leaves both, at once on Esc or a click.
 */
function useMarkHover() {
  const [open, setOpen] = useState<MarkHover | null>(null)
  const openT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clear = (t: typeof openT) => {
    if (t.current) {
      clearTimeout(t.current)
      t.current = null
    }
  }
  useEffect(
    () => () => {
      clear(openT)
      clear(closeT)
    },
    [],
  )
  const arm = (target: MarkHover) => {
    clear(closeT)
    clear(openT)
    openT.current = setTimeout(() => setOpen((cur) => (cur && cur.key === target.key ? cur : target)), HOVER_OPEN_MS)
  }
  const hold = () => clear(closeT)
  // Esc closes the card wherever the focus is (a hover moves none), and the desk under it stays open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      clear(openT)
      clear(closeT)
      setOpen(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])
  const disarm = () => {
    clear(openT)
    clear(closeT)
    closeT.current = setTimeout(() => setOpen(null), HOVER_CLOSE_MS)
  }
  const close = () => {
    clear(openT)
    clear(closeT)
    setOpen(null)
  }
  return { open, arm, hold, disarm, close }
}

/** One flag's width as a share of the track, measured when a hover starts: marks closer than that touch. */
function touchPct(el: HTMLElement | null): number {
  const w = el?.clientWidth ?? 0
  return w > 0 ? (16 / w) * 100 : 1.6
}

/** The props every mark takes to open its card: a hover or keyboard focus arms it, leaving disarms it. */
function hoverProps(arm: (t: MarkHover) => void, disarm: () => void, target: () => MarkHover) {
  return { onMouseEnter: () => arm(target()), onMouseLeave: disarm, onFocus: () => arm(target()), onBlur: disarm }
}

/** Where a card is anchored below the row, and where one drawn above it ends. */
const CARD_BELOW_TOP = TRACK_H + 2
const CARD_ABOVE_BOTTOM = TRACK_H - (LINE_Y - FLAG_H) + 4

/** One row's marks laid on the shared axis. */
function Track({ marks, j, todayYmd, onOpen, onPen, onLastWork, onRecord, onKinds }: { marks: LienCalendarMark[]; j: LienCalendarJob; todayYmd: string; onOpen: () => void; onRecord?: (jobIds: string[]) => void; onPen?: (pct: number) => void; /** The last-day label is a door (v2.4735). */ onLastWork?: () => void; /** The kind bracket's card opens Set kinds (v2.5531). */ onKinds?: () => void }) {
  const gone = marks.find((m): m is Extract<LienCalendarMark, { kind: 'gone' }> => m.kind === 'gone') ?? null
  const ref = useRef<HTMLDivElement>(null)
  const hover = useMarkHover()
  const doors: LienMarkDoors = { pen: Boolean(onPen), lastWork: Boolean(onLastWork), record: Boolean(onRecord), kinds: Boolean(onKinds), draft: false }
  // A point mark opens the card of every mark it touches; an area (the run, the bracket, the grey wash) opens its own.
  const pointTarget = (index: number): MarkHover => {
    const c = lienMarkClusters(marks, touchPct(ref.current)).find((x) => x.indexes.includes(index))
    const m = marks[index]!
    return c ? { key: `c:${c.key}`, pct: c.pct, indexes: c.indexes } : { key: `m:${index}`, pct: 'pct' in m ? m.pct : 0, indexes: [index] }
  }
  const areaTarget = (index: number): MarkHover => {
    const m = marks[index]!
    return { key: `a:${index}`, pct: 'fromPct' in m ? m.fromPct : 'pct' in m ? m.pct : 0, indexes: [index] }
  }
  const point = (index: number) => hoverProps(hover.arm, hover.disarm, () => pointTarget(index))
  const area = (index: number) => hoverProps(hover.arm, hover.disarm, () => areaTarget(index))
  const act = (door: LienMarkCardDoor, card: LienMarkCard) => {
    const at = card.pct ?? hover.open?.pct ?? 50
    hover.close()
    if (door.kind === 'lien_window') onOpen()
    else if (door.kind === 'pen') onPen?.(at)
    else if (door.kind === 'last_work') onLastWork?.()
    else if (door.kind === 'record') onRecord?.(door.jobIds ?? [j.jobId])
    else if (door.kind === 'kinds') onKinds?.()
  }
  const cards: LienMarkCardView[] = hover.open
    ? hover.open.indexes.map((i) => {
        const c = lienMarkCard(marks[i]!, j, todayYmd, doors)
        return { ...c, icon: <Glyph kind={c.glyph} tone={c.tone} /> }
      })
    : []
  return (
    <div
      ref={ref}
      style={{ position: 'relative', height: TRACK_H }}
      data-testid="lien-cal-track"
      onClickCapture={(e) => {
        // A press on a mark does what it did; the card steps aside unless the press is on the card itself.
        if (!(e.target as HTMLElement).closest('[data-testid="lien-mark-card"]')) hover.close()
      }}
    >
      <div style={{ position: 'absolute', left: 0, right: gone ? `${100 - gone.pct}%` : 0, top: LINE_Y, height: 1, background: 'var(--border-strong)' }} />
      {gone ? (
        <div role="img" aria-label={markTitle(gone, j)} data-testid="lien-cal-gone" {...area(marks.indexOf(gone))} style={{ position: 'absolute', left: `${gone.pct}%`, right: 0, top: 0, bottom: 0, background: 'var(--bg-subtle)', borderLeft: `2px solid ${RED_INK}`, zIndex: 0 }}>
          {/* v2.4340: the Overdue bar says "nothing left to file" once; the row keeps the day its lien died, the reason on hover. */}
          <span style={{ position: 'absolute', left: 8, top: LINE_Y + 3, fontSize: 10, fontWeight: 600, color: 'var(--text-red-700)', whiteSpace: 'nowrap' }}>{gone.label}</span>
        </div>
      ) : null}
      {/* v2.6849: a day of work set too early is the usual way a lien reads gone by mistake; one press opens the day to change. */}
      {gone && onLastWork ? (
        <button type="button" data-testid="lien-cal-worked-later" aria-label={lienWorkedLaterLabel(j.number)} title={LIEN_WORKED_LATER_TITLE} onClick={onLastWork} style={{ position: 'absolute', left: `calc(${gone.pct}% + 16px)`, top: 3, zIndex: 2, border: 'none', padding: '2px 0', backgroundColor: 'transparent', fontFamily: 'inherit', fontSize: 10, fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap', color: 'var(--text-link)', cursor: 'pointer' }}>
          {LIEN_WORKED_LATER}
        </button>
      ) : null}
      {marks.map((m, i) => {
        const title = markTitle(m, j, todayYmd)
        if (m.kind === 'gone') return null
        if (m.kind === 'work') {
          // On a dead row the reason sits under the red flag; the tick keeps its date only when there is room before the wash.
          // v2.7254: a creation-day tick keeps its hollow mark here; its words are the chip beside the job's name.
          const labelled = !m.fromCreation && (!gone || gone.pct - m.pct >= 12)
          return (
            <div key={i} role="img" aria-label={title} data-testid="lien-cal-work" {...point(i)} style={{ position: 'absolute', left: `calc(${m.pct}% - 1px)`, top: LINE_Y - 8, width: 2, height: 8, background: m.fromCreation ? 'transparent' : 'var(--text-muted)', borderLeft: m.fromCreation ? `2px dashed ${NOTICE_INK}` : 'none', zIndex: 1 }}>
              {labelled ? (
                onLastWork ? (
                  // v2.7254: only the family is inherited. `font: 'inherit'` after the size drew the date at the row's size, in a box that ran past the row.
                  <button type="button" data-testid="lien-cal-work-door" className="lienCalWorkDoor" aria-label={`Change the last day of work · ${j.number}`} onClick={onLastWork} style={{ position: 'absolute', left: m.offAxis ? 4 : undefined, top: 11, transform: m.offAxis ? 'none' : 'translateX(-50%)', fontSize: 10, lineHeight: 1, whiteSpace: 'nowrap', color: m.fromCreation ? 'var(--text-amber-800)' : 'var(--text-muted)', background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', cursor: 'pointer' }}>
                    {m.label}
                  </button>
                ) : (
                  <span style={{ position: 'absolute', left: m.offAxis ? 4 : undefined, top: 11, transform: m.offAxis ? 'none' : 'translateX(-50%)', fontSize: 10, lineHeight: 1, whiteSpace: 'nowrap', color: m.fromCreation ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>{m.label}</span>
                )
              ) : null}
            </div>
          )
        }
        if (m.kind === 'run') return <div key={i} role="img" aria-label={title} {...area(i)} style={{ position: 'absolute', left: `${m.fromPct}%`, width: `${Math.max(0.4, m.toPct - m.fromPct)}%`, top: LINE_Y - 2, height: 5, borderRadius: 3, background: m.short ? HATCH : '#86efac' }} />
        if (m.kind === 'bracket') return <div key={i} role="img" aria-label={title} {...area(i)} style={{ position: 'absolute', left: `${m.fromPct}%`, width: `${Math.max(0.4, m.toPct - m.fromPct)}%`, top: LINE_Y - 2, height: 5, borderRadius: 3, background: STRIPE, opacity: 0.9 }} />
        if (m.kind === 'pay')
          return (
            <button key={i} type="button" aria-label={`When ${j.customer || j.name} said they would pay: ${labelOf(m.ymd)} · ${j.number}`} {...point(i)} onClick={() => (onPen ? onPen(m.pct) : onOpen())} style={{ position: 'absolute', left: `calc(${m.pct}% - 5px)`, top: LINE_Y - 5, width: 11, height: 11, borderRadius: '50%', background: '#16a34a', border: '2px solid var(--surface)', boxShadow: '0 0 0 1px #16a34a', padding: 0, cursor: 'pointer' }} />
          )
        if (m.kind === 'pay_missing')
          return <button key={i} type="button" aria-label={`Record when ${j.customer || j.name} expects to pay · ${j.number}`} {...point(i)} onClick={() => (onPen ? onPen(m.pct) : onOpen())} style={{ position: 'absolute', left: `calc(${m.pct}% - 7px)`, top: LINE_Y - 7, width: 14, height: 14, borderRadius: '50%', border: '2px dashed #16a34a', background: 'var(--surface)', padding: 0, opacity: 0.75, cursor: 'pointer' }} />
        if (m.kind === 'notice')
          return m.done ? (
            <div key={i} role="img" aria-label={title} {...point(i)} style={{ position: 'absolute', left: `calc(${m.pct}% - 6px)`, top: LINE_Y - 6, width: 12, height: 12, borderRadius: '50%', background: GREEN_INK, color: '#fff', fontSize: 9, lineHeight: '12px', textAlign: 'center', fontWeight: 700 }}>✓</div>
          ) : m.mailed ? (
            // v2.5522: printed and in the mail — the circle Notice on file wears, amber, with an envelope; it opens the Record the mailing door.
            <button key={i} type="button" aria-label={title} data-testid="lien-cal-mailed" {...point(i)} onClick={() => (onRecord ? onRecord([j.jobId]) : onOpen())} style={{ position: 'absolute', left: `calc(${m.pct}% - 6px)`, top: LINE_Y - 6, width: 12, height: 12, padding: 0, border: 'none', borderRadius: '50%', background: MAILED_INK, color: '#fff', fontSize: 8, lineHeight: '12px', textAlign: 'center', fontWeight: 700, cursor: 'pointer' }}>
              ✉
            </button>
          ) : (
            <button key={i} type="button" aria-label={title} {...point(i)} onClick={onOpen} style={{ position: 'absolute', left: `calc(${m.pct}% - 1px)`, top: LINE_Y - FLAG_H, width: 14, height: FLAG_H, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <span style={{ position: 'absolute', left: 0, top: 0, width: 2, height: FLAG_H, background: noticeInk(m.tone) }} />
              <span style={{ position: 'absolute', left: 2, top: 0, width: 10, height: 8, background: noticeInk(m.tone), clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />
              <span style={{ position: 'absolute', left: 3.5, top: 1.5, width: 6, height: 5, background: 'var(--surface)', clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />
            </button>
          )
        // the lien flag, slate — on a dead row, red on the day the lien died
        const color = m.closed ? RED_INK : lienInk(m.tone)
        return (
          <div key={i} role="img" aria-label={title} {...point(i)} style={{ position: 'absolute', left: `calc(${m.pct}% - 1px)`, top: LINE_Y - FLAG_H, width: 12, height: FLAG_H, zIndex: 1 }}>
            <span style={{ position: 'absolute', left: 0, top: 0, width: 2, height: FLAG_H, background: color }} />
            <span style={{ position: 'absolute', left: 2, top: 0, width: 10, height: 8, background: color, clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />
          </div>
        )
      })}
      {hover.open && cards.length ? <LienMarkHoverCard cards={cards} anchorPct={hover.open.pct} aboveBottom={CARD_ABOVE_BOTTOM} belowTop={CARD_BELOW_TOP} label={`About ${j.number}`} onDoor={act} onEnter={hover.hold} onLeave={hover.disarm} /> : null}
    </div>
  )
}

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** "They said…" — the pen, anchored under a dot. Pure form; the consequence is read back as the day changes. */
function TheySaidPopover({ target, todayYmd, onCancel, onSaved }: { target: PenTarget; todayYmd: string; onCancel: () => void; onSaved: (what: 'promise') => void }) {
  const { showToast } = useToastContext()
  const jobs = target.kind === 'job' ? [target.job] : target.group.jobs.filter((j) => j.runway.state !== 'closed' && j.runway.state !== 'filed')
  const first = jobs[0]
  const standing = target.kind === 'group' ? groupPayYmd(target.group.jobs, todayYmd) : first?.runway.marks?.pay ? addDaysYmd(todayYmd, first.runway.marks.pay.days) : null
  const shortcuts = payDateShortcuts(todayYmd, standing)
  const [ymd, setYmd] = useState<string>(standing ?? shortcuts[0]?.ymd ?? todayYmd)
  const whose = target.kind === 'group' ? [{ key: 'gc' as const, label: `${target.group.name} (GC)` }] : whoseWordOptions(target.job)
  const [who, setWho] = useState<'owner' | 'gc'>(whose[0]?.key ?? 'owner')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  // The tightest job's flag decides the read-back on a group; each job's own on a row.
  const tightest = jobs.reduce<LienCalendarJob | null>((t, j) => (!t || j.runway.lienByYmd < t.runway.lienByYmd ? j : t), null)
  const consequence = tightest ? promiseConsequence(ymd, tightest.runway.lienByYmd, todayYmd) : null
  const saidBy = whose.find((w) => w.key === who)?.label.replace(/ \((owner|GC)\)$/, '') ?? null
  const save = async () => {
    if (busy || jobs.length === 0) return
    setBusy(true)
    try {
      if (target.kind === 'job') {
        await addJobPaymentPromise({ jobId: target.job.jobId, ymd, saidBy, channel: null, note: note.trim() || null })
        showToast(`They said ${formatYmdMonthDay(ymd)} — recorded on ${target.job.number}.`, 'success')
      } else {
        const r = await addJobPaymentPromisesSettled({ jobIds: jobs.map((j) => j.jobId), ymd, saidBy, channel: null, note: note.trim() || null })
        showToast(r.failed.length ? `${target.group.name}'s word saved on ${r.saved.length} of ${jobs.length} jobs — ${r.failed.length} refused.` : `${target.group.name}'s word — ${formatYmdMonthDay(ymd)} — recorded on all ${r.saved.length} jobs.`, r.failed.length ? 'warning' : 'success')
      }
      onSaved('promise')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not record what they said'), 'error')
    } finally {
      setBusy(false)
    }
  }
  const title = target.kind === 'job' ? `${target.job.number} · ${formatUsdNoCents(target.job.openBalance)}` : `${target.group.name} · ${jobs.length} jobs · ${formatUsdNoCents(target.group.total)}`
  return (
    <div role="dialog" aria-label="They said" style={{ position: 'absolute', left: `min(${target.pct}%, calc(100% - 300px))`, top: 26, width: 300, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.18)', padding: '10px 12px', zIndex: 6, fontSize: '0.75rem', color: 'var(--text)' }} data-testid="lien-cal-pen">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <strong style={{ fontSize: '0.8125rem' }}>They said…</strong>
        <span style={{ color: 'var(--text-muted)' }}>{title}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        {shortcuts.map((sc) => (
          <button key={sc.key} type="button" onClick={() => setYmd(sc.ymd)} aria-pressed={ymd === sc.ymd} style={{ font: 'inherit', fontSize: '0.7rem', padding: '2px 8px', borderRadius: 999, border: '1px solid var(--border-strong)', background: ymd === sc.ymd ? 'var(--bg-blue-tint)' : 'var(--surface)', color: 'inherit', cursor: 'pointer' }}>
            {sc.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2, color: 'var(--text-muted)' }}>
          <span>Pay by</span>
          <input type="date" value={ymd} onChange={(e) => setYmd(e.target.value)} aria-label="Pay by" style={{ font: 'inherit', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '4px 6px', background: 'var(--surface)', color: 'inherit' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2, color: 'var(--text-muted)' }}>
          <span>Whose word</span>
          <select value={who} onChange={(e) => setWho(e.target.value as 'owner' | 'gc')} aria-label="Whose word" disabled={whose.length < 2} style={{ font: 'inherit', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '4px 6px', background: 'var(--surface)', color: 'inherit' }}>
            {whose.map((w) => (
              <option key={w.key} value={w.key}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note — “check goes out with the draw”" aria-label="Note" style={{ width: '100%', boxSizing: 'border-box', font: 'inherit', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '5px 8px', marginBottom: 8, background: 'var(--surface)', color: 'inherit' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {consequence ? <span data-testid="lien-cal-pen-consequence" style={{ color: consequence.tone === 'red' ? 'var(--text-red-700)' : consequence.tone === 'green' ? 'var(--text-green-700)' : 'var(--text-amber-800)', fontWeight: 600 }}>{consequence.text}</span> : null}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={onCancel} disabled={busy} style={{ font: 'inherit', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: 'inherit' }}>
          Cancel
        </button>
        <button type="button" onClick={() => void save()} disabled={busy || !ymd} style={{ font: 'inherit', border: 'none', background: 'var(--text-strong)', color: 'var(--surface)', borderRadius: 6, padding: '4px 12px', fontWeight: 700, cursor: 'pointer' }}>
          {busy ? 'Saving…' : target.kind === 'group' ? `Save for all ${jobs.length}` : 'Save'}
        </button>
      </div>
    </div>
  )
}

/** "Set kinds, biggest first": the assumed-kind rows with the switch on each; a row with no property record goes to Edit Job. */
function KindsSheet({ jobs, onClose, onOpenEditJob, onSaved }: { jobs: ReadonlyArray<LienCalendarJob>; onClose: () => void; onOpenEditJob?: (jobId: string) => void; onSaved: (what: 'kind') => void }) {
  const { showToast } = useToastContext()
  const queue = kindsQueue(jobs)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [done, setDone] = useState<Record<string, PropertyKind>>({})
  const pick = async (row: (typeof queue)[number], kind: PropertyKind) => {
    if (!row.addressId || busyId) return
    setBusyId(row.jobId)
    try {
      await savePropertyKind(row.addressId, kind)
      setDone((d) => ({ ...d, [row.jobId]: kind }))
      showToast(`Property kind saved on ${row.label}: ${kind === 'residential' ? 'residential' : 'commercial'} — its lien date is ${kind === 'residential' ? formatYmdMonthDay(row.lienByYmd) : row.commercialYmd ? formatYmdMonthDay(row.commercialYmd) : 'a month later'}.`, 'success')
      onSaved('kind')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the property kind'), 'error')
    } finally {
      setBusyId(null)
    }
  }
  return (
    <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-amber-tint)' }} data-testid="lien-cal-kinds">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px 4px' }}>
        <strong style={{ fontSize: '0.8125rem' }}>Set kinds, biggest first</strong>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>a house's lien date is a month earlier than a commercial job's — the flag moves as you set each one</span>
        <button type="button" onClick={onClose} style={{ marginLeft: 'auto', font: 'inherit', fontSize: '0.72rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', color: 'inherit' }}>
          Close
        </button>
      </div>
      <div style={{ padding: '0 14px 10px', display: 'grid', gap: 4 }}>
        {queue.length === 0 ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Every property on the board has its kind.</span> : null}
        {queue.map((row) => (
          <div key={row.jobId} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: 10, alignItems: 'center', fontSize: '0.75rem', padding: '4px 0', borderBottom: '1px solid var(--border)' }} data-testid={`lien-cal-kind-${row.jobId}`}>
            <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <strong>{row.label}</strong> · {formatUsdNoCents(row.openBalance)} · residential {formatYmdMonthDay(row.lienByYmd)}{row.commercialYmd ? ` · commercial ${formatYmdMonthDay(row.commercialYmd)}` : ''}
            </span>
            {row.addressId ? (
              <PropertyKindSwitch value={normalizePropertyKind(done[row.jobId] ?? '')} onPick={(k) => void pick(row, k)} disabled={busyId === row.jobId} label={`Property kind for ${row.label}`} />
            ) : (
              <button type="button" onClick={() => onOpenEditJob?.(row.jobId)} disabled={!onOpenEditJob} style={{ font: 'inherit', fontSize: '0.72rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', color: 'inherit' }} title="No property record is linked — Edit Job → Property record">
                Set property kind ›
              </button>
            )}
            <span style={{ color: 'var(--text-muted)' }}>{busyId === row.jobId ? 'saving…' : done[row.jobId] ? 'set ✓' : ''}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** The amber chip beside a job dated from its creation day (v2.7254): the words the lane's tick carried, with the tick's own explanation. */
const NO_AXIS = { pct: () => 0, startYmd: '' }
function NoHoursChip({ j, onLastWork }: { j: LienCalendarJob; /** The chip is the door to the last day of work, as the tick's label was (v2.4735). */ onLastWork?: () => void }) {
  const words = lienNoHoursChip(j)
  if (!words) return null
  const mark = workMarkFor(j, NO_AXIS)
  const title = mark ? markTitle(mark, j) : undefined
  return onLastWork ? (
    <button
      type="button"
      className="lienCalNoHours"
      data-testid="lien-cal-work-door"
      title={title}
      aria-label={`Change the last day of work · ${j.number}`}
      onClick={(e) => {
        e.stopPropagation()
        onLastWork()
      }}
    >
      {words}
    </button>
  ) : (
    <span className="lienCalNoHours" data-testid="lien-cal-no-hours" title={title}>
      {words}
    </span>
  )
}

/**
 * A group as one quiet line (v2.7254): its name and counts in small muted words, a hairline, its next move and its money.
 * It has no lane: the flags a GC row folded are counted in its words, and the GC's word is the press on the line.
 */
function GroupLine({ g, open, onToggle, todayYmd, onPen }: { g: LienCalendarGroup; open: boolean; onToggle: () => void; todayYmd: string; onPen?: () => void }) {
  const word = g.kind === 'gc' && onPen ? groupPayYmd(g.jobs, todayYmd) : null
  return (
    <div className="lienCalGroupLine" data-testid={`lien-cal-group-${g.key}`}>
      <button type="button" aria-expanded={open} onClick={onToggle} className="lienCalGroupFold">
        <span aria-hidden style={{ width: 10, flex: 'none' }}>{open ? '▾' : '▸'}</span>
        <span data-testid="lien-cal-group-line">{lienGroupLine(g)}</span>
      </button>
      <span aria-hidden className="lienCalGroupRule" />
      {g.word ? (
        <span title={g.word} style={{ flex: 'none', fontWeight: 600, color: TONE[g.tone], whiteSpace: 'nowrap' }}>
          {g.word}
        </span>
      ) : null}
      {g.kind === 'gc' && onPen ? (
        <button type="button" className="lienCalGroupPen" aria-label={word ? `${g.name}'s word: ${labelOf(word)}` : `Record ${g.name}'s word for all ${g.jobs.length} jobs`} onClick={onPen}>
          {word ? `They said ${labelOf(word)} ›` : 'Record what they said ›'}
        </button>
      ) : null}
      <span style={{ flex: 'none', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatUsdNoCents(g.total)}</span>
    </div>
  )
}

/** A property's heading inside a group that lists overdue jobs with their property (v2.4526). */
function PropertyLabel({ label, tally, phone }: { label: string; /** Both piles and their sum, when a job here closed its window (v2.6849). */ tally?: LienPropertyTally | null; phone?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: phone ? 'wrap' : 'nowrap', columnGap: 12, minWidth: 0, padding: phone ? '6px 12px 2px' : '5px 14px 1px 30px', fontSize: '0.6875rem', background: 'var(--surface)' }}>
      <span data-testid="lien-cal-property" style={{ minWidth: 0, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      {tally ? (
        <span data-testid="lien-cal-property-tally" title={tally.title} style={{ flex: 'none', marginLeft: phone ? undefined : 'auto', fontWeight: 600, color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {phone ? tally.short : tally.words}
        </span>
      ) : null}
    </div>
  )
}

function JobRow({ j, g, index, axis, onOpen, onOpenJob, onPen, mark, closedHere, onLastWork, onRecord, onKinds }: { j: LienCalendarJob; g: LienCalendarGroup; index: number; axis: LienCalendarAxis | null; onOpen: () => void; onRecord?: (jobIds: string[]) => void; onKinds?: () => void; /** The number's own door: the Job window. */ onOpenJob?: () => void; onLastWork?: () => void; onPen?: (pct: number) => void; mark?: LienSupplierMark; /** An overdue job listed with its property: greyed. */ closedHere?: boolean }) {
  // Under a GC the press on the GC's line speaks for every job; a job draws the dashed dot only on its own.
  const marks = axis ? lienCalendarMarks(j, axis, { payMissingDot: g.kind !== 'gc' }) : []
  const word = rowWord(j, g)
  const dead = j.runway.state === 'closed'
  return (
    <div role="row" className="lienCalendarRow" data-closed-here={closedHere ? 'true' : undefined} style={{ ...GRID, minHeight: ROW_H, background: index % 2 === 1 ? 'var(--bg-subtle)' : 'var(--surface)' }}>
      {/* The cell opens the job's Lien window wherever it is clicked; the number is its own door (v2.4531). */}
      <div onClick={onOpen} title={closedHere ? 'Its window closed; listed here with its property. Open the job’s Lien window' : 'Open the job’s Lien window'} style={{ minWidth: 0, padding: '4px 10px 4px 30px', cursor: 'pointer' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <LienJobNumber number={j.number} muted={closedHere} onOpen={onOpenJob} />
          <button type="button" style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: closedHere ? 500 : 600, color: closedHere ? 'var(--text-muted)' : undefined, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.name}</span>
            {mark ? (
              <span style={{ flex: 'none', fontSize: '0.6875rem', position: 'relative' }}>
                <LienSupplierMarkLine mark={mark} short />
              </span>
            ) : null}
          </button>
          <NoHoursChip j={j} onLastWork={onLastWork} />
        </span>
        <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {j.customer}
          {j.address ? ` · ${j.address}` : ''}
        </span>
      </div>
      {axis ? <Track marks={marks} j={j} todayYmd={axis.todayYmd} onOpen={onOpen} onPen={onPen} onLastWork={onLastWork} onRecord={onRecord} onKinds={onKinds} /> : <div />}
      <div style={{ padding: '0 14px', textAlign: 'right' }} data-testid="lien-cal-row-money">
        <div style={{ fontSize: '0.8125rem', fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: dead ? 'var(--text-muted)' : undefined }}>{formatUsdNoCents(j.openBalance)}</div>
        {word ? (
          <div title={j.runway.lines.join(' — ')} style={{ fontSize: '0.6875rem', fontWeight: word.tone === 'grey' ? 500 : 600, color: TONE[word.tone], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {word.text}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Each bucket's colours (v2.7254: every bucket is a band): Overdue red, This month amber, Next month a calm blue, Later grey.
 * `rail` is the 4 px edge at the band's left; `band` shades the picked bucket's stretch of the axis.
 */
const BUCKET_TONE: Record<LienCalendarBucketKey, { ink: string; bar: string; rule: string; rail: string; band: string; pillBg: string; pillBorder: string }> = {
  overdue: { ink: 'var(--text-red-700)', bar: 'var(--bg-red-tint)', rule: 'var(--border-red)', rail: '#dc2626', band: 'var(--bg-red-100)', pillBg: 'var(--bg-red-tint)', pillBorder: 'var(--border-red)' },
  this_month: { ink: 'var(--text-amber-800)', bar: 'var(--bg-amber-tint)', rule: 'var(--border-amber)', rail: '#d97706', band: 'var(--bg-amber-100)', pillBg: 'var(--bg-amber-tint)', pillBorder: 'var(--border-amber)' },
  next_month: { ink: 'var(--text-blue-800)', bar: 'var(--bg-blue-tint)', rule: 'var(--border-blue)', rail: '#2563eb', band: 'var(--bg-blue-tint)', pillBg: 'var(--bg-blue-tint)', pillBorder: 'var(--border-blue)' },
  later: { ink: 'var(--text-700)', bar: 'var(--bg-slate-100)', rule: 'var(--border-strong)', rail: 'var(--text-faint)', band: 'var(--bg-slate-100)', pillBg: 'var(--bg-blue-tint)', pillBorder: 'var(--border-blue)' },
}
/** The date row's height. It is a fixed row above the list since v2.4766, so nothing the list scrolls can show above it. */
const DATE_ROW_H = 40
/** A bucket band's height: its 37 px row and a 1 px rule above and below. */
const BAR_H = 39
/**
 * A bucket's section ends with one bar's height of nothing (`BUCKET_SPACER`) and pulls the next
 * section up by the same, so the bar it sticks stays at the top until the next bar arrives and
 * covers it (v2.4766). Without the room a sticky bar is pushed out by its section's end and its
 * bottom half shows for a moment under the row above it. Padding would not do: a sticky box is
 * held inside its parent's content box.
 */
const BUCKET_SECTION: CSSProperties = { position: 'relative', marginBottom: -BAR_H }
const BUCKET_SPACER: CSSProperties = { height: BAR_H }
/** The buckets folded on the first view and whenever All is picked again. */
const START_FOLDED: ReadonlyArray<string> = ['overdue', 'later']
/** The Overdue bar's hover: why nothing is left to file, and who chases the money. */
const OVERDUE_NOTE = 'A notice or lien window closed with nothing sent. The money is still owed. Collections or the Legal desk can chase it.'
/** A line of words across the whole board sits over the today line and the column rules. */
const ABOVE_LINES: CSSProperties = { position: 'relative', zIndex: 1, background: 'var(--surface)' }

function jobsWord(n: number): string {
  return `${n} ${n === 1 ? 'job' : 'jobs'}`
}

/** The pills: All and the four buckets, each with its count and money. A second tap on a picked pill goes back to All. */
function Pills({ board, pick, onPick, phone }: { board: LienCalendarBoard; pick: BoardPick; onPick: (p: BoardPick) => void; phone?: boolean }) {
  const items: Array<{ key: BoardPick; title: string; dateLabel: string; count: number; total: number }> = [
    { key: 'all', title: 'All', dateLabel: '', count: board.count, total: board.total },
    ...board.buckets.map((b) => ({ key: b.key, title: b.title, dateLabel: b.dateLabel, count: b.jobs.length, total: b.total })),
  ]
  return (
    <div role="group" aria-label="Show" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: phone ? 'nowrap' : 'wrap', flex: 'none', maxWidth: '100%' }} data-testid="lien-cal-pills">
      {items.map((p) => {
        const on = pick === p.key
        const tone = p.key === 'all' ? null : BUCKET_TONE[p.key]
        const vars = {
          '--pill-ink': tone && p.key !== 'next_month' && p.key !== 'later' ? tone.ink : 'var(--text-700)',
          '--pill-bg': on ? (tone ? tone.pillBg : 'var(--bg-blue-tint)') : 'var(--surface)',
          '--pill-border': on ? (tone ? tone.pillBorder : 'var(--border-blue)') : 'var(--border)',
        } as CSSProperties
        return (
          <button key={p.key} type="button" className={`lienCalPill${phone ? ' lienCalPillPhone' : ''}`} aria-pressed={on} aria-label={`${p.title} · ${jobsWord(p.count)} · ${formatUsdNoCents(p.total)}`} onClick={() => onPick(on && p.key !== 'all' ? 'all' : p.key)} style={vars}>
            <strong>{p.title}</strong>
            {!phone && p.dateLabel ? <span className="lienCalPillDate">{p.dateLabel}</span> : null}
            <span className="lienCalPillCount">{p.count}</span>
            {!phone ? <span className="lienCalPillMoney">{formatMoneyShortK(p.total)}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

/** "6 kinds not set ›": the door to Set kinds where the pen writes; plain words everywhere else. */
function KindsChip({ n, open, onToggle }: { n: number; open: boolean; onToggle?: () => void }) {
  if (n <= 0) return null
  const words = `${n} ${n === 1 ? 'kind' : 'kinds'} not set`
  const title = 'A property with no kind is read as a house. Its lien date could be a month later.'
  return onToggle ? (
    <button type="button" className="lienCalKinds" aria-expanded={open} onClick={onToggle} title={title}>
      {words} ›
    </button>
  ) : (
    <span className="lienCalKinds" title={title}>
      {words}
    </span>
  )
}

/** The date row: the search over the names, the 15ths with how many jobs come due on each, and today. */
function DateRow({ axis, counts, query, onQuery, lens }: { axis: LienCalendarAxis; counts: ReadonlyMap<string, LienNextDateCount>; query: string; onQuery: (q: string) => void; lens?: ReactNode }) {
  return (
    <div style={{ ...GRID, alignItems: 'center', height: DATE_ROW_H, borderBottom: '1px solid var(--border)' }} data-testid="lien-cal-dates">
      {/* The Houses owed lens sits beside the search (v2.4430): both narrow the jobs, and the pills above keep one line. */}
      <div style={{ padding: '0 8px', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <label className="lienCalSearch" style={{ flex: '1 1 auto', minWidth: 0 }}>
          <span aria-hidden style={{ color: 'var(--text-muted)' }}>⌕</span>
          <input type="search" value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Job #, name, customer, GC, address" aria-label="Search the lien calendar" />
        </label>
        {lens}
      </div>
      <div className="lienCalAxis" style={{ position: 'relative', height: DATE_ROW_H }}>
        {axis.columns.map((c) => {
          const n = counts.get(c.ymd)
          // The date carries its column's ink: amber where only notices come due, slate where a lien does.
          const ink = c.past ? 'var(--text-faint)' : n && n.liens > 0 ? LIEN_INK : n && n.notices > 0 ? 'var(--text-amber-800)' : 'var(--text-700)'
          const title = n ? `${c.label} is the next date for ${jobsWord(n.jobs)}${n.notices ? ` · ${n.notices} ${n.notices === 1 ? 'notice' : 'notices'}` : ''}${n.liens ? ` · ${n.liens} ${n.liens === 1 ? 'lien' : 'liens'}` : ''} · ${formatUsdNoCents(n.total)}` : undefined
          return (
            <div key={c.ymd} title={title ?? c.label} style={{ position: 'absolute', left: `${c.pct}%`, bottom: 6, transform: 'translateX(-50%)', fontSize: '0.6875rem', fontWeight: 600, color: ink, whiteSpace: 'nowrap' }}>
              {/* A narrow axis has a month's width between its 15ths: the month alone, the day and the count on hover. */}
              <span className="lienCalDateFull">{c.label}</span>
              <span className="lienCalDateShort" aria-hidden>
                {c.label.split(' ')[0]}
              </span>
              {n ? (
                <span className="lienCalDateCount" data-testid="lien-cal-date-count" style={{ background: n.liens > 0 ? 'var(--bg-200)' : 'var(--bg-amber-100)', color: n.liens > 0 ? 'var(--text-700)' : 'var(--text-amber-800)' }}>
                  {n.jobs}
                </span>
              ) : null}
            </div>
          )
        })}
        <div style={{ position: 'absolute', left: `${axis.todayPct}%`, top: 3, transform: 'translateX(-50%)', fontSize: '0.65rem', fontWeight: 700, color: 'var(--surface)', background: 'var(--text-strong)', borderRadius: 999, padding: '0 7px', whiteSpace: 'nowrap', zIndex: 1 }} data-testid="lien-cal-today-pill">
          today · {labelOf(axis.todayYmd)}
        </div>
      </div>
      <div style={{ padding: '0 14px', textAlign: 'right', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Owed</div>
    </div>
  )
}

/**
 * A bucket's band (v2.7254): a tinted bar the whole width with a rail at its left, the fold, the title, its date in a pill,
 * the short summary, Record the mailing and Draft the N where the desk lists them, and the job count and the money.
 */
function BucketBar({ b, open, onToggle, onDraft, onRecord, top, phone }: { b: LienCalendarBucket; open: boolean; onToggle: () => void; onDraft?: (ymd: string, jobIds: string[]) => void; onRecord?: (jobIds: string[]) => void; top: number; phone?: boolean }) {
  const tone = BUCKET_TONE[b.key]
  const caret = <span aria-hidden style={{ color: 'var(--text-muted)', width: 10, flex: 'none' }}>{open ? '▾' : '▸'}</span>
  const title = <strong style={{ fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: tone.ink, whiteSpace: 'nowrap' }}>{b.title}</strong>
  const pill = b.datePill ? (
    <span data-testid="lien-cal-band-date" style={{ flex: 'none', fontSize: '0.72rem', fontWeight: 600, lineHeight: 1.5, padding: '0 8px', borderRadius: 999, border: `1px solid ${tone.rule}`, background: 'var(--surface)', color: tone.ink, whiteSpace: 'nowrap' }}>
      {b.datePill}
    </span>
  ) : null
  const count = (
    <span data-testid="lien-cal-band-count" style={{ fontSize: '0.75rem', color: 'var(--text-700)', whiteSpace: 'nowrap' }}>
      {jobsWord(b.jobs.length)}
    </span>
  )
  const money = <strong style={{ fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums', color: tone.ink, whiteSpace: 'nowrap' }}>{formatUsdNoCents(b.total)}</strong>
  const draft = b.draft && onDraft ? b.draft : null
  const record = b.record && onRecord ? b.record : null
  const band: CSSProperties = { background: tone.bar, borderLeft: `4px solid ${tone.rail}`, borderTop: `1px solid ${tone.rule}`, borderBottom: `1px solid ${tone.rule}` }
  if (phone) {
    return (
      <div style={{ position: 'sticky', top, zIndex: 3 }} data-testid="lien-cal-bar" data-bucket={b.key}>
        <button type="button" aria-expanded={open} onClick={onToggle} title={b.key === 'overdue' ? OVERDUE_NOTE : undefined} style={{ ...band, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '2px 10px', alignItems: 'center', width: '100%', minHeight: 44, padding: '7px 12px 7px 8px', borderRight: 'none', borderRadius: 0, textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            {caret}
            {title}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
            {count}
            {money}
          </span>
          {pill || b.summary ? (
            <span style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px 8px', fontSize: '0.75rem', color: 'var(--text-700)', paddingLeft: 16 }}>
              {pill}
              {b.summary ? <span>{b.summary}</span> : null}
            </span>
          ) : null}
        </button>
        {open && (draft || record) ? (
          <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {draft ? (
              <button type="button" className="lienCalDraft lienCalDraftPhone" onClick={() => onDraft?.(draft.ymd, draft.jobIds)}>
                {draft.label} ›
              </button>
            ) : null}
            {record ? (
              <button type="button" className="lienCalDraft lienCalDraftPhone" data-testid="lien-cal-record" onClick={() => onRecord?.(record.jobIds)}>
                {record.label} ›
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }
  return (
    <div data-testid="lien-cal-bar" data-bucket={b.key} style={{ ...band, position: 'sticky', top, zIndex: 3, boxSizing: 'border-box', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', alignItems: 'center', gap: 12, height: BAR_H, padding: '0 14px 0 4px' }}>
      <button type="button" aria-expanded={open} onClick={onToggle} title={b.key === 'overdue' ? OVERDUE_NOTE : undefined} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, border: 'none', background: 'none', padding: '6px 4px', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
        {caret}
        {title}
        {pill}
        <span style={{ fontSize: '0.78rem', color: 'var(--text-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{b.summary}</span>
      </button>
      {draft || record ? (
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          {record ? (
            <button type="button" className="lienCalDraft" data-testid="lien-cal-record" onClick={() => onRecord?.(record.jobIds)} title="Open the run on Record the mailing: these notices are printed and in the mail, their numbers owed">
              {record.label} ›
            </button>
          ) : null}
          {draft ? (
            <button type="button" className="lienCalDraft" onClick={() => onDraft?.(draft.ymd, draft.jobIds)} title="Open the Monthly notices tab on these jobs, ready to draft">
              {draft.label} ›
            </button>
          ) : null}
        </span>
      ) : (
        <span />
      )}
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10 }}>
        {count}
        {money}
      </span>
    </div>
  )
}

/** The Billed column's inks: muted under thirty days, amber from thirty, red from sixty. The meter's fill is saturated, its words a token. */
const AGE_INK: Record<LienBilledAgeTone, { words: string; fill: string }> = {
  muted: { words: 'var(--text-muted)', fill: 'var(--text-faint)' },
  amber: { words: 'var(--text-amber-800)', fill: '#d97706' },
  red: { words: 'var(--text-red-700)', fill: '#dc2626' },
}

/** Days since the oldest open bill went out, with a short meter whose length is the age (full at ninety days). */
function BilledAge({ line, meter = true }: { line: LienLaterLine; meter?: boolean }) {
  const a = line.billed
  if (!a)
    return (
      <span data-testid="lien-cal-billed-age" data-tone="none" title={LIEN_BILLED_AGE_NONE_TITLE} style={{ color: 'var(--text-muted)' }}>
        —
      </span>
    )
  const ink = AGE_INK[line.closed ? 'muted' : a.tone]
  return (
    <span data-testid="lien-cal-billed-age" data-tone={a.tone} title={a.title} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
      <span style={{ minWidth: meter ? 58 : undefined, color: ink.words, fontWeight: a.tone === 'muted' ? 500 : 600, fontVariantNumeric: 'tabular-nums' }}>{meter ? a.words : `billed ${a.words}`}</span>
      {meter ? (
        <span aria-hidden style={{ flex: 'none', width: 64, height: 4, borderRadius: 2, background: 'var(--bg-200)', overflow: 'hidden' }}>
          <span data-testid="lien-cal-billed-meter" style={{ display: 'block', width: `${a.meterPct}%`, height: '100%', background: ink.fill }} />
        </span>
      ) : null}
    </span>
  )
}

/** The job's column stops at 560 px so the age sits near the name it belongs to; the money keeps the right edge, under the rows' Owed. */
const LATER_GRID: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 560px) 160px 220px minmax(90px, 1fr)', columnGap: 16, alignItems: 'center', padding: '0 14px 0 30px' }

/**
 * Later as a list (v2.7254): one line a job, oldest bill first. Nothing here is due for two months or more, so a line says
 * who, how long the bill has waited, the lien's day and the money, and opens the job's Lien window like a timeline row.
 */
function LaterList({ lines, onOpenJob, onOpenJobWindow, onOpenLastWork, marks }: { lines: LienLaterLine[]; onOpenJob: (id: string) => void; onOpenJobWindow?: (id: string) => void; onOpenLastWork?: (id: string) => void; marks?: ReadonlyMap<string, LienSupplierMark> }) {
  return (
    <div role="table" aria-label="Later, oldest bill first" data-testid="lien-cal-later-list" style={ABOVE_LINES}>
      <div role="row" style={{ ...LATER_GRID, minHeight: 24, fontSize: '0.6875rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
        <span role="columnheader">Job</span>
        <span role="columnheader" title="Days since the oldest bill still open went out. Oldest first.">Billed</span>
        <span role="columnheader">Lien by</span>
        <span role="columnheader" style={{ textAlign: 'right' }}>Open</span>
      </div>
      {lines.map((l) => {
        const j = l.job
        const mark = marks?.get(j.jobId)
        return (
          <div key={j.jobId} role="row" className="lienCalendarRow" data-testid="lien-cal-later-line" data-closed-here={l.closed ? 'true' : undefined} onClick={() => onOpenJob(j.jobId)} title={l.closed ? 'Its window closed; listed here with its property. Open the job’s Lien window' : 'Open the job’s Lien window'} style={{ ...LATER_GRID, minHeight: 32, fontSize: '0.8125rem', borderBottom: '1px solid var(--border)', cursor: 'pointer', color: l.closed ? 'var(--text-muted)' : undefined }}>
            <span role="cell" style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <LienJobNumber number={j.number} muted={l.closed} onOpen={onOpenJobWindow ? () => onOpenJobWindow(j.jobId) : undefined} />
              {/* The line opens the job's Lien window wherever it is pressed; this button is its keyboard stop. */}
              <button type="button" style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 8, border: 'none', background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit' }}>
                <span style={{ fontWeight: l.closed ? 500 : 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.name}</span>
                <span data-testid="lien-cal-later-who" style={{ flex: 'none', fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{l.who}</span>
              </button>
              {mark ? (
                <span style={{ flex: 'none', fontSize: '0.6875rem', position: 'relative' }}>
                  <LienSupplierMarkLine mark={mark} short />
                </span>
              ) : null}
              <NoHoursChip j={j} onLastWork={onOpenLastWork ? () => onOpenLastWork(j.jobId) : undefined} />
            </span>
            <span role="cell">
              <BilledAge line={l} />
            </span>
            <span role="cell" style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              <span title={j.runway.lines.join(' · ')} style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {l.lienBy}
                {l.first ? <span style={{ color: 'var(--text-muted)' }}>{` · ${l.first}`}</span> : null}
              </span>
              {l.closed && onOpenLastWork ? (
                <button
                  type="button"
                  data-testid="lien-cal-worked-later"
                  aria-label={lienWorkedLaterLabel(j.number)}
                  title={LIEN_WORKED_LATER_TITLE}
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenLastWork(j.jobId)
                  }}
                  style={{ flex: 'none', border: 'none', padding: 0, backgroundColor: 'transparent', fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--text-link)', cursor: 'pointer' }}
                >
                  {LIEN_WORKED_LATER}
                </button>
              ) : null}
            </span>
            <span role="cell" data-testid="lien-cal-row-money" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {formatUsdNoCents(j.openBalance)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * The key as one line at the bottom: every mark with a few words beside it. A tap turns the mark dark
 * and opens one panel above the line — the long words, and the board's own door where it has one.
 * Tap again, tap another, Esc or × closes it.
 */
function KeyStrip({ openGlyph, onToggle, doors, onDoor }: { openGlyph: LienCalendarKeyGlyph | null; onToggle: (g: LienCalendarKeyGlyph) => void; doors: ReadonlySet<NonNullable<LienCalendarKeyEntry['door']>>; onDoor: (door: NonNullable<LienCalendarKeyEntry['door']>) => void }) {
  const open = openGlyph ? LIEN_CALENDAR_KEY.find((k) => k.glyph === openGlyph) ?? null : null
  return (
    <div style={{ flex: 'none', borderTop: '1px solid var(--border)', background: 'var(--surface)' }} data-testid="lien-cal-key" onKeyDown={(e) => { if (e.key === 'Escape' && openGlyph) onToggle(openGlyph) }}>
      {open ? (
        <div role="region" aria-label={open.short} data-testid="lien-cal-key-panel" style={{ display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr) auto', gap: '0 12px', alignItems: 'start', margin: '8px 8px 2px', padding: '10px 12px', border: '1px solid var(--border-strong)', borderRadius: 10, background: 'var(--bg-subtle)' }}>
          <span style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
            <Glyph kind={open.glyph} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: 2 }}>{open.short}</div>
            <div style={{ fontSize: '0.75rem', lineHeight: 1.45, color: 'var(--text-700)' }}>{open.long}</div>
            {open.door && doors.has(open.door) ? (
              <button type="button" onClick={() => onDoor(open.door!)} style={{ marginTop: 6, font: 'inherit', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-amber-800)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                {open.door === 'kinds' ? 'Set kinds, biggest first ›' : open.door === 'record' ? 'Record the mailing ›' : 'Draft the notices ›'}
              </button>
            ) : null}
          </div>
          <button type="button" aria-label="Close the key" onClick={() => onToggle(open.glyph)} style={{ font: 'inherit', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'inherit', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', lineHeight: 1 }}>
            ×
          </button>
        </div>
      ) : null}
      <div role="group" aria-label="Key — what each mark means" style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '3px 8px', overflowX: 'auto' }}>
        <span style={{ flex: 'none', fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginRight: 4 }}>Key · tap a mark</span>
        {LIEN_CALENDAR_KEY.map((k) => {
          const on = k.glyph === openGlyph
          return (
            <button key={k.glyph} type="button" aria-pressed={on} onClick={() => onToggle(k.glyph)} className="lienCalendarKeyMark" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flex: 'none', height: 24, padding: '0 7px', border: 'none', borderRadius: 6, background: on ? 'var(--text-strong)' : 'transparent', color: on ? 'var(--surface)' : 'var(--text-700)', cursor: 'pointer', font: 'inherit', fontSize: '0.6875rem', fontWeight: on ? 600 : 400, whiteSpace: 'nowrap' }}>
              <span style={{ height: 16, display: 'inline-flex', alignItems: 'center' }}>
                <Glyph kind={k.glyph} />
              </span>
              {k.short}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** A phone row: the job and its money, then its dates. On Later (v2.7254) the dates lead with who the job is under and end with the days since billed. */
function PhoneJobRow({ j, closed, later, onOpenJob, onOpenJobWindow, onOpenLastWork, mark }: { j: LienCalendarJob; closed: boolean; later?: LienLaterLine; onOpenJob: (id: string) => void; onOpenJobWindow?: (id: string) => void; onOpenLastWork?: (jobId: string) => void; mark?: LienSupplierMark }) {
  return (
    <div role="row" data-closed-here={closed ? 'true' : undefined} data-testid={later ? 'lien-cal-later-line' : undefined} onClick={() => onOpenJob(j.jobId)} style={{ boxSizing: 'border-box', width: '100%', minHeight: 44, textAlign: 'left', borderBottom: '1px solid var(--border)', background: 'var(--surface)', padding: '7px 12px', cursor: 'pointer' }}>
      <span style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
        <LienJobNumber number={j.number} muted={closed} onOpen={onOpenJobWindow ? () => onOpenJobWindow(j.jobId) : undefined} phone />
        {/* The row opens the job's Lien window wherever it is tapped; this button is its keyboard stop. */}
        <button type="button" style={{ flex: 1, minWidth: 0, display: 'flex', gap: 6, alignItems: 'center', border: 'none', background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: closed ? 500 : 600, color: closed ? 'var(--text-muted)' : undefined, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.name}</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums', color: j.runway.state === 'closed' ? 'var(--text-muted)' : undefined }}>{formatUsdNoCents(j.openBalance)}</span>
        </button>
      </span>
      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: '0.6875rem', marginTop: 1, position: 'relative' }}>
        <span title={j.runway.lines.join(' · ')} style={{ color: TONE[j.runway.tone], fontWeight: 600, minWidth: 0 }}>
          {later ? <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{`${later.who} · `}</span> : null}
          {lienPhoneLine(j)}
        </span>
        {j.runway.state === 'closed' && onOpenLastWork ? (
          <button
            type="button"
            data-testid="lien-cal-worked-later"
            aria-label={lienWorkedLaterLabel(j.number)}
            onClick={(e) => {
              e.stopPropagation()
              onOpenLastWork(j.jobId)
            }}
            style={{ flex: 'none', minHeight: 28, border: 'none', padding: '0 2px', backgroundColor: 'transparent', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--text-link)', cursor: 'pointer' }}
          >
            {LIEN_WORKED_LATER}
          </button>
        ) : null}
        {later && !closed ? (
          <span style={{ flex: 'none' }}>
            <BilledAge line={later} meter={false} />
          </span>
        ) : null}
        <LienSupplierMarkLine mark={mark} short />
      </span>
    </div>
  )
}

/** Phone: the buckets as sections of two-line sentences — no axis. Later is its lines, oldest bill first, with no group heads (v2.7254). */
function PhoneBoard({ shown, folded, onFold, onDraft, onRecord, onOpenJob, onOpenJobWindow, onOpenLastWork, query, onClearQuery, marks, todayYmd }: { /** A lien-gone row's Worked later? press (v2.6849); left out, the row has none. */ onOpenLastWork?: (jobId: string) => void; shown: LienCalendarBucket[]; folded: ReadonlySet<string>; onFold: (key: string) => void; onRecord?: (jobIds: string[]) => void; onDraft?: (ymd: string, jobIds: string[]) => void; onOpenJob: (id: string) => void; onOpenJobWindow?: (id: string) => void; query: string; onClearQuery: () => void; marks?: ReadonlyMap<string, LienSupplierMark>; todayYmd: string }) {
  return (
    <div data-testid="lien-cal-phone">
      {shown.map((b) => {
        const open = !folded.has(b.key)
        return (
          <section key={b.key} aria-label={b.title} data-testid={`lien-cal-bucket-${b.key}`} style={BUCKET_SECTION}>
            <BucketBar b={b} open={open} onToggle={() => onFold(b.key)} onDraft={onDraft} onRecord={onRecord} top={0} phone />
            {open && b.jobs.length === 0 ? <EmptyState compact {...(query.trim() ? lienCalendarSearchEmptyWords(query, onClearQuery) : { main: b.empty })} /> : null}
            {open && b.key === 'later' ? (
              <div data-testid="lien-cal-later-list">
                {lienLaterLines(b, todayYmd).map((l) => (
                  <PhoneJobRow key={l.job.jobId} j={l.job} closed={l.closed} later={l} onOpenJob={onOpenJob} onOpenJobWindow={onOpenJobWindow} onOpenLastWork={onOpenLastWork} mark={marks?.get(l.job.jobId)} />
                ))}
              </div>
            ) : null}
            {open && b.key !== 'later'
              ? b.groups.map((g) => (
                  <div key={g.key}>
                    {g.kind !== 'gone' ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 8, padding: '5px 12px', borderBottom: '1px solid var(--border)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <span data-testid="lien-cal-group-line" style={{ minWidth: 0 }}>{lienGroupLine(g)}</span>
                        <span style={{ fontWeight: 600, color: TONE[g.tone], whiteSpace: 'nowrap' }}>{g.word}</span>
                      </div>
                    ) : null}
                    {lienGroupRows(g).map((row) => {
                      if (row.kind === 'label') return <PropertyLabel key={row.key} label={row.label} tally={row.tally} phone />
                      return <PhoneJobRow key={row.job.jobId} j={row.job} closed={row.closed} onOpenJob={onOpenJob} onOpenJobWindow={onOpenJobWindow} onOpenLastWork={onOpenLastWork} mark={marks?.get(row.job.jobId)} />
                    })}
                  </div>
                ))
              : null}
            <div aria-hidden style={BUCKET_SPACER} />
          </section>
        )
      })}
    </div>
  )
}

export default function LienDeskCalendarTab({ rows, todayYmd, onOpenJob, onOpenJobWindow, onOpenLastWork, isMobile = false, canWrite = false, onDraft, onRecord, onOpenEditJob, onChanged, supplierMarks }: LienDeskCalendarTabProps) {
  const [query, setQuery] = useState('')
  const [pen, setPen] = useState<PenTarget | null>(null)
  const [kindsOpen, setKindsOpen] = useState(false)
  const [pick, setPick] = useState<BoardPick>('all')
  // One set for both folds: a bucket by its key, a GC group as "bucket/group". Overdue starts folded, and Later too
  // (v2.7254, the owner's word): nothing in it is due for two months, so its band alone shows until it is pressed.
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set(START_FOLDED))
  const [keyGlyph, setKeyGlyph] = useState<LienCalendarKeyGlyph | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  // Houses owed (v2.4407): a lens, not a bucket. It keeps the months and shows only the jobs that still owe a supply house.
  const [housesOnly, setHousesOnly] = useState(false)
  const houseRows = useMemo(() => (rows && supplierMarks ? rows.filter((r) => r.runway.state !== 'none' && supplierMarks.has(r.jobId)) : []), [rows, supplierMarks])
  const lensOn = housesOnly && houseRows.length > 0
  const board = useMemo(() => buildLienCalendarBoard(lensOn ? houseRows : (rows ?? []), query, todayYmd), [rows, houseRows, lensOn, query, todayYmd])
  const axis = useMemo(() => (rows && rows.length ? lienCalendarAxis(rows.filter((r) => r.runway.state !== 'none'), todayYmd) : null), [rows, todayYmd])
  // All shows every bucket that holds a job; a picked pill shows its bucket even when it is empty.
  // v2.4526: under All an overdue job is listed with its property; Overdue picked on its own lists every one of its jobs.
  const shown = useMemo(
    () => (pick === 'all' ? board.buckets.filter((b) => b.jobs.length > 0) : board.buckets.filter((b) => b.key === pick).map((b) => (b.whole ? { ...b, groups: b.whole.groups, facts: b.whole.facts, summary: b.whole.summary } : b))),
    [board, pick],
  )
  const counts = useMemo(() => lienNextDateCounts(shown), [shown])
  const liveJobs = useMemo(() => board.buckets.flatMap((b) => b.jobs), [board])
  const firstDraft = board.buckets.find((b) => b.draft)?.draft ?? null
  const penOn = canWrite && !isMobile
  // A search that hides every billed job quotes it and offers Clear the search (punch list #184, sweep C), on the board and in a bucket.
  const clearQuery = () => setQuery('')
  const searchEmpty = lienCalendarSearchEmptyWords(query, clearQuery)
  const saved = (what: 'promise' | 'kind') => {
    setPen(null)
    onChanged?.(what)
  }
  const fold = (key: string) =>
    setFolded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const choose = (p: BoardPick) => {
    setPick(p)
    setPen(null)
    // All is the first view again: Overdue and Later folded, every group open. A picked bucket opens.
    if (p === 'all') setFolded(new Set(START_FOLDED))
    else
      setFolded((prev) => {
        const next = new Set(prev)
        next.delete(p)
        return next
      })
  }
  const picked = pick === 'all' ? null : board.buckets.find((b) => b.key === pick) ?? null
  const band = picked && axis ? { from: picked.span.fromYmd ? axis.pct(picked.span.fromYmd) : 0, to: picked.span.toYmd ? axis.pct(picked.span.toYmd) : 100, color: BUCKET_TONE[picked.key].band } : null
  const housesLens =
    houseRows.length > 0 ? (
      <button
        type="button"
        className={`lienCalPill${isMobile ? ' lienCalPillPhone' : ''}`}
        aria-pressed={lensOn}
        aria-label={`Show only jobs where a supply house is still owed · ${jobsWord(houseRows.length)}`}
        title="Show only the jobs where a supply house is still owed"
        data-testid="lien-cal-houses-lens"
        onClick={() => {
          setHousesOnly((v) => !v)
          setPen(null)
        }}
        style={{ '--pill-ink': 'var(--text-700)', '--pill-bg': lensOn ? 'var(--bg-blue-tint)' : 'var(--surface)', '--pill-border': lensOn ? 'var(--border-blue)' : 'var(--border)', ...(isMobile ? null : { minHeight: 28, padding: '0 8px' }) } as CSSProperties}
      >
        <Store size={15} aria-hidden />
        <span className="lienCalPillCount">{houseRows.length}</span>
      </button>
    ) : null
  const doors = new Set<NonNullable<LienCalendarKeyEntry['door']>>()
  if (penOn) doors.add('kinds')
  if (firstDraft && onDraft) doors.add('draft')
  const firstRecord = board?.buckets.find((b) => b.record)?.record ?? null
  if (firstRecord && onRecord) doors.add('record')

  return (
    <div className="lienDeskCalendar" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      {rows ? (
        <div className="lienCalToolbar" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: isMobile ? '8px 12px' : '8px 12px', borderBottom: '1px solid var(--border)', flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : undefined, flex: 'none' }}>
          {isMobile ? (
            <button type="button" className="lienCalPill lienCalPillPhone" aria-label="Search" aria-expanded={searchOpen || Boolean(query)} onClick={() => setSearchOpen((o) => !o)} style={{ '--pill-ink': 'var(--text-muted)' } as CSSProperties}>
              ⌕
            </button>
          ) : null}
          {isMobile ? housesLens : null}
          <Pills board={board} pick={pick} onPick={choose} phone={isMobile} />
          <KindsChip n={board.kindsUnset} open={kindsOpen} onToggle={penOn ? () => setKindsOpen((o) => !o) : undefined} />
        </div>
      ) : null}
      {rows && isMobile && (searchOpen || query) ? (
        <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', flex: 'none' }}>
          <label className="lienCalSearch">
            <span aria-hidden style={{ color: 'var(--text-muted)' }}>⌕</span>
            <input type="search" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Job #, name, customer, GC, address" aria-label="Search the lien calendar" />
          </label>
        </div>
      ) : null}
      {rows && kindsOpen && penOn ? <KindsSheet jobs={liveJobs} onClose={() => setKindsOpen(false)} onOpenEditJob={onOpenEditJob} onSaved={saved} /> : null}
      {rows && !isMobile && axis && (board.count > 0 || query.trim()) ? (
        // The date row is a fixed row above the list, not a sticky row inside it (v2.4766): a sticky row can lag
        // the scroll in Safari and let a scrolled row show above it. `scrollbar-gutter: stable` here and on the
        // list keeps the columns aligned when the list draws a scrollbar.
        <div style={{ flex: 'none', overflow: 'hidden', scrollbarGutter: 'stable', background: 'var(--surface)' }}>
          <DateRow axis={axis} counts={counts} query={query} onQuery={setQuery} lens={housesLens} />
        </div>
      ) : null}
      <div data-lien-cal-list style={{ flex: '1 1 auto', overflowY: 'auto', minHeight: 0, position: 'relative', scrollbarGutter: 'stable' }}>
        {!rows ? <div style={{ padding: '1.5rem 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Reading the board…</div> : null}
        {rows && board.count === 0 && !query.trim() ? <EmptyState compact {...LIEN_CALENDAR_EMPTY} /> : null}
        {rows && isMobile && (board.count > 0 || query.trim()) ? (
          board.count === 0 ? (
            <EmptyState compact {...searchEmpty} />
          ) : (
            <PhoneBoard shown={shown} folded={folded} onFold={fold} onDraft={onDraft} onRecord={onRecord} onOpenJob={onOpenJob} onOpenJobWindow={onOpenJobWindow} onOpenLastWork={onOpenLastWork} query={query} onClearQuery={clearQuery} marks={supplierMarks} todayYmd={todayYmd} />
          )
        ) : null}
        {rows && !isMobile && axis && (board.count > 0 || query.trim()) ? (
          <div style={{ position: 'relative' }}>
            {board.count === 0 ? (
              <div style={ABOVE_LINES}>
                <EmptyState compact {...searchEmpty} />
              </div>
            ) : null}
            {board.count > 0
              ? shown.map((b) => {
                  const open = !folded.has(b.key)
                  return (
                    <section key={b.key} aria-label={b.title} data-testid={`lien-cal-bucket-${b.key}`} style={BUCKET_SECTION}>
                      <BucketBar b={b} open={open} onToggle={() => fold(b.key)} onDraft={onDraft} onRecord={onRecord} top={0} />
                      {open && b.jobs.length === 0 ? (
                        <div style={ABOVE_LINES}>
                          <EmptyState compact {...(query.trim() ? searchEmpty : { main: b.empty })} />
                        </div>
                      ) : null}
                      {open && b.key === 'later' && b.jobs.length > 0 ? <LaterList lines={lienLaterLines(b, todayYmd)} onOpenJob={onOpenJob} onOpenJobWindow={onOpenJobWindow} onOpenLastWork={onOpenLastWork} marks={supplierMarks} /> : null}
                      {open && b.key !== 'later'
                        ? b.groups.map((g) => {
                            const scope = `${b.key}/${g.key}`
                            // Overdue's one group is the bar itself: its rows sit straight under it.
                            const headed = g.kind !== 'gone'
                            const groupOpen = !headed || !folded.has(scope)
                            return (
                              <div key={g.key} style={{ position: 'relative' }}>
                                {headed ? <GroupLine g={g} open={groupOpen} onToggle={() => fold(scope)} todayYmd={todayYmd} onPen={penOn ? () => setPen({ kind: 'group', group: g, pct: 0, scope }) : undefined} /> : null}
                                {pen && pen.kind === 'group' && pen.scope === scope ? (
                                  <div style={{ ...GRID, position: 'absolute', left: 0, right: 0, top: 0, pointerEvents: 'none' }}>
                                    <div />
                                    <div style={{ position: 'relative', pointerEvents: 'auto' }}>
                                      <TheySaidPopover target={pen} todayYmd={todayYmd} onCancel={() => setPen(null)} onSaved={saved} />
                                    </div>
                                    <div />
                                  </div>
                                ) : null}
                                {groupOpen
                                  ? lienGroupRows(g).map((row, index) => {
                                      if (row.kind === 'label') return <PropertyLabel key={row.key} label={row.label} tally={row.tally} />
                                      const j = row.job
                                      return (
                                      <div key={j.jobId} style={{ position: 'relative' }}>
                                        <JobRow j={j} g={g} index={index} closedHere={row.closed} axis={axis} onRecord={onRecord} onOpen={() => onOpenJob(j.jobId)} onOpenJob={onOpenJobWindow ? () => onOpenJobWindow(j.jobId) : undefined} onPen={penOn ? (pct) => setPen({ kind: 'job', job: j, pct }) : undefined} mark={supplierMarks?.get(j.jobId)} onLastWork={onOpenLastWork ? () => onOpenLastWork(j.jobId) : undefined} onKinds={penOn ? () => setKindsOpen(true) : undefined} />
                                        {pen && pen.kind === 'job' && pen.job.jobId === j.jobId ? (
                                          <div style={{ ...GRID, position: 'absolute', left: 0, right: 0, top: 0, pointerEvents: 'none' }}>
                                            <div />
                                            <div style={{ position: 'relative', pointerEvents: 'auto' }}>
                                              <TheySaidPopover target={pen} todayYmd={todayYmd} onCancel={() => setPen(null)} onSaved={saved} />
                                            </div>
                                            <div />
                                          </div>
                                        ) : null}
                                      </div>
                                      )
                                    })
                                  : null}
                              </div>
                            )
                          })
                        : null}
                      <div aria-hidden style={BUCKET_SPACER} />
                    </section>
                  )
                })
              : null}
            {/* the picked bucket's stretch, the column rules and the one today line, drawn once over the whole board */}
            <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...GRID, alignItems: 'stretch' }}>
              <div />
              <div style={{ position: 'relative' }}>
                {band ? <div className="lienCalBand" data-testid="lien-cal-band" style={{ position: 'absolute', left: `${band.from}%`, width: `${Math.max(0, band.to - band.from)}%`, top: 0, bottom: 0, background: band.color }} /> : null}
                {axis.columns.map((c) => (
                  <div key={c.ymd} style={{ position: 'absolute', left: `${c.pct}%`, top: 0, bottom: 0, width: 0, borderLeft: '1px dashed var(--border)' }} />
                ))}
                <div style={{ position: 'absolute', left: `${axis.todayPct}%`, top: 0, bottom: 0, width: 2, background: 'var(--text-strong)', opacity: 0.85 }} data-testid="lien-cal-today-line" />
              </div>
              <div />
            </div>
          </div>
        ) : null}
      </div>
      {rows && axis && !isMobile && board.count > 0 ? (
        <KeyStrip
          openGlyph={keyGlyph}
          onToggle={(g) => setKeyGlyph((cur) => (cur === g ? null : g))}
          doors={doors}
          onDoor={(door) => {
            setKeyGlyph(null)
            if (door === 'kinds' && penOn) setKindsOpen(true)
            if (door === 'draft' && firstDraft) onDraft?.(firstDraft.ymd, firstDraft.jobIds)
            if (door === 'record' && firstRecord) onRecord?.(firstRecord.jobIds)
          }}
        />
      ) : null}
    </div>
  )
}
