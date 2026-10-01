import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import {
  LIEN_CALENDAR_KEY,
  groupPayYmd,
  kindsQueue,
  lienCalendarAxis,
  lienCalendarGroupFlags,
  lienCalendarMarks,
  promiseConsequence,
  rowWord,
  whoseWordOptions,
  type LienCalendarAxis,
  type LienCalendarGroup,
  type LienCalendarJob,
  type LienCalendarKeyEntry,
  type LienCalendarKeyGlyph,
  type LienCalendarMark,
} from '../../lib/jobs/lienCalendar'
import { buildLienCalendarBoard, lienNextDateCounts, lienPhoneLine, type LienCalendarBoard, type LienCalendarBucket, type LienCalendarBucketKey, type LienNextDateCount } from '../../lib/jobs/lienCalendarBuckets'
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
 */

export type LienDeskCalendarTabProps = {
  /** Null while the Pipeline reads its billed jobs and their clocks: the tab says so instead of counting 0 jobs (v2.4321). */
  rows: ReadonlyArray<LienCalendarJob> | null
  todayYmd: string
  onOpenJob: (jobId: string) => void
  /** Phone: no axis, the column cards and the sentences instead. */
  isMobile?: boolean
  /** Office roles write; everyone else reads (the dot opens the Lien window instead). */
  canWrite?: boolean
  /** Draft the N: the desk narrows its notice list to these jobs. */
  onDraft?: (ymd: string, jobIds: string[]) => void
  /** Set property kind on a job with no linked property record — Edit Job on the Property record row. */
  onOpenEditJob?: (jobId: string) => void
  /** The pen wrote something: a promise, or a property kind. */
  onChanged?: (what: 'promise' | 'kind') => void
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
const cellNum: CSSProperties = { fontSize: '0.6875rem', fontWeight: 700, padding: '0 5px', borderRadius: 3, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)', whiteSpace: 'nowrap' }
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

function markTitle(m: LienCalendarMark, j: LienCalendarJob): string {
  switch (m.kind) {
    case 'work':
      return m.fromCreation ? `No approved hours — the board counts from the month the job was created (${labelOf(m.ymd)}). Approve the hours or check the month before a notice goes out.` : `Last day worked: ${labelOf(m.ymd)} — the lien date counts from its month, each notice from its own month`
    case 'gone':
      return m.by === 'notice' ? `The § 53.056 notice was due ${labelOf(m.ymd)} and none is recorded — the lien for that work is gone. Nothing can be filed after this day; the money is still owed.` : `The § 53.052 window closed ${labelOf(m.ymd)} with nothing filed — the lien is gone. Nothing can be filed after this day; the money is still owed.`
    case 'pay':
      return `Expected to pay ${labelOf(m.ymd)} — ${j.runway.lines[0] ?? ''}`.trim()
    case 'pay_missing':
      return 'No pay date yet — click to record what they said'
    case 'notice':
      return m.done ? `The ${monthWords(m.monthKey)} notice is on file` : `A § 53.056 notice is owed for ${monthWords(m.monthKey)} — send it by ${labelOf(m.ymd)}`
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

/** One row's marks laid on the shared axis. */
function Track({ marks, j, onOpen, onPen }: { marks: LienCalendarMark[]; j: LienCalendarJob; onOpen: () => void; onPen?: (pct: number) => void }) {
  const gone = marks.find((m): m is Extract<LienCalendarMark, { kind: 'gone' }> => m.kind === 'gone') ?? null
  return (
    <div style={{ position: 'relative', height: TRACK_H }} data-testid="lien-cal-track">
      <div style={{ position: 'absolute', left: 0, right: gone ? `${100 - gone.pct}%` : 0, top: LINE_Y, height: 1, background: 'var(--border-strong)' }} />
      {gone ? (
        <div title={markTitle(gone, j)} data-testid="lien-cal-gone" style={{ position: 'absolute', left: `${gone.pct}%`, right: 0, top: 0, bottom: 0, background: 'var(--bg-subtle)', borderLeft: `2px solid ${RED_INK}`, zIndex: 0 }}>
          {/* v2.4340: the Overdue bar says "nothing left to file" once; the row keeps the day its lien died, the reason on hover. */}
          <span style={{ position: 'absolute', left: 8, top: LINE_Y + 3, fontSize: 10, fontWeight: 600, color: 'var(--text-red-700)', whiteSpace: 'nowrap' }}>{gone.label}</span>
        </div>
      ) : null}
      {marks.map((m, i) => {
        const title = markTitle(m, j)
        if (m.kind === 'gone') return null
        if (m.kind === 'work') {
          // On a dead row the reason sits under the red flag; the tick keeps its date only when there is room before the wash.
          const labelled = !gone || gone.pct - m.pct >= 12
          return (
            <div key={i} title={title} data-testid="lien-cal-work" style={{ position: 'absolute', left: `calc(${m.pct}% - 1px)`, top: LINE_Y - 8, width: 2, height: 8, background: m.fromCreation ? 'transparent' : 'var(--text-muted)', borderLeft: m.fromCreation ? `2px dashed ${NOTICE_INK}` : 'none', zIndex: 1 }}>
              {labelled ? <span style={{ position: 'absolute', left: m.offAxis ? 4 : undefined, top: 11, transform: m.offAxis ? 'none' : 'translateX(-50%)', fontSize: 10, lineHeight: 1, whiteSpace: 'nowrap', color: m.fromCreation ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>{m.label}</span> : null}
            </div>
          )
        }
        if (m.kind === 'run') return <div key={i} title={title} style={{ position: 'absolute', left: `${m.fromPct}%`, width: `${Math.max(0.4, m.toPct - m.fromPct)}%`, top: LINE_Y - 2, height: 5, borderRadius: 3, background: m.short ? HATCH : '#86efac' }} />
        if (m.kind === 'bracket') return <div key={i} title={title} style={{ position: 'absolute', left: `${m.fromPct}%`, width: `${Math.max(0.4, m.toPct - m.fromPct)}%`, top: LINE_Y - 2, height: 5, borderRadius: 3, background: STRIPE, opacity: 0.9 }} />
        if (m.kind === 'pay')
          return (
            <button key={i} type="button" title={onPen ? `${title} — click to change it` : title} aria-label={`When ${j.customer || j.name} said they would pay: ${labelOf(m.ymd)} · ${j.number}`} onClick={() => (onPen ? onPen(m.pct) : onOpen())} style={{ position: 'absolute', left: `calc(${m.pct}% - 5px)`, top: LINE_Y - 5, width: 11, height: 11, borderRadius: '50%', background: '#16a34a', border: '2px solid var(--surface)', boxShadow: '0 0 0 1px #16a34a', padding: 0, cursor: 'pointer' }} />
          )
        if (m.kind === 'pay_missing')
          return <button key={i} type="button" title={title} aria-label={`Record when ${j.customer || j.name} expects to pay · ${j.number}`} onClick={() => (onPen ? onPen(m.pct) : onOpen())} style={{ position: 'absolute', left: `calc(${m.pct}% - 7px)`, top: LINE_Y - 7, width: 14, height: 14, borderRadius: '50%', border: '2px dashed #16a34a', background: 'var(--surface)', padding: 0, opacity: 0.75, cursor: 'pointer' }} />
        if (m.kind === 'notice')
          return m.done ? (
            <div key={i} title={title} style={{ position: 'absolute', left: `calc(${m.pct}% - 6px)`, top: LINE_Y - 6, width: 12, height: 12, borderRadius: '50%', background: GREEN_INK, color: '#fff', fontSize: 9, lineHeight: '12px', textAlign: 'center', fontWeight: 700 }}>✓</div>
          ) : (
            <button key={i} type="button" title={title} aria-label={title} onClick={onOpen} style={{ position: 'absolute', left: `calc(${m.pct}% - 1px)`, top: LINE_Y - FLAG_H, width: 14, height: FLAG_H, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <span style={{ position: 'absolute', left: 0, top: 0, width: 2, height: FLAG_H, background: noticeInk(m.tone) }} />
              <span style={{ position: 'absolute', left: 2, top: 0, width: 10, height: 8, background: noticeInk(m.tone), clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />
              <span style={{ position: 'absolute', left: 3.5, top: 1.5, width: 6, height: 5, background: 'var(--surface)', clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />
            </button>
          )
        // the lien flag, slate — on a dead row, red on the day the lien died
        const color = m.closed ? RED_INK : lienInk(m.tone)
        return (
          <div key={i} title={title} style={{ position: 'absolute', left: `calc(${m.pct}% - 1px)`, top: LINE_Y - FLAG_H, width: 12, height: FLAG_H, zIndex: 1 }}>
            <span style={{ position: 'absolute', left: 0, top: 0, width: 2, height: FLAG_H, background: color }} />
            <span style={{ position: 'absolute', left: 2, top: 0, width: 10, height: 8, background: color, clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />
          </div>
        )
      })}
    </div>
  )
}

function GroupTrack({ g, axis, onPen }: { g: LienCalendarGroup; axis: LienCalendarAxis; onPen?: (pct: number) => void }) {
  const flags = lienCalendarGroupFlags(g, axis)
  const word = g.kind === 'gc' ? groupPayYmd(g.jobs, axis.todayYmd) : null
  const dotPct = word ? axis.pct(word) : axis.pct(addDaysYmd(axis.todayYmd, 2))
  return (
    <div style={{ position: 'relative', height: TRACK_H }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: LINE_Y, height: 1, background: 'var(--border-strong)' }} />
      {g.kind === 'gc' && onPen ? (
        word ? (
          <button type="button" title={`${g.name} said ${labelOf(word)} — one word for all ${g.jobs.length} jobs. Click to change it.`} aria-label={`${g.name}'s word: ${labelOf(word)}`} onClick={() => onPen(dotPct)} style={{ position: 'absolute', left: `calc(${dotPct}% - 5px)`, top: LINE_Y - 5, width: 11, height: 11, borderRadius: '50%', background: '#16a34a', border: '2px solid var(--surface)', boxShadow: '0 0 0 1px #16a34a', padding: 0, cursor: 'pointer', zIndex: 1 }} />
        ) : (
          <button type="button" title={`No one date for ${g.name}'s jobs yet — click to give the GC's word for all of them`} aria-label={`Record ${g.name}'s word for all ${g.jobs.length} jobs`} onClick={() => onPen(dotPct)} style={{ position: 'absolute', left: `calc(${dotPct}% - 7px)`, top: LINE_Y - 7, width: 14, height: 14, borderRadius: '50%', border: '2px dashed #16a34a', background: 'var(--surface)', padding: 0, opacity: 0.75, cursor: 'pointer', zIndex: 1 }} />
        )
      ) : null}
      {flags.map((f) => {
        // One date, two inks: the notices' hollow amber flag, then the liens' slate flag beside it, each with its count.
        const title = `${f.notices ? `${f.notices} ${f.notices === 1 ? 'notice' : 'notices'} owed` : ''}${f.notices && f.liens ? ' · ' : ''}${f.liens ? `${f.liens} ${f.liens === 1 ? 'lien' : 'liens'} to file` : ''} by ${labelOf(f.ymd)}`
        const parts: Array<{ kind: 'notice' | 'lien'; n: number; ink: string }> = []
        if (f.notices) parts.push({ kind: 'notice', n: f.notices, ink: noticeInk(f.tone) })
        if (f.liens) parts.push({ kind: 'lien', n: f.liens, ink: g.kind === 'gone' ? RED_INK : lienInk(f.tone) })
        return (
          <div key={f.ymd} title={title} style={{ position: 'absolute', left: `calc(${f.pct}% - 1px)`, top: LINE_Y - FLAG_H, width: 14 * parts.length + 12, height: FLAG_H + 14 }}>
            {parts.map((p, i) => (
              <span key={p.kind} style={{ position: 'absolute', left: i * 14, top: 0, width: 14, height: FLAG_H }}>
                <span style={{ position: 'absolute', left: 0, top: 0, width: 2, height: FLAG_H, background: p.ink }} />
                <span style={{ position: 'absolute', left: 2, top: 0, width: 10, height: 8, background: p.ink, clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />
                {p.kind === 'notice' ? <span style={{ position: 'absolute', left: 3.5, top: 1.5, width: 6, height: 5, background: 'var(--surface)', clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} /> : null}
                {p.n > 1 ? <span style={{ position: 'absolute', left: 4, top: FLAG_H + 2, fontSize: 10, lineHeight: 1, fontWeight: 700, color: p.ink }}>{p.n}</span> : null}
              </span>
            ))}
          </div>
        )
      })}
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

function GroupHeader({ g, open, onToggle, axis, onPen }: { g: LienCalendarGroup; open: boolean; onToggle: () => void; axis: LienCalendarAxis | null; onPen?: (pct: number) => void }) {
  const left = (
    <button type="button" aria-expanded={open} onClick={onToggle} style={{ textAlign: 'left', border: 'none', background: 'none', padding: '6px 10px', display: 'flex', gap: 8, alignItems: 'center', minWidth: 0, cursor: 'pointer', color: 'inherit', width: '100%' }}>
      <span aria-hidden style={{ color: 'var(--text-muted)' }}>{open ? '▾' : '▸'}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</span>
        <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.sub}</span>
      </span>
    </button>
  )
  const right = (
    <div style={{ padding: '0 14px', textAlign: 'right' }}>
      <div style={{ fontSize: '0.8125rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(g.total)}</div>
      <div title={g.word} style={{ fontSize: '0.6875rem', fontWeight: 700, color: TONE[g.tone], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.word}</div>
    </div>
  )
  return (
    <div style={{ ...GRID, background: g.kind === 'gone' ? 'var(--bg-red-tint)' : 'var(--bg-subtle)', borderTop: '2px solid var(--border-strong)', borderBottom: '1px solid var(--border)', minHeight: ROW_H }} data-testid={`lien-cal-group-${g.key}`}>
      {left}
      {axis ? <GroupTrack g={g} axis={axis} onPen={onPen} /> : <div />}
      {right}
    </div>
  )
}

function JobRow({ j, g, index, axis, onOpen, onPen }: { j: LienCalendarJob; g: LienCalendarGroup; index: number; axis: LienCalendarAxis | null; onOpen: () => void; onPen?: (pct: number) => void }) {
  // Under a GC row its one dot speaks for every job; a job draws the dashed dot only on its own.
  const marks = axis ? lienCalendarMarks(j, axis, { payMissingDot: g.kind !== 'gc' }) : []
  const word = rowWord(j, g)
  const dead = j.runway.state === 'closed'
  return (
    <div role="row" className="lienCalendarRow" style={{ ...GRID, minHeight: ROW_H, background: index % 2 === 1 ? 'var(--bg-subtle)' : 'var(--surface)' }}>
      <button type="button" onClick={onOpen} title="Open the job’s Lien window" style={{ minWidth: 0, textAlign: 'left', border: 'none', background: 'none', padding: '4px 10px 4px 30px', cursor: 'pointer', color: 'inherit' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={cellNum}>{j.number}</span>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.name}</span>
        </span>
        <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {j.customer}
          {j.address ? ` · ${j.address}` : ''}
        </span>
      </button>
      {axis ? <Track marks={marks} j={j} onOpen={onOpen} onPen={onPen} /> : <div />}
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

/** Each bucket's colours: Overdue red, This month amber, the months after it plain. */
const BUCKET_TONE: Record<LienCalendarBucketKey, { ink: string; bar: string; rule: string; band: string; pillBg: string; pillBorder: string }> = {
  overdue: { ink: 'var(--text-red-700)', bar: 'var(--bg-red-tint)', rule: 'var(--border-red)', band: 'var(--bg-red-100)', pillBg: 'var(--bg-red-tint)', pillBorder: 'var(--border-red)' },
  this_month: { ink: 'var(--text-amber-800)', bar: 'var(--bg-amber-tint)', rule: 'var(--border-amber)', band: 'var(--bg-amber-100)', pillBg: 'var(--bg-amber-tint)', pillBorder: 'var(--border-amber)' },
  next_month: { ink: 'var(--text-700)', bar: 'var(--bg-subtle)', rule: 'var(--border-strong)', band: 'var(--bg-blue-tint)', pillBg: 'var(--bg-blue-tint)', pillBorder: 'var(--border-blue)' },
  later: { ink: 'var(--text-700)', bar: 'var(--bg-subtle)', rule: 'var(--border-strong)', band: 'var(--bg-slate-100)', pillBg: 'var(--bg-blue-tint)', pillBorder: 'var(--border-blue)' },
}
/** The date row's height: the bucket bars stick under it. */
const DATE_ROW_H = 40
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
function DateRow({ axis, counts, query, onQuery }: { axis: LienCalendarAxis; counts: ReadonlyMap<string, LienNextDateCount>; query: string; onQuery: (q: string) => void }) {
  return (
    <div style={{ ...GRID, alignItems: 'center', height: DATE_ROW_H, borderBottom: '1px solid var(--border)' }} data-testid="lien-cal-dates">
      <div style={{ padding: '0 8px' }}>
        <label className="lienCalSearch">
          <span aria-hidden style={{ color: 'var(--text-muted)' }}>⌕</span>
          <input type="search" value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Job #, name, customer, GC, address" aria-label="Search the lien calendar" />
        </label>
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

/** A bucket's bar: the fold, the title and its facts, Draft the N where the desk lists them, and the money. */
function BucketBar({ b, open, onToggle, onDraft, top, phone }: { b: LienCalendarBucket; open: boolean; onToggle: () => void; onDraft?: (ymd: string, jobIds: string[]) => void; top: number; phone?: boolean }) {
  const tone = BUCKET_TONE[b.key]
  const caret = <span aria-hidden style={{ color: 'var(--text-muted)', width: 10, flex: 'none' }}>{open ? '▾' : '▸'}</span>
  const title = <strong style={{ fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: tone.ink, whiteSpace: 'nowrap' }}>{b.title}</strong>
  const money = <strong style={{ fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums', color: tone.ink, whiteSpace: 'nowrap' }}>{formatUsdNoCents(b.total)}</strong>
  const draft = b.draft && onDraft ? b.draft : null
  if (phone) {
    return (
      <div style={{ position: 'sticky', top, zIndex: 3 }}>
        <button type="button" aria-expanded={open} onClick={onToggle} title={b.key === 'overdue' ? OVERDUE_NOTE : undefined} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '2px 10px', alignItems: 'center', width: '100%', minHeight: 44, padding: '7px 12px', border: 'none', borderTop: `2px solid ${tone.rule}`, borderBottom: '1px solid var(--border)', background: tone.bar, textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            {caret}
            {title}
          </span>
          {money}
          {b.facts ? <span style={{ gridColumn: '1 / -1', fontSize: '0.75rem', color: 'var(--text-700)', paddingLeft: 16 }}>{b.facts}</span> : null}
        </button>
        {open && draft ? (
          <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
            <button type="button" className="lienCalDraft lienCalDraftPhone" onClick={() => onDraft?.(draft.ymd, draft.jobIds)}>
              {draft.label} ›
            </button>
          </div>
        ) : null}
      </div>
    )
  }
  return (
    <div style={{ position: 'sticky', top, zIndex: 3, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', alignItems: 'center', gap: 12, minHeight: 36, padding: '0 14px 0 6px', background: tone.bar, borderTop: `2px solid ${tone.rule}`, borderBottom: '1px solid var(--border)' }}>
      <button type="button" aria-expanded={open} onClick={onToggle} title={b.key === 'overdue' ? OVERDUE_NOTE : undefined} style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0, border: 'none', background: 'none', padding: '6px 4px', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
        {caret}
        {title}
        <span style={{ fontSize: '0.78rem', color: 'var(--text-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{b.facts}</span>
      </button>
      {draft ? (
        <button type="button" className="lienCalDraft" onClick={() => onDraft?.(draft.ymd, draft.jobIds)} title="Open the Notices tab on these jobs, ready to draft">
          {draft.label} ›
        </button>
      ) : (
        <span />
      )}
      {money}
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
                {open.door === 'kinds' ? 'Set kinds, biggest first ›' : 'Draft the notices ›'}
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

/** Phone: the buckets as sections of two-line sentences — no axis. */
function PhoneBoard({ shown, folded, onFold, onDraft, onOpenJob, query }: { shown: LienCalendarBucket[]; folded: ReadonlySet<string>; onFold: (key: string) => void; onDraft?: (ymd: string, jobIds: string[]) => void; onOpenJob: (id: string) => void; query: string }) {
  return (
    <div data-testid="lien-cal-phone">
      {shown.map((b) => {
        const open = !folded.has(b.key)
        return (
          <section key={b.key} aria-label={b.title} data-testid={`lien-cal-bucket-${b.key}`}>
            <BucketBar b={b} open={open} onToggle={() => onFold(b.key)} onDraft={onDraft} top={0} phone />
            {open && b.jobs.length === 0 ? <div style={{ padding: '0.9rem 12px', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{query.trim() ? 'No billed job matches that.' : b.empty}</div> : null}
            {open
              ? b.groups.map((g) => (
                  <div key={g.key}>
                    {g.kind !== 'gone' ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 8, padding: '7px 12px', background: 'var(--bg-muted)', borderBottom: '1px solid var(--border)' }}>
                        <strong style={{ fontSize: '0.8125rem', minWidth: 0 }}>{g.name}</strong>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: TONE[g.tone], whiteSpace: 'nowrap' }}>{g.word}</span>
                      </div>
                    ) : null}
                    {g.jobs.map((j) => (
                      <button key={j.jobId} type="button" onClick={() => onOpenJob(j.jobId)} style={{ display: 'block', width: '100%', minHeight: 44, textAlign: 'left', border: 'none', borderBottom: '1px solid var(--border)', background: 'var(--surface)', padding: '7px 12px', cursor: 'pointer', color: 'inherit', font: 'inherit' }}>
                        <span style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
                          <span style={cellNum}>{j.number}</span>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.name}</span>
                          <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums', color: j.runway.state === 'closed' ? 'var(--text-muted)' : undefined }}>{formatUsdNoCents(j.openBalance)}</span>
                        </span>
                        <span title={j.runway.lines.join(' · ')} style={{ display: 'block', fontSize: '0.6875rem', color: TONE[j.runway.tone], fontWeight: 600, marginTop: 1 }}>{lienPhoneLine(j)}</span>
                      </button>
                    ))}
                  </div>
                ))
              : null}
          </section>
        )
      })}
    </div>
  )
}

export default function LienDeskCalendarTab({ rows, todayYmd, onOpenJob, isMobile = false, canWrite = false, onDraft, onOpenEditJob, onChanged }: LienDeskCalendarTabProps) {
  const [query, setQuery] = useState('')
  const [pen, setPen] = useState<PenTarget | null>(null)
  const [kindsOpen, setKindsOpen] = useState(false)
  const [pick, setPick] = useState<BoardPick>('all')
  // One set for both folds: a bucket by its key, a GC group as "bucket/group". Overdue starts folded.
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set(['overdue']))
  const [keyGlyph, setKeyGlyph] = useState<LienCalendarKeyGlyph | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const board = useMemo(() => buildLienCalendarBoard(rows ?? [], query, todayYmd), [rows, query, todayYmd])
  const axis = useMemo(() => (rows && rows.length ? lienCalendarAxis(rows.filter((r) => r.runway.state !== 'none'), todayYmd) : null), [rows, todayYmd])
  // All shows every bucket that holds a job; a picked pill shows its bucket even when it is empty.
  const shown = useMemo(() => (pick === 'all' ? board.buckets.filter((b) => b.jobs.length > 0) : board.buckets.filter((b) => b.key === pick)), [board, pick])
  const counts = useMemo(() => lienNextDateCounts(shown), [shown])
  const liveJobs = useMemo(() => board.buckets.flatMap((b) => b.jobs), [board])
  const firstDraft = board.buckets.find((b) => b.draft)?.draft ?? null
  const penOn = canWrite && !isMobile
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
    // All is the first view again: Overdue folded, every group open. A picked bucket opens.
    if (p === 'all') setFolded(new Set(['overdue']))
    else
      setFolded((prev) => {
        const next = new Set(prev)
        next.delete(p)
        return next
      })
  }
  const picked = pick === 'all' ? null : board.buckets.find((b) => b.key === pick) ?? null
  const band = picked && axis ? { from: picked.span.fromYmd ? axis.pct(picked.span.fromYmd) : 0, to: picked.span.toYmd ? axis.pct(picked.span.toYmd) : 100, color: BUCKET_TONE[picked.key].band } : null
  const doors = new Set<NonNullable<LienCalendarKeyEntry['door']>>()
  if (penOn) doors.add('kinds')
  if (firstDraft && onDraft) doors.add('draft')

  return (
    <div className="lienDeskCalendar" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      {rows ? (
        <div className="lienCalToolbar" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: isMobile ? '8px 12px' : '8px 12px', borderBottom: '1px solid var(--border)', flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : undefined, flex: 'none' }}>
          {isMobile ? (
            <button type="button" className="lienCalPill lienCalPillPhone" aria-label="Search" aria-expanded={searchOpen || Boolean(query)} onClick={() => setSearchOpen((o) => !o)} style={{ '--pill-ink': 'var(--text-muted)' } as CSSProperties}>
              ⌕
            </button>
          ) : null}
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
      <div style={{ flex: '1 1 auto', overflowY: 'auto', minHeight: 0, position: 'relative' }}>
        {!rows ? <div style={{ padding: '1.5rem 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Reading the board…</div> : null}
        {rows && board.count === 0 && !query.trim() ? <div style={{ padding: '1.5rem 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Nothing billed is on a lien clock.</div> : null}
        {rows && isMobile && (board.count > 0 || query.trim()) ? (
          board.count === 0 ? (
            <div style={{ padding: '1.5rem 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No billed job matches that.</div>
          ) : (
            <PhoneBoard shown={shown} folded={folded} onFold={fold} onDraft={onDraft} onOpenJob={onOpenJob} query={query} />
          )
        ) : null}
        {rows && !isMobile && axis && (board.count > 0 || query.trim()) ? (
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'sticky', top: 0, zIndex: 4, background: 'var(--surface)' }}>
              <DateRow axis={axis} counts={counts} query={query} onQuery={setQuery} />
            </div>
            {board.count === 0 ? <div style={{ ...ABOVE_LINES, padding: '1.5rem 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No billed job matches that.</div> : null}
            {board.count > 0
              ? shown.map((b) => {
                  const open = !folded.has(b.key)
                  return (
                    <section key={b.key} aria-label={b.title} data-testid={`lien-cal-bucket-${b.key}`} style={{ position: 'relative' }}>
                      <BucketBar b={b} open={open} onToggle={() => fold(b.key)} onDraft={onDraft} top={DATE_ROW_H} />
                      {open && b.jobs.length === 0 ? <div style={{ ...ABOVE_LINES, padding: '1rem 14px 1rem 30px', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{query.trim() ? 'No billed job matches that.' : b.empty}</div> : null}
                      {open
                        ? b.groups.map((g) => {
                            const scope = `${b.key}/${g.key}`
                            // Overdue's one group is the bar itself: its rows sit straight under it.
                            const headed = g.kind !== 'gone'
                            const groupOpen = !headed || !folded.has(scope)
                            return (
                              <div key={g.key} style={{ position: 'relative' }}>
                                {headed ? <GroupHeader g={g} open={groupOpen} onToggle={() => fold(scope)} axis={axis} onPen={penOn ? (pct) => setPen({ kind: 'group', group: g, pct, scope }) : undefined} /> : null}
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
                                  ? g.jobs.map((j, index) => (
                                      <div key={j.jobId} style={{ position: 'relative' }}>
                                        <JobRow j={j} g={g} index={index} axis={axis} onOpen={() => onOpenJob(j.jobId)} onPen={penOn ? (pct) => setPen({ kind: 'job', job: j, pct }) : undefined} />
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
                                    ))
                                  : null}
                              </div>
                            )
                          })
                        : null}
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
          }}
        />
      ) : null}
    </div>
  )
}
