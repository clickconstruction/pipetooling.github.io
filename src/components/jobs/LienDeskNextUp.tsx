import { Fragment, useState, type CSSProperties, type ReactNode } from 'react'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { groupLienNextUp, lienNextUpNowHead, type LienNextUpGrouped, type LienNextUpKind, type LienNextUpRow } from '../../lib/jobs/lienNextUp'
import { groupLienNextUpByBin, isLienFoldRow, type LienBinFoldRule, type LienBinGroup, type LienRowBin } from '../../lib/jobs/lienNextUpByBin'
import { lienNextUpNowWords } from '../../lib/jobs/lienNextUpNowWords'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { lienHeadDay, lienRowLine, type LienHeadDay, type LienRowTag } from '../../lib/jobs/lienRowWords'
import { lienStepCard, lienStepOfRow, type LienStepFacts } from '../../lib/jobs/lienNextUpSteps'
import { lienPhoneGroups, lienPhoneStepWords, type LienPhoneGroup } from '../../lib/jobs/lienPhoneRows'
import { LIEN_PHONE_PRESS_MIN_HEIGHT, LIEN_PHONE_QUIET_MIN_HEIGHT, lienPhonePressShortened, lienPhonePressWords, lienPhoneRowColumns } from '../../lib/jobs/lienPhonePress'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { LIEN_JOB_DOOR_TITLE } from './LienJobNumber'
import { splitLienJobLabel } from '../../lib/jobs/lienJobLabel'
import { LienStepCardView, LienStepMark, useLienStepCard } from './LienDeskSteps'

/**
 * The Lien desk's To do tab (Next up until v2.4630; punch list #82, PR 2): every lien paper that asks for an act,
 * in deadline order, one button a row. The list is `lienNextUp.ts`; this draws it. A button
 * (or a press on the row) hands the row back to the desk, which opens the pane that already
 * does the work. Nothing is written here.
 *
 * Since v2.4631 the steps read too: four dots and a fraction on every row, and a card on the dots that
 * writes the row's ladder out (`lienNextUpSteps.ts`). The rails of rungs above the rows, the step brief a
 * pressed rung opened (v2.6574) and the REMINDERS rail (punch list #262) stood here until v2.7332, when the
 * Board took the top of To do (`LienBoard.tsx`): a bin's head narrows the list the way a rung did.
 *
 * Since v2.7371 (punch list #362, step 2) *Needs you now* reads in up to three parts under one head: the rows that
 * will not make their day as they stand (the Board's marked chips, `risk`), then the approvals the office waits on,
 * with one press that reminds the leader of them (`remind`), then the rest, *On track*. The order is the kernel's.
 *
 * Since v2.7372 (step 3) a computer's row is two lines, so nothing is cut off at a laptop's width: the paper, the job
 * and what it owes, then under the job the Board's bin name, the one thing to know and where an affidavit's notice
 * stands (`lienRowWords.ts`). The bin's name opens the card the four dots opened, and a row with no bin keeps its
 * dots. A head carries the day when every row under it shares it, so no row repeats it.
 *
 * Since v2.7456 (step 4, the owner's pick of 2026-11-16) a computer's list follows the Board when the desk hands over
 * `byBin`: one group a bin under the bin's own name, in the Board's order, each head with its papers and what they
 * owe. Papers that share one act are one row with their jobs behind a fold, and everything due later waits under one
 * line (`lienNextUpByBin.ts`). A phone keeps its list by the day.
 *
 * A phone's row is two columns (the owner's go of 2026-11-23): the words at the left and one press at the right, every
 * press one width and a fingertip tall (`lienPhonePress.ts`). The paper's chip, the dots and what the job owes are the
 * words' last line, and a row's second way out (*Not lienable…*, *Take back…*) is a quiet line under them. Until then
 * each press was as wide as its words on a line of its own, and a second press took the main one's place.
 *
 * A table on a computer; the same rows as cards on a phone.
 */

const KIND_WORDS: Record<LienNextUpKind, string> = { notice: 'Notice', affidavit: 'Affidavit', retainage: 'Retainage' }
const KIND_TONE: Record<LienNextUpKind, { bg: string; fg: string }> = {
  notice: { bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-700)' },
  affidavit: { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-700)' },
  retainage: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' },
}

/** A row's kind chip: small and bold, the same on every row. */
export const lienKindTagStyle = (kind: LienNextUpKind): CSSProperties => ({ display: 'inline-block', padding: '0 7px', borderRadius: 5, fontSize: '0.68rem', fontWeight: 700, lineHeight: '18px', whiteSpace: 'nowrap', background: KIND_TONE[kind].bg, color: KIND_TONE[kind].fg })
const tag = lienKindTagStyle
/**
 * The chip that opens its paper (v2.4632), drawn as the plain chip is. Only the font's family is inherited (v2.7442): a whole
 * `font: inherit`, set after the chip's size, weight and line height, wiped all three, so it drew at the row's size and weight.
 * A phone keeps its thumb-tall press.
 */
