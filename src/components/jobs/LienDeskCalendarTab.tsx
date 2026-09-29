import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import {
  LIEN_CALENDAR_KEY,
  buildLienCalendar,
  groupPayYmd,
  kindsQueue,
  lienCalendarAxis,
  lienCalendarDensity,
  lienCalendarGroupFlags,
  lienCalendarMarks,
  lienCalendarTodo,
  promiseConsequence,
  whoseWordOptions,
  type LienCalendarAxis,
  type LienCalendarDensityColumn,
  type LienCalendarGroup,
  type LienCalendarJob,
  type LienCalendarMark,
  type LienCalendarTodo,
} from '../../lib/jobs/lienCalendar'
import type { LienRunwayTone } from '../../lib/jobs/lienPayRunway'
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
 */

export type LienDeskCalendarTabProps = {
  rows: ReadonlyArray<LienCalendarJob> | null
  loading: boolean
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

type PenTarget = { kind: 'job'; job: LienCalendarJob; pct: number } | { kind: 'group'; group: LienCalendarGroup; pct: number }


const TONE: Record<LienRunwayTone, string> = {
  green: 'var(--text-green-700)',
  amber: 'var(--text-amber-800)',
  red: 'var(--text-red-700)',
  grey: 'var(--text-muted)',
}
const FLAG: Record<LienRunwayTone, string> = { green: '#15803d', amber: '#b45309', red: '#b91c1c', grey: 'var(--text-700)' }
const HATCH = 'repeating-linear-gradient(135deg, #fca5a5 0 3px, var(--bg-red-tint) 3px 6px)'
const STRIPE = 'repeating-linear-gradient(90deg, #fcd34d 0 4px, #fef3c7 4px 8px)'
const LABEL_W = 'minmax(0, 300px)'
const RIGHT_W = '11rem'
const GRID: CSSProperties = { display: 'grid', gridTemplateColumns: `${LABEL_W} minmax(0, 1fr) ${RIGHT_W}`, alignItems: 'center' }
const cellNum: CSSProperties = { fontSize: '0.6875rem', fontWeight: 700, padding: '0 5px', borderRadius: 3, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)', whiteSpace: 'nowrap' }
const KEY_SEEN = 'pipetooling-lien-calendar-key-seen'

/** The glyphs, drawn once for the key and once per row — the same shapes the runway draws (v2.4051). */
function Glyph({ kind, tone = 'amber', count }: { kind: (typeof LIEN_CALENDAR_KEY)[number]['glyph'] | 'notice_done'; tone?: LienRunwayTone; count?: number }): ReactNode {
  const flag = FLAG[tone]
  switch (kind) {
    case 'today':
      return <span style={{ display: 'inline-block', width: 2, height: 16, background: 'var(--text-strong)' }} />
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
    case 'pay':
      return `Expected to pay ${labelOf(m.ymd)} — ${j.runway.lines[0] ?? ''}`.trim()
    case 'pay_missing':
      return 'No pay date yet — click to record what they said'
    case 'notice':
      return m.done ? `The ${monthWords(m.monthKey)} notice is on file` : `A § 53.056 notice is owed for ${monthWords(m.monthKey)} — send it by ${labelOf(m.ymd)}`
    case 'lien':
      return m.closed ? `The lien window closed ${labelOf(m.ymd)} — money still owed` : `Last day to file the lien affidavit: ${labelOf(m.ymd)} (§ 53.052)`
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
  return (
    <div style={{ position: 'relative', height: 28 }} data-testid="lien-cal-track">
      <div style={{ position: 'absolute', left: 0, right: 0, top: 13, height: 2, background: 'var(--border)' }} />
      {marks.map((m, i) => {
        const title = markTitle(m, j)
        if (m.kind === 'run') return <div key={i} title={title} style={{ position: 'absolute', left: `${m.fromPct}%`, width: `${Math.max(0.4, m.toPct - m.fromPct)}%`, top: 11, height: 6, borderRadius: 3, background: m.short ? HATCH : '#86efac' }} />
        if (m.kind === 'bracket') return <div key={i} title={title} style={{ position: 'absolute', left: `${m.fromPct}%`, width: `${Math.max(0.4, m.toPct - m.fromPct)}%`, top: 11, height: 6, borderRadius: 3, background: STRIPE, opacity: 0.9 }} />
        if (m.kind === 'pay')
          return (
            <button key={i} type="button" title={onPen ? `${title} — click to change it` : title} aria-label={`When ${j.customer || j.name} said they would pay: ${labelOf(m.ymd)} · ${j.number}`} onClick={() => (onPen ? onPen(m.pct) : onOpen())} style={{ position: 'absolute', left: `calc(${m.pct}% - 5px)`, top: 9, width: 10, height: 10, borderRadius: '50%', background: '#16a34a', border: '2px solid var(--surface)', boxShadow: '0 0 0 1px #16a34a', padding: 0, cursor: 'pointer' }} />
          )
        if (m.kind === 'pay_missing')
          return <button key={i} type="button" title={title} aria-label={`Record when ${j.customer || j.name} expects to pay · ${j.number}`} onClick={() => (onPen ? onPen(m.pct) : onOpen())} style={{ position: 'absolute', left: `calc(${m.pct}% - 7px)`, top: 7, width: 14, height: 14, borderRadius: '50%', border: '2px dashed #16a34a', background: 'var(--surface)', padding: 0, opacity: 0.75, cursor: 'pointer' }} />
        if (m.kind === 'notice')
          return m.done ? (
            <div key={i} title={title} style={{ position: 'absolute', left: `calc(${m.pct}% - 6px)`, top: 8, width: 12, height: 12, borderRadius: '50%', background: '#15803d', color: '#fff', fontSize: 9, lineHeight: '12px', textAlign: 'center', fontWeight: 700 }}>✓</div>
          ) : (
            <button key={i} type="button" title={title} aria-label={title} onClick={onOpen} style={{ position: 'absolute', left: `calc(${m.pct}% - 1px)`, top: 4, width: 14, height: 20, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <span style={{ position: 'absolute', left: 0, top: 0, width: 2, height: 20, background: FLAG[m.tone] }} />
              <span style={{ position: 'absolute', left: 2, top: 0, width: 9, height: 7, background: FLAG[m.tone], clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />
              <span style={{ position: 'absolute', left: 3.5, top: 1.5, width: 5, height: 4, background: 'var(--surface)', clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />
            </button>
          )
        // the lien flag
        const color = m.closed ? '#b91c1c' : FLAG[m.tone]
        return (
          <div key={i} title={title} style={{ position: 'absolute', left: `calc(${m.pct}% - 1px)`, top: 4, width: 12, height: 20 }}>
            <span style={{ position: 'absolute', left: 0, top: 0, width: 2, height: 20, background: color }} />
            <span style={{ position: 'absolute', left: 2, top: 0, width: 9, height: 7, background: color, clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />
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
    <div style={{ position: 'relative', height: 28 }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 13, height: 2, background: 'var(--border)' }} />
      {g.kind === 'gc' && onPen ? (
        word ? (
          <button type="button" title={`${g.name} said ${labelOf(word)} — one word for all ${g.jobs.length} jobs. Click to change it.`} aria-label={`${g.name}'s word: ${labelOf(word)}`} onClick={() => onPen(dotPct)} style={{ position: 'absolute', left: `calc(${dotPct}% - 5px)`, top: 9, width: 10, height: 10, borderRadius: '50%', background: '#16a34a', border: '2px solid var(--surface)', boxShadow: '0 0 0 1px #16a34a', padding: 0, cursor: 'pointer', zIndex: 1 }} />
        ) : (
          <button type="button" title={`No one date for ${g.name}'s jobs yet — click to give the GC's word for all of them`} aria-label={`Record ${g.name}'s word for all ${g.jobs.length} jobs`} onClick={() => onPen(dotPct)} style={{ position: 'absolute', left: `calc(${dotPct}% - 7px)`, top: 7, width: 14, height: 14, borderRadius: '50%', border: '2px dashed #16a34a', background: 'var(--surface)', padding: 0, opacity: 0.75, cursor: 'pointer', zIndex: 1 }} />
        )
      ) : null}
      {flags.map((f) => {
        const hollow = f.notices > 0
        const n = f.notices || f.liens
        const title = `${f.notices ? `${f.notices} ${f.notices === 1 ? 'notice' : 'notices'} owed` : ''}${f.notices && f.liens ? ' · ' : ''}${f.liens ? `${f.liens} ${f.liens === 1 ? 'lien' : 'liens'} to file` : ''} by ${labelOf(f.ymd)}`
        return (
          <div key={f.ymd} title={title} style={{ position: 'absolute', left: `calc(${f.pct}% - 1px)`, top: 4, width: 20, height: 20 }}>
            <span style={{ position: 'absolute', left: 0, top: 0, width: 2, height: 20, background: FLAG[f.tone] }} />
            <span style={{ position: 'absolute', left: 2, top: 0, width: 9, height: 7, background: FLAG[f.tone], clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />
            {hollow ? <span style={{ position: 'absolute', left: 3.5, top: 1.5, width: 5, height: 4, background: 'var(--surface)', clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} /> : null}
            {n > 1 ? <span style={{ position: 'absolute', left: 6, top: 7, fontSize: 9, fontWeight: 700, color: FLAG[f.tone] }}>{n}</span> : null}
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
        <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</span>
        <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.sub}</span>
      </span>
    </button>
  )
  const right = (
    <div style={{ padding: '0 14px', textAlign: 'right' }}>
      <div style={{ fontSize: '0.8125rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(g.total)}</div>
      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: TONE[g.tone], whiteSpace: 'nowrap' }}>{g.word}</div>
    </div>
  )
  return (
    <div style={{ ...GRID, background: g.kind === 'gone' ? 'var(--bg-red-tint)' : 'var(--bg-subtle)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', minHeight: 40 }} data-testid={`lien-cal-group-${g.key}`}>
      {left}
      {axis ? <GroupTrack g={g} axis={axis} onPen={onPen} /> : <div />}
      {right}
    </div>
  )
}

function JobRow({ j, axis, onOpen, onPen }: { j: LienCalendarJob; axis: LienCalendarAxis | null; onOpen: () => void; onPen?: (pct: number) => void }) {
  const marks = axis ? lienCalendarMarks(j, axis) : []
  return (
    <div role="row" className="lienCalendarRow" style={{ ...GRID, borderBottom: '1px solid var(--border)', minHeight: 40, background: j.runway.kindAssumed ? 'var(--bg-amber-tint)' : 'var(--surface)' }}>
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
      <div style={{ padding: '0 14px', textAlign: 'right' }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(j.openBalance)}</div>
        <div title={j.runway.lines.join(' — ')} style={{ fontSize: '0.6875rem', fontWeight: 600, color: TONE[j.runway.tone], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.runway.lines[j.runway.lines.length - 1] ?? j.runway.words}</div>
      </div>
    </div>
  )
}

function TodoStrip({ todo, onDraft, onSetKinds }: { todo: LienCalendarTodo[]; onDraft?: (ymd: string, jobIds: string[]) => void; onSetKinds?: () => void }) {
  return (
    <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-amber-tint)', display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, todo.length)}, minmax(0, 1fr))`, gap: 14 }} data-testid="lien-cal-todo">
      {todo.map((t) => {
        const act = t.action
        const door = act && ((act.kind === 'draft' && onDraft) || (act.kind === 'kinds' && onSetKinds))
        return (
          <div key={t.heading} style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.02em', color: t.tone === 'amber' ? 'var(--text-amber-800)' : 'var(--text-700)', textTransform: 'uppercase' }}>{t.heading}</div>
            <div style={{ fontSize: '0.875rem', marginTop: 2 }}>{t.sentence}</div>
            {act ? (
              door ? (
                <button type="button" onClick={() => (act.kind === 'draft' ? onDraft?.(act.ymd, act.jobIds) : onSetKinds?.())} style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-amber-800)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                  {act.label} ›
                </button>
              ) : (
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-amber-800)', opacity: 0.7 }} title="Read only here">{act.label}</span>
              )
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.tone === 'grey' && t.heading.startsWith('By') ? 'nothing to do this week' : ''}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Key({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px 4px' }}>
        <button type="button" aria-expanded={open} onClick={onToggle} style={{ border: 'none', background: 'none', padding: 0, fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-strong)', cursor: 'pointer' }}>
          {open ? '▾' : '▸'} Key — what each mark means
        </button>
        {!open ? <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>the same words are the hover on any mark</span> : null}
      </div>
      {open ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '4px 24px', padding: '2px 14px 10px' }} data-testid="lien-cal-key">
          {LIEN_CALENDAR_KEY.map((k) => (
            <div key={k.glyph} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.6875rem', color: 'var(--text-700)', lineHeight: 1.3 }}>
              <span style={{ display: 'inline-flex', width: 34, justifyContent: 'center', flex: 'none' }}>
                <Glyph kind={k.glyph} />
              </span>
              <span>{k.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function DensityStrip({ density, axis, selectedYmd, onSelect }: { density: LienCalendarDensityColumn[]; axis: LienCalendarAxis; selectedYmd: string | null; onSelect: (ymd: string | null) => void }) {
  const max = Math.max(1, ...density.map((c) => c.notices.count + c.liens.count))
  return (
    <div style={{ ...GRID, borderBottom: '1px solid var(--border)', alignItems: 'end' }} data-testid="lien-cal-density">
      <div style={{ padding: '8px 10px', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
        What lands on each 15th
        <br />
        <span style={{ color: 'var(--text-muted)' }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, background: '#f59e0b' }} /> notices · <span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--text-700)' }} /> liens
        </span>
      </div>
      <div style={{ position: 'relative', height: 44 }}>
        {density.map((c) => {
          const total = c.notices.count + c.liens.count
          if (!total) return null
          const h = Math.max(4, Math.round((36 * total) / max))
          const nh = Math.round((h * c.notices.count) / total)
          const sel = selectedYmd === c.ymd
          return (
            <button key={c.ymd} type="button" aria-pressed={sel} aria-label={`${labelOf(c.ymd)}: ${c.notices.count} ${c.notices.count === 1 ? 'notice' : 'notices'}, ${c.liens.count} ${c.liens.count === 1 ? 'lien' : 'liens'} — lead the to-do with this column`} title={`${labelOf(c.ymd)}: ${c.notices.count} ${c.notices.count === 1 ? 'notice' : 'notices'} (${formatUsdNoCents(c.notices.total)}) · ${c.liens.count} ${c.liens.count === 1 ? 'lien' : 'liens'} (${formatUsdNoCents(c.liens.total)}) — click to lead the to-do`} onClick={() => onSelect(sel ? null : c.ymd)} style={{ position: 'absolute', left: `calc(${c.pct}% - 8px)`, bottom: 4, width: 16, height: h, display: 'flex', flexDirection: 'column-reverse', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', outline: sel ? '2px solid var(--border-blue)' : 'none', outlineOffset: 2 }}>
              <div style={{ height: nh, background: '#f59e0b' }} />
              <div style={{ height: h - nh, background: 'var(--text-700)' }} />
              <span style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', fontSize: 9, fontWeight: 700, color: 'var(--text-700)' }}>{total}</span>
            </button>
          )
        })}
      </div>
      <div />
      <div style={{ padding: '0 10px 6px', fontSize: '0.6875rem', color: 'var(--text-muted)', alignSelf: 'end' }}>GC · then their jobs</div>
      <div style={{ position: 'relative', height: 30 }}>
        {axis.columns.map((c) => (
          <div key={c.ymd} style={{ position: 'absolute', left: `${c.pct}%`, bottom: 4, transform: 'translateX(-50%)', fontSize: '0.6875rem', fontWeight: 600, color: c.past ? 'var(--text-muted)' : 'var(--text-700)', whiteSpace: 'nowrap' }}>
            {c.label}
          </div>
        ))}
        <div style={{ position: 'absolute', left: `${axis.todayPct}%`, bottom: 2, transform: 'translateX(-50%)', fontSize: '0.6875rem', fontWeight: 700, color: '#fff', background: 'var(--text-strong)', borderRadius: 999, padding: '1px 8px', whiteSpace: 'nowrap' }} data-testid="lien-cal-today-pill">
          today · {labelOf(axis.todayYmd)}
        </div>
      </div>
      <div />
    </div>
  )
}

/** Phone: the three nearest columns as cards, then the rows as sentences. */
function PhoneList({ density, groups, onOpenJob }: { density: LienCalendarDensityColumn[]; groups: LienCalendarGroup[]; onOpenJob: (id: string) => void }) {
  const cards = density.filter((c) => !c.past && (c.notices.count || c.liens.count)).slice(0, 3)
  return (
    <div data-testid="lien-cal-phone">
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, cards.length)}, minmax(0, 1fr))`, gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
        {cards.map((c) => (
          <div key={c.ymd} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', background: 'var(--surface)' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-700)' }}>{c.label} · {c.daysFromToday} d</div>
            <div style={{ fontSize: '0.75rem' }}>
              {c.notices.count ? `${c.notices.count} notice${c.notices.count === 1 ? '' : 's'}` : ''}
              {c.notices.count && c.liens.count ? ' · ' : ''}
              {c.liens.count ? `${c.liens.count} lien${c.liens.count === 1 ? '' : 's'}` : ''}
            </div>
          </div>
        ))}
      </div>
      {groups.map((g) => (
        <section key={g.key} aria-label={g.name}>
          <div style={{ padding: '6px 12px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', fontWeight: 700 }}>
            {g.name} <span style={{ color: TONE[g.tone], fontWeight: 700, fontSize: '0.6875rem' }}>· {g.word}</span>
          </div>
          {g.jobs.map((j) => (
            <button key={j.jobId} type="button" onClick={() => onOpenJob(j.jobId)} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid var(--border)', background: 'var(--surface)', padding: '6px 12px', cursor: 'pointer', color: 'inherit' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={cellNum}>{j.number}</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{j.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(j.openBalance)}</span>
              </div>
              <div style={{ fontSize: '0.6875rem', color: TONE[j.runway.tone], fontWeight: 600 }}>{j.runway.lines.join(' — ')}</div>
            </button>
          ))}
        </section>
      ))}
    </div>
  )
}

export default function LienDeskCalendarTab({ rows, loading, todayYmd, onOpenJob, isMobile = false, canWrite = false, onDraft, onOpenEditJob, onChanged }: LienDeskCalendarTabProps) {
  const [query, setQuery] = useState('')
  const [pen, setPen] = useState<PenTarget | null>(null)
  const [kindsOpen, setKindsOpen] = useState(false)
  const [selectedYmd, setSelectedYmd] = useState<string | null>(null)
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set(['gone']))
  const [keyOpen, setKeyOpen] = useState(() => {
    try {
      const n = Number(localStorage.getItem(KEY_SEEN) ?? '0')
      return n < 3
    } catch {
      return true
    }
  })
  useEffect(() => {
    try {
      const n = Number(localStorage.getItem(KEY_SEEN) ?? '0')
      localStorage.setItem(KEY_SEEN, String(n + 1))
    } catch {
      /* private mode */
    }
  }, [])
  const cal = useMemo(() => buildLienCalendar(rows ?? [], query), [rows, query])
  const axis = useMemo(() => (rows && rows.length ? lienCalendarAxis(rows.filter((r) => r.runway.state !== 'none'), todayYmd) : null), [rows, todayYmd])
  const density = useMemo(() => (axis ? lienCalendarDensity(cal, axis) : []), [cal, axis])
  const jobsById = useMemo(() => new Map(cal.jobs.map((j) => [j.jobId, j])), [cal])
  const todo = useMemo(() => (axis ? lienCalendarTodo(cal, density, jobsById, selectedYmd) : []), [cal, density, jobsById, axis, selectedYmd])
  const penOn = canWrite && !isMobile
  const saved = (what: 'promise' | 'kind') => {
    setPen(null)
    onChanged?.(what)
  }
  const toggle = (key: string) =>
    setClosed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="lienDeskCalendar" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {loading && !rows ? 'Reading the board…' : `every billed job on the statute’s calendar · ${cal.totals.jobs} ${cal.totals.jobs === 1 ? 'job' : 'jobs'} · ${formatUsdNoCents(cal.totals.open)} open${cal.totals.noticesOwed ? ` · ${cal.totals.noticesOwed} ${cal.totals.noticesOwed === 1 ? 'notice' : 'notices'} owed` : ''}${cal.totals.gone ? ` · ${cal.totals.gone} lien${cal.totals.gone === 1 ? '' : 's'} gone` : ''}`}
        </div>
        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border-strong)', borderRadius: 6, padding: '3px 8px', background: 'var(--surface)', minWidth: 'min(320px, 100%)' }}>
          <span aria-hidden style={{ color: 'var(--text-muted)' }}>⌕</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Job #, name, customer, GC, address" aria-label="Search the lien calendar" style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '0.8125rem', width: '100%', color: 'inherit' }} />
        </label>
      </div>
      {axis && todo.length ? <TodoStrip todo={todo} onDraft={onDraft} onSetKinds={penOn ? () => setKindsOpen(true) : undefined} /> : null}
      {axis && kindsOpen ? <KindsSheet jobs={cal.jobs} onClose={() => setKindsOpen(false)} onOpenEditJob={onOpenEditJob} onSaved={saved} /> : null}
      {axis && !isMobile ? <Key open={keyOpen} onToggle={() => setKeyOpen((v) => !v)} /> : null}
      <div style={{ overflowY: 'auto', minHeight: 0, position: 'relative' }}>
        {!loading && rows && cal.groups.length === 0 ? (
          <div style={{ padding: '1.5rem 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{query.trim() ? 'No billed job matches that.' : 'Nothing billed is on a lien clock.'}</div>
        ) : null}
        {axis && isMobile ? (
          <PhoneList density={density} groups={cal.groups} onOpenJob={onOpenJob} />
        ) : (
          <div style={{ position: 'relative' }}>
            {axis ? (
              <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--surface)' }}>
                <DensityStrip density={density} axis={axis} selectedYmd={selectedYmd} onSelect={setSelectedYmd} />
              </div>
            ) : null}
            {cal.groups.map((g) => {
              const open = !closed.has(g.key)
              return (
                <section key={g.key} aria-label={g.name} style={{ position: 'relative' }}>
                  <GroupHeader g={g} open={open} onToggle={() => toggle(g.key)} axis={axis} onPen={penOn ? (pct) => setPen({ kind: 'group', group: g, pct }) : undefined} />
                  {pen && pen.kind === 'group' && pen.group.key === g.key && axis ? (
                    <div style={{ ...GRID, position: 'absolute', left: 0, right: 0, top: 0, pointerEvents: 'none' }}>
                      <div />
                      <div style={{ position: 'relative', pointerEvents: 'auto' }}>
                        <TheySaidPopover target={pen} todayYmd={todayYmd} onCancel={() => setPen(null)} onSaved={saved} />
                      </div>
                      <div />
                    </div>
                  ) : null}
                  {open
                    ? g.jobs.map((j) => (
                        <div key={j.jobId} style={{ position: 'relative' }}>
                          <JobRow j={j} axis={axis} onOpen={() => onOpenJob(j.jobId)} onPen={penOn ? (pct) => setPen({ kind: 'job', job: j, pct }) : undefined} />
                          {pen && pen.kind === 'job' && pen.job.jobId === j.jobId && axis ? (
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
                </section>
              )
            })}
            {/* the column rules and the one today line, drawn once over the whole board */}
            {axis ? (
              <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...GRID, alignItems: 'stretch' }}>
                <div />
                <div style={{ position: 'relative' }}>
                  {axis.columns.map((c) => (
                    <div key={c.ymd} style={{ position: 'absolute', left: `${c.pct}%`, top: 0, bottom: 0, width: 1, background: 'var(--border)' }} />
                  ))}
                  <div style={{ position: 'absolute', left: `${axis.todayPct}%`, top: 0, bottom: 0, width: 2, background: 'var(--text-strong)', opacity: 0.85 }} data-testid="lien-cal-today-line" />
                </div>
                <div />
              </div>
            ) : null}
          </div>
        )}
      </div>
      {axis && !isMobile ? (
        <div style={{ padding: '6px 14px', borderTop: '1px solid var(--border)', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Rows are doors: a job opens its Lien window; a flag opens that month’s notice. The GC row folds its jobs’ flags with a count{penOn ? '; a dot opens “They said…” — the GC row’s one dot is its word for every job' : ''}.</div>
      ) : null}
    </div>
  )
}