export const lienPaperDoorStyle = (kind: LienNextUpKind, isMobile: boolean): CSSProperties => ({ ...tag(kind), display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', fontFamily: 'inherit', cursor: 'pointer', ...(isMobile ? { minHeight: 40, padding: '0 8px', fontSize: '0.75rem', flex: 'none' } : null) })
const TAG_TONE: Record<LienRowTag['tone'], CSSProperties> = {
  ok: { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' },
  none: { background: 'var(--bg-subtle)', color: 'var(--text-muted)' },
  warn: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
}
/** The width a computer's row keeps for its press, so the dollars line up whatever the press says; longer words wrap inside it. */
const ROW_PRESS_PX = 172
const actBtn: CSSProperties = { padding: '5px 12px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', whiteSpace: 'nowrap' }
const openBtn: CSSProperties = { padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', whiteSpace: 'nowrap' }

/** "Oct 15 · 10 days left", "Oct 1 · 4 days late", "Oct 5 · today"; empty with no day. */
/** A phone's press on a group's head (*Remind Sam of 3 papers*): as wide as its words, a thumb tall (punch list #352, PR 3). */
const PHONE_HEAD_PRESS: CSSProperties = { flex: 'none', minHeight: 40, padding: '0 12px', fontSize: '0.875rem', whiteSpace: 'nowrap' }
/** A phone row's one press: it fills the row's press column, a fingertip tall, and its words wrap inside it (`lienPhonePress.ts`). */
const PHONE_ROW_PRESS: CSSProperties = { width: '100%', minWidth: 0, minHeight: LIEN_PHONE_PRESS_MIN_HEIGHT, padding: '4px 6px', fontSize: '0.84rem', lineHeight: 1.2, whiteSpace: 'normal', textAlign: 'center', overflowWrap: 'anywhere' }
/** A phone row's second way out: words in the link colour under the row's words, with a thumb's height to press. */
const PHONE_QUIET_PRESS: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: LIEN_PHONE_QUIET_MIN_HEIGHT, padding: 0, margin: 0, border: 'none', background: 'none', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left' }
const PHONE_TONE: Record<'red' | 'amber' | 'quiet', { fg: string; bg: string }> = {
  red: { fg: 'var(--text-red-700)', bg: 'var(--bg-red-tint)' },
  amber: { fg: 'var(--text-amber-800)', bg: 'var(--bg-amber-tint)' },
  quiet: { fg: 'var(--text-700)', bg: 'var(--bg-subtle)' },
}

export function lienNextUpDueWords(r: Pick<LienNextUpRow, 'dueOn' | 'daysLeft'>): string {
  if (!r.dueOn || r.daysLeft == null) return ''
  const day = formatYmdMonthDay(r.dueOn)
  if (r.daysLeft < 0) return `${day} · ${-r.daysLeft} ${r.daysLeft === -1 ? 'day' : 'days'} late`
  if (r.daysLeft === 0) return `${day} · today`
  return `${day} · ${r.daysLeft} ${r.daysLeft === 1 ? 'day' : 'days'} left`
}

function dueColor(r: LienNextUpRow): string {
  if (r.daysLeft != null && r.daysLeft < 0) return 'var(--text-red-600)'
  return r.severity === 'red' ? 'var(--text-red-600)' : r.severity === 'amber' ? 'var(--text-amber-800)' : 'var(--text-muted)'
}

export default function LienDeskNextUp({
  rows,
  markTitle,
  loading,
  isMobile,
  onAct,
  onOpenJob,
  factsFor,
  viewerIsLeader,
  leadsRow,
  onOpenPaper,
  gapsFor,
  foldsOpen,
  waitingOn,
  scrolls = true,
  amountFor,
  onOpenRow,
  zoomFor,
  risk,
  riskLabel,
  remind,
  stageFor,
  noticeFor,
  trackPress,
  byBin,
}: {
  rows: ReadonlyArray<LienNextUpRow>
  loading: boolean
  isMobile: boolean
  onAct: (row: LienNextUpRow) => void
  /** The job's number and name as a door to the Job window (v2.4628); a GC's run row has no job and stays plain. */
  onOpenJob?: (jobId: string) => void
  /** What the desk knows about a row's job, for its card (v2.4631). */
  factsFor?: (row: LienNextUpRow) => LienStepFacts
  viewerIsLeader?: boolean
  /** Whether the viewer is the leader this row's job waits on (v2.6734, punch list #150): the step tiles say *you* only then; absent, `viewerIsLeader` stands for every row. */
  leadsRow?: (row: LienNextUpRow) => boolean
  /** The chip as a door to the paper (v2.4632): opens the notice or the affidavit as it stands, blanks marked. */
  onOpenPaper?: (row: LienNextUpRow) => void
  /** How many statutory blanks the row's paper has (the chip's red count; a tick at zero); null when unknown. */
  gapsFor?: (row: LienNextUpRow) => number | null
  /** The find (v2.4721): a row's title with the typed words marked. */
  markTitle?: (text: string) => ReactNode
  /** Open every run row's list of jobs (the find is on, punch list #101). */
  foldsOpen?: boolean
  /** The leader the office's waiting rows wait on, by name, when they all wait on one (punch list #101 PR 3). */
  waitingOn?: string | null
  /** Whether the list is its own scroller. A phone's desk scrolls the month, the find box and the list as one page, so there it is not (punch list #352, PR 0; `lienDoNowFrame`). */
  scrolls?: boolean
  /** What a row's job still owes, for a phone's row and its day's total (punch list #352, PR 3; `lienPhoneAmounts`). Absent, no money is drawn. */
  amountFor?: (row: LienNextUpRow) => number | null
  /** A phone: a tap on a row, its name or its dots opens the job as its own screen (punch list #352, PR 4). Absent, the name is the job's door and the dots open the step card. */
  onOpenRow?: (row: LienNextUpRow) => void
  /** The job's number as a zoom (v2.7333): the press to the right place for the paper's stage, with its hover words; null for a job not on the Board. Absent, the number and the name are one door to the job. */
  zoomFor?: (row: LienNextUpRow) => { press: () => void; words: string } | null
  /** The stages a row's paper still has to pass when it will not make its day, else null (v2.7371; the Board's rule, `lienBoardRowRisk`). Absent, no row is at risk. */
  risk?: (row: LienNextUpRow) => number | null
  /** The head over the rows at risk, in the Board's words for that many. */
  riskLabel?: (n: number) => string
  /** The press on the waiting rows' head (v2.7371): reminds the leader of them. Absent, or for a viewer who cannot send it, the head has no press. */
  remind?: { button: string; dead: boolean; busy?: boolean; onPress: () => void } | null
  /** The Board's bin a row's paper stands in (v2.7372, `lienBoardRowStage`): a computer's row starts its second line with it. Absent, a row keeps its dots and its words. */
  stageFor?: (row: LienNextUpRow) => string | null
  /** Where an affidavit row's notice stands (`lienAffidavitNoticeTag`); null when the desk cannot say. */
  noticeFor?: (row: LienNextUpRow) => LienRowTag | null
  /** One press on the head over the rows on track (v2.7372): the door to the affidavits' batch print. */
  trackPress?: { button: string; onPress: () => void } | null
  /** A computer's list in the Board's order (v2.7456, punch list #362 step 4): the bin of each row, and the folds the desk has a press for. Absent, the list is by the day, as before. */
  byBin?: { binFor: (row: LienNextUpRow) => LienRowBin | null; folds?: ReadonlyArray<LienBinFoldRule>; /** The list is narrowed (a pressed bin, the tile's red line): Later opens. */ narrowed?: boolean } | null
}) {
  const card = useLienStepCard(isMobile)
  // The row whose card is open, for the card's own button.
  const [openRow, setOpenRow] = useState<LienNextUpRow | null>(null)
  // A run row's list of jobs (punch list #101), folded until pressed; the find opens them all.
  const [folds, setFolds] = useState<ReadonlySet<string>>(() => new Set())
  // Later (v2.7456): everything not due inside the week waits under one line. Folded while something needs someone now, open when nothing does; a press says otherwise.
  const [laterPicked, setLaterPicked] = useState<boolean | null>(null)
  if (loading) return <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</div>
  const byDay = groupLienNextUp(rows, { waitingOn, risk, riskLabel, amount: amountFor })
  // A computer's list follows the Board when the desk says which bin a row stands in; a phone keeps its days.
  const binned = byBin && !isMobile ? groupLienNextUpByBin(rows, { waitingOn, risk, amount: amountFor, binFor: byBin.binFor, folds: byBin.folds }) : null
  const groups: ReadonlyArray<LienNextUpGrouped & Partial<LienBinGroup>> = binned ? binned.groups : byDay
  const laterOpen = Boolean(foldsOpen) || Boolean(byBin?.narrowed) || (laterPicked ?? !binned?.now)
  if (byDay.length === 0) {
    return (
      <div data-lien-next-up="empty" style={{ padding: '2rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        Nothing needs you right now. Every lien paper is sent, filed or waiting on its day. The By date tab shows what is coming.
      </div>
    )
  }
  // The title: a text door to the job when there is one, underlined on hover (`.lienJobDoor`); the click stops here, so the row keeps its own.
  const title = (r: LienNextUpRow, style: CSSProperties) => {
    const jobId = r.jobId
    if (!jobId || !onOpenJob) return <span style={style} title={r.title}>{markTitle ? markTitle(r.title) : r.title}</span>
    // The number is a zoom (v2.7333): the same press as the job's chip on the Board; the name stays the job's door.
    const zoom = !isMobile && zoomFor ? zoomFor(r) : null
    const split = zoom ? splitLienJobLabel(r.title) : null
    if (zoom && split && split.name) {
      return (
        <span style={{ ...style, display: 'inline-flex', alignItems: 'baseline', gap: 0, minWidth: 0, maxWidth: '100%' }}>
          <button type="button" className="lienJobDoor" data-testid={`lien-next-up-zoom-${jobId}`} title={zoom.words} onClick={(ev) => { ev.stopPropagation(); zoom.press() }} style={{ border: 'none', background: 'none', padding: 0, margin: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', borderRadius: 3, flex: 'none' }}>
            {markTitle ? markTitle(split.number) : split.number}
          </button>
          <span aria-hidden="true" style={{ flex: 'none' }}>{' · '}</span>
          <button type="button" className="lienJobDoor" data-testid={`lien-next-up-job-${jobId}`} title={LIEN_JOB_DOOR_TITLE} onClick={(ev) => { ev.stopPropagation(); onOpenJob(jobId) }} style={{ border: 'none', background: 'none', padding: 0, margin: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left', borderRadius: 3, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {markTitle ? markTitle(split.name) : split.name}
          </button>
        </span>
      )
    }
    return (
      <button
        type="button"
        className="lienJobDoor"
        data-testid={`lien-next-up-job-${jobId}`}
        title={LIEN_JOB_DOOR_TITLE}
        onClick={(ev) => {
          ev.stopPropagation()
          onOpenJob(jobId)
        }}
        style={{ ...style, border: 'none', background: 'none', padding: 0, margin: 0, fontFamily: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left', borderRadius: 3, minWidth: 0, maxWidth: '100%', ...(isMobile ? { minHeight: 28 } : null) }}
      >
        {markTitle ? markTitle(r.title) : r.title}
      </button>
    )
  }
  // The chip: a door to the paper when the desk offers one (v2.4632), ringed on hover, a red count of blanks or a tick.
  const chip = (r: LienNextUpRow) => {
    // A folded row stands for several papers of one kind (v2.7456): the kind, in the plural.
    if (isLienFoldRow(r)) return <span style={tag(r.kind)}>{KIND_WORDS[r.kind]}s</span>
    if (r.jobs) return <span style={{ ...tag('retainage') }}>Run</span>
    const canOpen = onOpenPaper && r.jobId && r.kind !== 'retainage'
    if (!canOpen) return <span style={tag(r.kind)}>{KIND_WORDS[r.kind]}</span>
    const gaps = gapsFor?.(r) ?? null
    return (
      <button
        type="button"
        className="lienPaperDoor"
        data-testid={`lien-next-up-paper-${r.jobId}-${r.kind}`}
        title={gaps ? `Open the ${r.kind} as it stands: ${gaps} ${gaps === 1 ? 'detail' : 'details'} missing` : `Open the ${r.kind} as it stands`}
        onClick={(ev) => {
          ev.stopPropagation()
          onOpenPaper(r)
        }}
        style={lienPaperDoorStyle(r.kind, isMobile)}
      >
        {KIND_WORDS[r.kind]}
        {gaps == null ? null : gaps > 0 ? (
          <span data-testid="lien-paper-gap-count" style={{ background: '#dc2626', color: '#fff', borderRadius: 999, minWidth: 14, height: 14, display: 'inline-grid', placeItems: 'center', fontSize: '0.6rem', padding: '0 4px', lineHeight: 1 }}>{gaps}</span>
        ) : (
          <span data-testid="lien-paper-gap-ok" aria-label="nothing missing" style={{ color: 'var(--text-green-700)', fontSize: '0.7rem', lineHeight: 1 }}>✓</span>
        )}
      </button>
    )
  }
  const mark = (r: LienNextUpRow) => (
    <LienStepMark
      at={lienStepOfRow(r)}
      ladder={lienStepOfRow(r)?.ladder ?? r.kind}
      card={lienStepCard(r, factsFor?.(r))}
      isMobile={isMobile}
      compact={isMobile}
      onShow={(el, c) => {
        // On a phone the job's own screen writes the steps out, so the dots open it in place of a second sheet.
        if (isMobile && onOpenRow) {
          onOpenRow(r)
          return
        }
        setOpenRow(r)
        card.show(el, c)
      }}
      onHide={card.hide}
    />
  )
  // The quieter doors beside the button: the run row's second press, and (punch list #353) a row's other ways to be right.
  const secondary = (r: LienNextUpRow) => {
    const extra = [...(r.secondary ? [{ words: r.secondary.words, target: r.secondary.target, hook: { 'data-lien-next-up-secondary': r.key } }] : []), ...(r.doors ?? []).map((d, i) => ({ words: d.words, target: d.target, hook: { 'data-lien-next-up-door': `${r.key}:${i}` } }))]
    if (extra.length === 0) return null
    return extra.map((d) => (
      <button
        key={d.words}
        type="button"
        onClick={(ev) => {
          ev.stopPropagation()
          onAct({ ...r, target: d.target })
        }}
        style={isMobile ? PHONE_QUIET_PRESS : { ...openBtn, padding: '2px 10px', fontSize: '0.78rem' }}
        {...d.hook}
      >
        {d.words}
      </button>
    ))
  }
  // A run row's jobs (punch list #101): each a door to its job, with its day.
  const fold = (r: LienNextUpRow) => {
    if (!r.jobs || r.jobs.length === 0) return null
    const open = Boolean(foldsOpen) || folds.has(r.key)
    return (
      <div style={{ gridColumn: '1 / -1', paddingLeft: isMobile ? 0 : 'calc(84px + 0.75rem)' }} onClick={(ev) => ev.stopPropagation()}>
        {/* On a computer the row's question reads here in full: its own column is narrowed by the two buttons. */}
        {/* …and its quieter button follows the question it answers, so the row's last column keeps one button. */}
        {isMobile ? null : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginRight: 10 }}>
            <span data-lien-next-up-run-sub style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{r.sub}</span>
            {secondary(r)}
          </span>
        )}
        <button
          type="button"
          aria-expanded={open}
          data-lien-next-up-fold={r.key}
          onClick={() => setFolds((prev) => { const next = new Set(prev); if (next.has(r.key)) next.delete(r.key); else next.add(r.key); return next })}
          style={{ border: 'none', background: 'none', padding: '2px 0', font: 'inherit', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', ...(isMobile ? { minHeight: 40, fontSize: '0.875rem' } : null) }}
        >
          {open ? '▾' : '▸'} The {r.jobs.length} jobs
        </button>
        {open ? (
          <div data-lien-next-up-fold-body={r.key} style={{ display: 'grid', gridTemplateColumns: isLienFoldRow(r) ? 'minmax(0, 1fr) auto auto auto' : 'minmax(0, 1fr) auto', gap: '1px 12px', margin: '2px 0 4px', paddingLeft: 10, borderLeft: '2px solid var(--border)', fontSize: '0.8rem' }}>
            {r.jobs.map((j) => {
              // A folded row's jobs each say what a row of their own said (v2.7456): where the notice stands, the day, and what is owed.
              const own: LienNextUpRow | null = isLienFoldRow(r) ? { ...r, key: `${r.kind}:${j.jobId}`, jobId: j.jobId, title: j.title, jobs: undefined } : null
              const note = own ? noticeFor?.(own) ?? null : null
              const owed = own ? amountFor?.(own) ?? null : null
              return (
                <div key={j.jobId} style={{ display: 'contents' }}>
                  {title({ ...r, jobId: j.jobId, title: j.title }, { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' })}
                  {own ? <span data-lien-next-up-fold-note style={{ color: note?.tone === 'warn' ? 'var(--text-amber-800)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{note?.words ?? ''}</span> : null}
                  <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{j.dueOn ? formatYmdMonthDay(j.dueOn) : ''}</span>
                  {own ? <span data-lien-next-up-fold-amount style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'right' }}>{owed != null ? formatUsdNoCents(owed) : ''}</span> : null}
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    )
  }
  const button = (r: LienNextUpRow) => {
    const words = r.button ?? 'Open'
    // A phone's column is too narrow for the three longest presses, so there they take a shorter form; the whole of it is the press's name still.
    const short = isMobile && lienPhonePressShortened(words)
    return (
      <button
        type="button"
        onClick={(ev) => {
          ev.stopPropagation()
          onAct(r)
        }}
        style={{ ...(r.button ? actBtn : openBtn), ...(isMobile ? PHONE_ROW_PRESS : { whiteSpace: 'normal', textAlign: 'center', lineHeight: 1.2 }) }}
        data-lien-next-up-act={r.action}
        {...(short ? { title: words, 'aria-label': words } : null)}
      >
        {short ? lienPhonePressWords(words) : words}
      </button>
    )
  }
  // The bin's name as the door to the row's card (v2.7372): the card the four dots opened, on the word that says the stage.
  const stageDoor = (r: LienNextUpRow, stage: string) => {
    const stepCard = lienStepCard(r, factsFor?.(r))
    const show = (el: HTMLElement) => {
      setOpenRow(r)
      card.show(el, stepCard)
    }
    return (
      <button
        type="button"
        className="lienJobDoor"
        data-lien-next-up-stage={r.key}
        aria-label={`${stage}: where this stands`}
        onMouseEnter={(e) => show(e.currentTarget)}
        onMouseLeave={card.hide}
        onFocus={(e) => show(e.currentTarget)}
        onBlur={card.hide}
        onClick={(e) => {
          e.stopPropagation()
          show(e.currentTarget)
        }}
        style={{ border: 'none', background: 'none', padding: 0, margin: 0, font: 'inherit', fontWeight: 600, color: 'var(--text-700)', cursor: 'default', borderRadius: 3 }}
      >
        {stage}
      </button>
    )
  }
  // The day a head carries for its rows (v2.7372): the parts of Needs you now share one head, so they share its day;
  // the waiting rows are under a head of their own kind and each says its day.
  // By bin (v2.7456) the waiting rows stand in a bin like any other, so they share the head's day too.
  const partsDay: LienHeadDay | null = lienHeadDay(groups.filter((g) => g.part && (binned || g.group !== 'waiting')).flatMap((g) => g.rows))
  const headDayOf = (g: (typeof groups)[number]): LienHeadDay | null => (g.group === 'waiting' && !binned ? null : g.part ? partsDay : g.group === 'now' || g.group === 'coming' ? lienHeadDay(g.rows) : null)
  const dayWords = (d: LienHeadDay | null) =>
    d ? (
      <span data-lien-next-up-head-day style={{ marginLeft: 8, fontWeight: 600, letterSpacing: 0, textTransform: 'none', color: d.daysLeft != null && d.daysLeft <= 7 ? 'var(--text-red-600)' : 'var(--text-muted)' }}>{d.words}</span>
    ) : null
  const trackPressButton = trackPress ? (
    <button
      type="button"
      data-lien-next-up-track-press
      onClick={(ev) => {
        ev.stopPropagation()
        trackPress.onPress()
      }}
      style={{ ...openBtn, flex: 'none', padding: '2px 10px', fontSize: '0.78rem' }}
    >
      {trackPress.button}
    </button>
  ) : null
  // The parts of Needs you now (v2.7371): one head over them, each part with a smaller one of its own.
  const nowHead = binned ? (binned.now ? { label: binned.now.label, count: binned.now.papers, waiting: null } : null) : lienNextUpNowHead(groups)
  // By bin the head names what it counts, papers, and says how many more wait under Later (the owner's pick of 2026-11-18).
  const nowWords = binned ? lienNextUpNowWords(binned.groups) : null
  const firstPart = groups.findIndex((g) => g.part)
  const lastPart = groups.reduce((at, g, i) => (g.part ? i : at), -1)
  const remindOff = Boolean(remind && (remind.dead || remind.busy))
  const remindPress = remind ? (
    <button
      type="button"
      data-lien-next-up-remind
      disabled={remindOff}
      onClick={(ev) => {
        ev.stopPropagation()
        remind.onPress()
      }}
      style={{ ...openBtn, flex: 'none', padding: '2px 10px', fontSize: '0.78rem', ...(isMobile ? PHONE_HEAD_PRESS : null), ...(remindOff ? { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, borderColor: 'transparent', cursor: 'default' } : null) }}
    >
      {remind.busy ? 'Reminding…' : remind.button}
    </button>
  ) : null
  const openCard = card.open
  const cardButton = openCard ? openRow : null
  // A phone's list (punch list #352, PR 3): the day-driven groups by the day itself, each head with how long is left
  // and the money its jobs hold; a row is the job and what it owes, its state in words, then the paper, four dots,
  // the step's name and the press. The rows were cards 225 px tall with four named tiles and a full-width button.
  const phoneGroups: LienPhoneGroup[] = isMobile ? lienPhoneGroups(groups, amountFor ?? (() => null)) : []
  // A phone row's name (PR 4): the press that opens the job's own screen, where the door to the Job window now sits.
  const phoneTitle = (r: LienNextUpRow, style: CSSProperties) => {
    if (!onOpenRow) return title(r, style)
    return (
      <button
        type="button"
        data-lien-next-up-open={r.key}
        aria-label={`${r.title}: where it stands`}
        onClick={(ev) => {
          ev.stopPropagation()
          onOpenRow(r)
        }}
        style={{ ...style, border: 'none', background: 'none', padding: 0, margin: 0, fontFamily: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left', borderRadius: 3, minWidth: 0, maxWidth: '100%', minHeight: 28 }}
      >
        {markTitle ? markTitle(r.title) : r.title}
      </button>
    )
  }
  const phoneGroup = (g: LienPhoneGroup) => {
    const whose = g.group === 'mine' || g.group === 'sign' || g.group === 'pen'
    const violet = g.group === 'reminders'
    const fg = g.group === 'day' ? PHONE_TONE[g.tone].fg : whose ? 'var(--text-link)' : violet ? 'var(--text-violet-700)' : 'var(--text-muted)'
    const bg = g.group === 'day' ? PHONE_TONE[g.tone].bg : 'var(--bg-subtle)'
    return (
      <section key={g.key} aria-label={g.label} data-lien-next-up-group={g.group} data-lien-phone-group={g.key} style={{ margin: '0 -0.75rem' }}>
        {/* The heading sticks under the flow's pinned line while a stage's papers are the screen (punch list #428): the desk sets its height on the scroller, and with nothing pinned it is the top as before. */}
        <h3 style={{ position: 'sticky', top: 'var(--lien-pinned-top, 0px)', zIndex: 1, margin: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0.75rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: fg, background: bg, borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            {g.label} · {g.rows.length}
          </span>
          {g.left ? <span data-lien-phone-left>{g.left}</span> : null}
          {g.amount != null ? <span data-lien-phone-group-amount style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: 0 }}>{formatUsdNoCents(g.amount)}</span> : null}
        </h3>
        {g.group === 'waiting' && remindPress ? <div data-lien-next-up-remind-row style={{ display: 'flex', padding: '6px 0.75rem', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>{remindPress}</div> : null}
        {g.rows.map((r, i) => {
          const amount = amountFor?.(r) ?? null
          const at = lienStepOfRow(r)
          // The row's own press names the step when this viewer has one (*File the affidavit*); with none, the words beside the dots say whose step it is.
          const stepWords = r.button ? '' : lienPhoneStepWords(at, at?.ladder ?? r.kind, leadsRow ? leadsRow(r) : Boolean(viewerIsLeader))
          // A day's head says the day; under any other head the row says its own.
          const due = g.group === 'day' ? '' : lienNextUpDueWords(r)
          const quiet = secondary(r)
          return (
            <div key={r.key} className="lienPhoneRow" data-lien-next-up-row={r.key} data-layout="columns" onClick={onOpenRow ? () => onOpenRow(r) : undefined} style={{ display: 'grid', gridTemplateColumns: lienPhoneRowColumns(), columnGap: 12, rowGap: 2, alignItems: 'center', padding: '0.55rem 0.75rem 0.45rem', borderTop: i === 0 ? 'none' : '1px solid var(--border)', background: 'var(--surface)', ...(onOpenRow ? { cursor: 'pointer' } : null) }}>
              {/* The words, at the left: the job, what is asked, then the paper, its dots and what the job owes. */}
              <div data-lien-next-up-words style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                <div>{phoneTitle(r, { fontWeight: 700, fontSize: '1rem', lineHeight: 1.25, overflowWrap: 'anywhere', whiteSpace: 'normal' })}</div>
                <div data-lien-next-up-sub style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {r.sub}
                  {due ? <span style={{ fontWeight: 600, color: dueColor(r) }}>{r.sub ? ' · ' : ''}{due}</span> : null}
                </div>
                <div data-lien-next-up-meta style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  {chip(r)}
                  {mark(r)}
                  {stepWords ? <span data-lien-next-up-step-words style={{ minWidth: 0, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stepWords}</span> : null}
                  <span style={{ flex: 1 }} />
                  {amount != null ? <span data-lien-next-up-amount style={{ flex: 'none', fontWeight: 700, fontSize: '0.9rem', fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(amount)}</span> : null}
                </div>
                {/* The second way out is a quiet line here, so the press column holds one press on every row. */}
                {quiet ? <div data-lien-next-up-quiet style={{ display: 'flex', flexWrap: 'wrap', gap: '0 16px' }}>{quiet}</div> : null}
              </div>
              {button(r)}
              {fold(r)}
            </div>
          )
        })}
      </section>
    )
  }
  return (
    <div ref={card.hostRef} data-lien-next-up="list" data-scrolls={scrolls ? 'yes' : 'no'} style={{ position: 'relative', overflowY: scrolls ? 'auto' : 'visible', minHeight: 0, padding: isMobile ? '0.6rem 0.75rem 1rem' : '0.75rem 1.25rem 1.25rem' }}>
      {isMobile ? phoneGroups.map(phoneGroup) : groups.map((g, gi) => (
        <Fragment key={g.key ?? g.group}>
        {nowHead && gi === firstPart ? (
          <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', margin: '0 0 0.5rem', fontSize: '0.72rem' }}>
            <h3 data-lien-next-up-now-head style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-red-600)' }}>
              {nowHead.label} · {nowWords ? nowWords.count : nowHead.count}
              {nowWords?.later ? <span data-lien-next-up-now-later style={{ marginLeft: 8, fontWeight: 600, letterSpacing: 0, textTransform: 'none', color: 'var(--text-muted)' }}>{nowWords.later}</span> : null}
              {nowHead.waiting ? <span data-lien-next-up-now-waiting style={{ marginLeft: 8, fontWeight: 600, letterSpacing: 0, textTransform: 'none', color: 'var(--text-muted)' }}>and {nowHead.waiting}</span> : null}
            </h3>
            {dayWords(partsDay)}
            {binned?.now?.total != null ? <span data-lien-next-up-now-total style={{ marginLeft: 'auto', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-700)' }}>{formatUsdNoCents(binned.now.total)}</span> : null}
          </div>
        ) : null}
        <section aria-label={g.label} data-lien-next-up-group={g.group} data-lien-next-up-bin={g.bin ?? undefined} data-part={g.part ? 'yes' : undefined} style={{ marginBottom: g.part && gi !== lastPart ? '0.65rem' : '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: g.part ? '0 0 0.35rem' : '0 0 0.4rem', minHeight: (binned ? g.remind : g.group === 'waiting') && remindPress ? 26 : undefined }}>
            {g.part ? (
              <h4 data-lien-next-up-part-head style={{ flex: 1, minWidth: 0, margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: g.group === 'risk' ? 'var(--text-red-600)' : g.group === 'waiting' ? 'var(--text-violet-700)' : 'var(--text-700)' }}>
                {g.label} · {g.countWords ?? g.rows.length}
              </h4>
            ) : (
              <>
                <h3 style={{ minWidth: 0, margin: 0, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: g.group === 'now' ? 'var(--text-red-600)' : g.group === 'reminders' || g.group === 'waiting' ? 'var(--text-violet-700)' : g.group === 'mine' || g.group === 'sign' || g.group === 'pen' ? 'var(--text-link)' : 'var(--text-muted)' }}>
                  {g.label} · {g.countWords ?? g.rows.length}
                </h3>
                <span style={{ flex: 1, minWidth: 0, fontSize: '0.72rem' }}>{dayWords(headDayOf(g))}</span>
              </>
            )}
            {/* A bin's head says what its papers still owe (v2.7456). */}
            {g.total != null ? <span data-lien-next-up-group-total style={{ flex: 'none', fontSize: '0.8125rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-700)' }}>{formatUsdNoCents(g.total)}</span> : null}
            {(binned ? g.remind : g.group === 'waiting') ? remindPress : null}
            {!binned && g.group === 'now' ? trackPressButton : null}
          </div>
          {/* Later (v2.7456): one line says which bins hold how many, and a press shows the rows. A find or a pressed bin opens it. */}
          {g.later ? (
            <div data-lien-next-up-later style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '2px 10px', margin: '0 0 0.4rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              <span>{g.later.line}</span>
              {foldsOpen || byBin?.narrowed ? null : (
                <button type="button" aria-expanded={laterOpen} data-lien-next-up-later-press onClick={() => setLaterPicked(!laterOpen)} style={{ border: 'none', background: 'none', padding: '2px 0', font: 'inherit', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer' }}>
                  {laterOpen ? '▾ Hide them' : `▸ Show the ${g.rows.length}`}
                </button>
              )}
            </div>
          ) : null}
          {g.later && !laterOpen ? null : (
          <div style={{ display: 'grid', gap: 0, border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
            {g.rows.map((r, i) => {
              // The head's day is not said again; a row with another day, or under a head with none, says its own.
              const headDay = headDayOf(g)
              const due = headDay && r.dueOn === headDay.dueOn ? '' : lienNextUpDueWords(r)
              // A folded row stands in its group's bin, and owes what its jobs owe (v2.7456).
              const folded = isLienFoldRow(r)
              const underBin = Boolean(g.bin)
              const line = lienRowLine(r, { stage: folded ? g.label : stageFor?.(r) ?? null, notice: noticeFor?.(r) ?? null })
              const foldOwed = folded ? (r.jobs ?? []).reduce((sum, j) => sum + (amountFor?.({ ...r, jobId: j.jobId }) ?? 0), 0) : 0
              const amount = folded ? (foldOwed > 0 ? foldOwed : null) : amountFor?.(r) ?? null
              return (
                <div
                  key={r.key}
                  data-lien-next-up-row={r.key}
                  data-layout="two-line"
                  onClick={() => onAct(r)}
                  style={{ display: 'grid', gridTemplateColumns: `84px minmax(0, 1fr) auto ${ROW_PRESS_PX}px`, columnGap: '0.75rem', rowGap: 2, alignItems: 'center', padding: '0.45rem 0.8rem', borderTop: i === 0 ? 'none' : '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}
                >
                  <span>{chip(r)}</span>
                  <span style={{ minWidth: 0, overflow: 'hidden' }}>{title(r, { fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' })}</span>
                  {amount != null ? <span data-lien-next-up-amount style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'right' }}>{formatUsdNoCents(amount)}</span> : <span />}
                  <span style={{ gridColumn: 4, gridRow: '1 / 3', justifySelf: 'end', maxWidth: ROW_PRESS_PX }}>{button(r)}</span>
                  {/* Under the job: its day when the head does not carry it, the Board's bin, the one thing to know, and an affidavit's notice. */}
                  <span data-lien-next-up-line style={{ gridColumn: '2 / 4', gridRow: 2, minWidth: 0, fontSize: '0.8125rem', lineHeight: 1.5, color: 'var(--text-muted)' }}>
                    {due ? <span data-lien-next-up-due style={{ fontWeight: 600, color: dueColor(r), whiteSpace: 'nowrap', marginRight: 8 }}>{due}</span> : null}
                    {/* Under a bin's own head (v2.7456) the row does not say the bin again: it says the one thing to know. The name stays where it is all the row has, and under Later, whose rows are of many bins. */}
                    {line.stage ? (underBin && (r.jobs || line.detail) ? null : stageDoor(r, line.stage)) : <span style={{ marginRight: 8 }}>{mark(r)}</span>}
                    {/* A run row's question reads in its fold, with the press that answers it (punch list #101). */}
                    {!r.jobs && line.detail ? <span data-lien-next-up-detail>{line.stage && !underBin ? ' · ' : ''}{line.detail}</span> : null}
                    {line.tags.map((t) => (
                      <span key={t.words} data-lien-next-up-tag={t.tone} style={{ ...TAG_TONE[t.tone], display: 'inline-block', marginLeft: 8, padding: '0 6px', borderRadius: 5, fontSize: '0.72rem', fontWeight: 600, lineHeight: '18px', whiteSpace: 'nowrap' }}>{t.words}</span>
                    ))}
                  </span>
                  {fold(r)}
                  {/* The row's other doors (punch list #353) read on a line of their own under the row, so the title keeps its column. */}
                  {!r.jobs && r.doors?.length ? (
                    <div data-lien-next-up-doors={r.key} style={{ gridColumn: '1 / -1', paddingLeft: 'calc(84px + 0.75rem)', display: 'flex', flexWrap: 'wrap', gap: '4px 8px' }} onClick={(ev) => ev.stopPropagation()}>
                      {secondary(r)}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
          )}
        </section>
        </Fragment>
      ))}
      {openCard ? (
        <LienStepCardView card={openCard.card} place={openCard.place} onClose={card.close} onMouseEnter={card.cancelHide} onMouseLeave={card.hide}>
            {cardButton?.button ? (
              <button
                type="button"
                onClick={() => {
                  card.close()
                  onAct(cardButton)
                }}
                style={{ ...actBtn, padding: '4px 10px', fontSize: '0.78rem' }}
                data-testid="lien-step-card-act"
              >
                {cardButton.button}
              </button>
            ) : null}
        </LienStepCardView>
      ) : null}
    </div>
  )
}
