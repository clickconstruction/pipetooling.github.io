import { useState, type CSSProperties, type ReactNode } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { emptyWords } from '../../lib/emptyWords'
import { LIEN_GET_IT_RIGHT_WORDS as WORDS, lienRunDoor, lienRunHead, lienRunKindWord, type LienGetItRight as Run, type LienRunLine, type LienRunStep } from '../../lib/jobs/lienGetItRight'
import { LIEN_LEAVE_OUT_REASONS, LIEN_LEFT_OUT_WORDS as OUT, lienAskedAgainWords, lienLeaveOutCheck, lienLeaveOutReasonWords, lienLeftOutByWords, type LienLeaveOutReason } from '../../lib/jobs/lienLeftOut'
import type { OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { formatErrorMessage } from '../../utils/errorHandling'
import { EmptyState } from '../EmptyState'
import { Money } from '../Money'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { ValueSentence, WorkedOutValue } from '../valuesInPlace/ValuesInPlace'
import { LIEN_RUN_PRINT_WORDS as PRINT } from '../../lib/jobs/lienRunPrint'
import { lienKindTagStyle } from './LienDeskNextUp'
import type { LienRunPrintState } from './useLienRunPrint'

/**
 * The run's first step, drawn (punch list #362, step 5): the checklist of `lienGetItRight.ts` under the Board, in the
 * list's place while the run is open, and the one line over the list that opens it. Thin: every count, order and
 * word is the kernel's, a line's press is its To do row's own, and **Leave out** / **Put it back** hand the paper to
 * the desk, which writes through `lienLeftOutIo.ts`. Nothing here prints, sends or files.
 */

/** A print that exists today, offered where the run will have its one print (step 6 of the card). */
export type LienRunPrint = { key: string; label: string; left: string | null; dead: boolean; onPress: () => void }

export type LienGetItRightProps = {
  run: Run
  isMobile: boolean
  /** The view is its own scroller: the Board stays put over it, as it does over the list. */
  scrolls: boolean
  /** The lien office: the viewer may leave a paper out and put one back. */
  canLeaveOut: boolean
  userName: (userId: string) => string | null | undefined
  /** Back to the list under the Board. */
  onBack: () => void
  /** A line's press: its To do row's, by the row's key. */
  onAct: (rowKey: string) => void
  /** A line's job pressed: the desk opens its paper. */
  onOpenLine: (line: LienRunLine) => void
  /** Leave the paper out of this run. Rejects with the reason when the write is refused. */
  onLeaveOut: (line: LienRunLine, reason: LienLeaveOutReason, note: string) => Promise<void>
  onPutBack: (line: LienRunLine) => Promise<void>
  /** The Board's two prints, offered once nothing is left to settle, to a viewer with no one print. */
  prints?: ReadonlyArray<LienRunPrint>
  /** The run's one print (step 6, `useLienRunPrint`): the lien office's. Absent, the Board's prints stand in. */
  print?: LienRunPrintState | null
}

const blueBtn: CSSProperties = { padding: '5px 12px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: '0.8125rem', fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }
const plainBtn: CSSProperties = { padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontWeight: 600, fontSize: '0.8125rem', fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }
/** A press that cannot go: the app's one grey. It keeps its own border, so a busy press does not change size. */
const deadBtn: CSSProperties = { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' }
const linkBtn: CSSProperties = { border: 'none', background: 'none', padding: 0, margin: 0, fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left', borderRadius: 3 }
const card: CSSProperties = { border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)', padding: '12px 14px', minWidth: 0 }
const small: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const chip: CSSProperties = { display: 'inline-block', padding: '0 6px', borderRadius: 5, border: '1px solid var(--border-strong)', fontSize: '0.72rem', fontWeight: 700, lineHeight: '18px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: 'var(--text-700)', background: 'var(--bg-subtle)' }

/** A thumb's press on a phone is 44 px tall. */
const tall = (isMobile: boolean): CSSProperties => (isMobile ? { minHeight: 44 } : {})

const STEP_TONE: Record<LienRunStep['state'], CSSProperties> = {
  now: { border: '1px solid var(--border-blue)', background: 'var(--bg-blue-tint)' },
  done: { border: '1px solid var(--border-green)', background: 'var(--bg-green-tint)' },
  wait: { border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text-muted)' },
}

/** The door: one line over the list under the Board, with the press that opens the checklist. */
export function LienRunDoor({ run, isMobile, onOpen }: { run: Run; isMobile: boolean; onOpen: () => void }) {
  const door = lienRunDoor(run)
  return (
    <div data-lien-run="door" data-step={run.step ?? 'none'} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: isMobile ? 6 : 10, padding: isMobile ? '0.5rem 0.75rem' : '0.5rem 1.25rem', borderBottom: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.8125rem', color: 'var(--text-700)' }}>
      <span data-lien-run-door-line style={{ minWidth: 0, flex: '1 1 16rem' }}>
        <ValueSentence text={door.line} />
      </span>
      <button type="button" data-lien-run-door-open onClick={onOpen} style={{ ...(run.counts.settle > 0 ? blueBtn : plainBtn), ...tall(isMobile) }}>
        {door.button} ›
      </button>
    </div>
  )
}

/** What a failed read of the left-out papers draws, in the door's place and in the checklist's: no count is shown until the read is whole. */
export function LienRunReadFailure({ failure, isMobile, onRetry }: { failure: OfflineRecoveryLastError; isMobile: boolean; onRetry: () => void }) {
  return (
    <div data-lien-run="read-failure" style={{ padding: isMobile ? '0.5rem 0.75rem' : '0.5rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
      <OfflineRetryPanel failure={failure} onRetry={onRetry} surface="lien-run-left-out" idempotent />
    </div>
  )
}

function StepStrip({ steps, isMobile }: { steps: Run['steps']; isMobile: boolean }) {
  return (
    <div data-lien-run-steps style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
      {steps.map((s) => (
        <div key={s.n} data-lien-run-step={s.n} data-state={s.state} aria-current={s.state === 'now' ? 'step' : undefined} style={{ borderRadius: 8, padding: '8px 10px', fontSize: '0.8125rem', minWidth: 0, color: 'var(--text-700)', ...STEP_TONE[s.state] }}>
          <b style={{ display: 'block', color: s.state === 'wait' ? 'var(--text-muted)' : 'var(--text-strong)' }}>
            {s.n} · {s.name}
            {s.state === 'done' ? <span aria-hidden="true" style={{ color: 'var(--text-green-700)' }}> ✓</span> : null}
          </b>
          <span><ValueSentence text={s.line} /></span>
        </div>
      ))}
    </div>
  )
}

/** The reasons, the person's words and the press that names the act, in place under the line. */
function LeaveOutForm({ line, isMobile, again, onLeaveOut, onClose }: { line: LienRunLine; isMobile: boolean; again: boolean; onLeaveOut: LienGetItRightProps['onLeaveOut']; onClose: () => void }) {
  const [reason, setReason] = useState<LienLeaveOutReason | null>(again ? (line.leftOut?.reason ?? null) : null)
  const [note, setNote] = useState(again ? (line.leftOut?.note ?? '') : '')
  const [busy, setBusy] = useState(false)
  const [why, setWhy] = useState<string | null>(null)
  const refused = lienLeaveOutCheck(reason, note)
  const go = async () => {
    if (busy) return
    if (refused || !reason) {
      setWhy(refused)
      return
    }
    setBusy(true)
    setWhy(null)
    try {
      await onLeaveOut(line, reason, note)
      onClose()
    } catch (e) {
      setWhy(formatErrorMessage(e, 'The paper was not left out.'))
      setBusy(false)
    }
  }
  const name = `lien-leave-out-${line.key}`
  return (
    <div data-lien-leave-out-form={line.key} style={{ gridColumn: '1 / -1', order: 4, marginTop: 8, padding: '10px 12px', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-subtle)', display: 'grid', gap: 8 }}>
      <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'grid', gap: isMobile ? 0 : 4 }}>
        <legend style={{ padding: 0, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)', marginBottom: 4 }}>{OUT.why}</legend>
        {LIEN_LEAVE_OUT_REASONS.map((r) => (
          <label key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--text-700)', cursor: 'pointer', ...tall(isMobile) }}>
            <input type="radio" name={name} value={r.key} checked={reason === r.key} onChange={() => { setReason(r.key); setWhy(null) }} />
            {r.words}
          </label>
        ))}
      </fieldset>
      <input
        type="text"
        data-lien-leave-out-note
        aria-label={reason === 'other' ? OUT.noteNeeded : OUT.notePlaceholder}
        placeholder={reason === 'other' ? OUT.noteNeeded : OUT.notePlaceholder}
        value={note}
        maxLength={300}
        onChange={(e) => { setNote(e.target.value); setWhy(null) }}
        onKeyDown={(e) => { if (e.key === 'Enter') void go(); else if (e.key === 'Escape') onClose() }}
        style={{ padding: '7px 9px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontSize: isMobile ? '1rem' : '0.8125rem', minWidth: 0, ...tall(isMobile) }}
      />
      {why ? <div role="alert" data-lien-leave-out-why style={{ fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{why}</div> : null}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" data-lien-leave-out-confirm disabled={busy} onClick={() => void go()} style={{ ...blueBtn, ...tall(isMobile), ...(busy ? deadBtn : null) }}>
          {again ? OUT.leaveOutAgain : OUT.confirm}
        </button>
        <button type="button" data-lien-leave-out-cancel disabled={busy} onClick={onClose} style={{ ...plainBtn, ...tall(isMobile) }}>
          {OUT.cancel}
        </button>
      </div>
    </div>
  )
}

/** A line's first cell: the job's number as its chip reads, then the job, a press that opens the paper. */
function Who({ line, isMobile, onOpenLine }: { line: LienRunLine; isMobile: boolean; onOpenLine: (line: LienRunLine) => void }) {
  return (
    <span style={{ display: 'flex', alignItems: isMobile ? 'center' : 'baseline', gap: 8, minWidth: 0 }}>
      <span data-lien-run-chip={line.atRisk ? 'risk' : 'plain'} style={{ ...chip, flex: 'none', ...(line.atRisk ? { border: '1px solid var(--border-red)', color: 'var(--text-red-700)', background: 'var(--bg-red-tint)' } : null) }}>
        {line.label}
        {line.atRisk ? ' !' : ''}
      </span>
      <button type="button" className="lienJobDoor" data-lien-run-open={line.key} onClick={() => onOpenLine(line)} style={{ ...linkBtn, color: 'var(--text-strong)', minWidth: 0, overflowWrap: 'anywhere', ...tall(isMobile) }}>
        {line.title}
      </button>
    </span>
  )
}

/** A line's question: the kind, the bin in the Board's words, then the one thing to know. */
function Question({ line }: { line: LienRunLine }) {
  return (
    <span style={{ minWidth: 0 }}>
      <span style={{ ...lienKindTagStyle(line.kind), marginRight: 6 }}>{lienRunKindWord(line.kind)}</span>
      <b data-lien-run-stage style={{ color: 'var(--text-strong)' }}>{line.stage}</b>
      {line.detail ? <span style={{ ...small, display: 'block', marginTop: 2 }}>{line.detail}</span> : null}
    </span>
  )
}

export default function LienGetItRight({ run, isMobile, scrolls, canLeaveOut, userName, onBack, onAct, onOpenLine, onLeaveOut, onPutBack, prints, print }: LienGetItRightProps) {
  const [formFor, setFormFor] = useState<string | null>(null)
  const [putting, setPutting] = useState<string | null>(null)
  const [putWhy, setPutWhy] = useState<{ key: string; why: string } | null>(null)
  const [rightOpen, setRightOpen] = useState(false)
  // Two lines a paper on a computer, as a To do row has: the job and what it owes, then the one thing to know and its presses.
  const lineGrid: CSSProperties = isMobile ? { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6 } : { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', columnGap: 12, rowGap: 4, alignItems: 'center' }
  const rule: CSSProperties = { borderTop: '1px solid var(--border)', padding: '10px 0' }
  /** A cell's place on a computer's two lines: the job, what it owes, the question, the presses, then anything that takes the full width. */
  const at = (n: number): CSSProperties => (isMobile ? {} : { order: n })

  const putBack = async (line: LienRunLine) => {
    if (putting) return
    setPutting(line.key)
    setPutWhy(null)
    try {
      await onPutBack(line)
    } catch (e) {
      setPutWhy({ key: line.key, why: formatErrorMessage(e, 'The paper was not put back.') })
    } finally {
      setPutting(null)
    }
  }
  const putBackPress = (line: LienRunLine, primary: boolean) => (
    <button type="button" data-lien-run-put-back={line.key} disabled={putting === line.key} onClick={() => void putBack(line)} style={{ ...(primary ? blueBtn : plainBtn), ...tall(isMobile), ...(putting === line.key ? deadBtn : null) }}>
      {OUT.putBack}
    </button>
  )
  const putBackWhy = (line: LienRunLine): ReactNode => (putWhy?.key === line.key ? <div role="alert" style={{ gridColumn: '1 / -1', order: 4, fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{putWhy.why}</div> : null)

  /** A line that asks a question: its own press, then Leave out. */
  const settleLine = (line: LienRunLine) => (
    <div key={line.key} data-lien-run-line={line.key} data-standing={line.standing} style={{ ...rule, ...lineGrid }}>
      <Who line={line} isMobile={isMobile} onOpenLine={onOpenLine} />
      <span style={{ minWidth: 0, ...at(2) }}><Question line={line} /></span>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-strong)', textAlign: isMobile ? 'left' : 'right', ...at(1) }}><Money amount={line.amount} /></span>
      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: isMobile ? 'flex-start' : 'flex-end', ...at(3) }}>
        {line.press && line.rowKey ? (
          <button type="button" data-lien-run-act={line.key} onClick={() => onAct(line.rowKey!)} style={{ ...blueBtn, ...tall(isMobile) }}>
            {line.press}
          </button>
        ) : null}
        {canLeaveOut ? (
          <button type="button" data-lien-run-leave-out={line.key} aria-expanded={formFor === line.key} onClick={() => setFormFor(formFor === line.key ? null : line.key)} style={{ ...plainBtn, ...tall(isMobile) }}>
            {OUT.leaveOut}
          </button>
        ) : null}
      </span>
      {formFor === line.key ? <LeaveOutForm line={line} isMobile={isMobile} again={false} onLeaveOut={onLeaveOut} onClose={() => setFormFor(null)} /> : null}
    </div>
  )

  /** A paper left out of an earlier run: the old reason, then Put it back or Leave out again. */
  const askedLine = (line: LienRunLine) => (
    <div key={line.key} data-lien-run-line={line.key} data-standing={line.standing} style={{ ...rule, ...lineGrid }}>
      <Who line={line} isMobile={isMobile} onOpenLine={onOpenLine} />
      <span style={{ minWidth: 0, ...at(2), ...(isMobile ? null : { gridColumn: '1 / -1' }) }}>
        <Question line={line} />
        {line.leftOut ? (
          <span data-lien-run-asked-why style={{ ...small, display: 'block', marginTop: 2, color: 'var(--text-amber-800)' }}>
            <ValueSentence text={lienAskedAgainWords(line.leftOut, userName)} />. {lienLeaveOutReasonWords(line.leftOut)}
          </span>
        ) : null}
        {line.rightNow ? <span style={{ ...small, display: 'block', marginTop: 2 }}>{WORDS.rightNow}</span> : null}
      </span>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-strong)', textAlign: isMobile ? 'left' : 'right', ...at(1) }}><Money amount={line.amount} /></span>
      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: isMobile ? 'flex-start' : 'flex-end', ...at(3), ...(isMobile ? null : { gridColumn: '1 / -1' }) }}>
        {line.press && line.rowKey ? (
          <button type="button" data-lien-run-act={line.key} onClick={() => onAct(line.rowKey!)} style={{ ...plainBtn, ...tall(isMobile) }}>
            {line.press}
          </button>
        ) : null}
        {canLeaveOut ? putBackPress(line, true) : null}
        {canLeaveOut ? (
          <button type="button" data-lien-run-leave-out={line.key} aria-expanded={formFor === line.key} onClick={() => setFormFor(formFor === line.key ? null : line.key)} style={{ ...plainBtn, ...tall(isMobile) }}>
            {OUT.leaveOutAgain}
          </button>
        ) : null}
      </span>
      {putBackWhy(line)}
      {formFor === line.key ? <LeaveOutForm line={line} isMobile={isMobile} again onLeaveOut={onLeaveOut} onClose={() => setFormFor(null)} /> : null}
    </div>
  )

  const nothingLeft = run.counts.papers === 0 && run.counts.leftOut === 0

  return (
    <div data-lien-run="view" data-step={run.step ?? 'none'} data-scrolls={scrolls ? 'yes' : 'no'} style={{ overflowY: scrolls ? 'auto' : 'visible', minHeight: 0, padding: isMobile ? '0.6rem 0.75rem 1rem' : '0.75rem 1.25rem 1.25rem', display: 'grid', gap: 12, alignContent: 'start', fontSize: '0.875rem', color: 'var(--text-700)' }}>
      <div data-lien-run-head style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: isMobile ? 6 : 12 }}>
        <button type="button" data-lien-run-back onClick={onBack} style={{ ...plainBtn, ...tall(isMobile) }}>
          ‹ {WORDS.back}
        </button>
        <h2 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-strong)' }}><ValueSentence text={lienRunHead(run)} /></h2>
        <span data-lien-run-total style={{ marginLeft: isMobile ? 0 : 'auto', fontSize: '0.8125rem' }}>
          <WorkedOutValue>{String(run.counts.papers)}</WorkedOutValue> {run.counts.papers === 1 ? 'paper' : 'papers'} · <b style={{ color: 'var(--text-strong)' }}><Money amount={run.totals.run} /></b>
          {run.counts.leftOut > 0 ? <> · <WorkedOutValue>{String(run.counts.leftOut)}</WorkedOutValue> left out</> : null}
        </span>
      </div>

      <StepStrip steps={run.steps} isMobile={isMobile} />

      {nothingLeft ? <EmptyState main={emptyWords({ kind: 'waiting', who: 'this run' }).main} compact /> : null}

      {run.asked.length > 0 ? (
        <section data-lien-run-card="asked" style={{ ...card, border: '1px solid var(--border-amber)' }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-strong)' }}>
            Left out of an earlier run · <WorkedOutValue>{String(run.asked.length)}</WorkedOutValue>
          </h3>
          <p style={{ ...small, margin: '4px 0 8px' }}>{WORDS.askedLead}</p>
          {run.asked.map(askedLine)}
        </section>
      ) : null}

      {run.settle.length > 0 ? (
        <section data-lien-run-card="settle" style={card}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-strong)', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline' }}>
            <span>1 · {WORDS.step1}</span>
            <span style={{ fontWeight: 600, color: 'var(--text-red-700)' }}><WorkedOutValue tone="red">{String(run.settle.length)}</WorkedOutValue> to settle</span>
            <span style={{ marginLeft: 'auto', fontWeight: 500, fontSize: '0.8125rem', color: 'var(--text-muted)' }}><b style={{ color: 'var(--text-strong)' }}><Money amount={run.totals.waits} /></b> waits on these</span>
          </h3>
          <p style={{ ...small, margin: '4px 0 8px' }}>{WORDS.lead}</p>
          <div role="progressbar" aria-label="Papers that are right" aria-valuemin={0} aria-valuemax={Math.max(1, run.counts.papers)} aria-valuenow={run.counts.right} style={{ height: 6, borderRadius: 999, background: 'var(--bg-muted)', overflow: 'hidden', marginBottom: 2 }}>
            <i style={{ display: 'block', height: '100%', width: `${run.counts.papers > 0 ? Math.round((run.counts.right / run.counts.papers) * 100) : 0}%`, background: '#15803d' }} />
          </div>
          {run.settle.map(settleLine)}
        </section>
      ) : null}

      {run.counts.settle === 0 && run.counts.right > 0 ? (
        <section data-lien-run-card="ready" style={{ ...card, border: '1px solid var(--border-blue)' }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-strong)' }}>
            {WORDS.allRight}
            {run.counts.leftOut > 0 ? <> <WorkedOutValue>{String(run.counts.leftOut)}</WorkedOutValue> left out.</> : null}
          </h3>
          {!print && prints && prints.length > 0 ? (
            <>
              <p style={{ ...small, margin: '4px 0 8px' }}>{WORDS.printsLead}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {prints.map((p) => (
                  <button key={p.key} type="button" data-lien-run-print={p.key} disabled={p.dead} onClick={p.onPress} style={{ ...blueBtn, ...tall(isMobile), ...(p.dead ? deadBtn : null) }}>
                    {p.label}
                    {p.left ? <span style={{ fontWeight: 500 }}> · {p.left}</span> : null}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {print ? (
        <section data-lien-run-card="print" style={{ ...card, ...(print.press.dead ? null : { border: '1px solid var(--border-blue)' }) }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-strong)', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline' }}>
            <span>2 · {PRINT.head}</span>
            {print.press.papers > 0 ? (
              <span style={{ marginLeft: 'auto', fontWeight: 500, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                <WorkedOutValue>{String(print.press.papers)}</WorkedOutValue> {print.press.papers === 1 ? 'paper' : 'papers'}
              </span>
            ) : null}
          </h3>
          <p style={{ ...small, margin: '4px 0 8px' }}>{print.order ? <ValueSentence text={print.order} /> : PRINT.nothing}</p>
          {print.mode === 'two' ? (
            <>
              <p style={{ ...small, margin: '0 0 8px', color: 'var(--text-700)' }}>{print.twoWhy}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" data-lien-run-print="notices" disabled={print.press.dead} onClick={() => print.print('notices')} style={{ ...blueBtn, ...tall(isMobile), ...(print.press.dead ? deadBtn : null) }}>
                  {print.press.dead ? print.press.label : print.parts.notices}
                </button>
                <button type="button" data-lien-run-print="affidavits" onClick={() => print.print('affidavits')} style={{ ...blueBtn, ...tall(isMobile) }}>
                  {print.parts.affidavits}
                </button>
              </div>
            </>
          ) : (
            <button type="button" data-lien-run-print="run" disabled={print.press.dead} onClick={() => print.print()} style={{ ...blueBtn, ...tall(isMobile), ...(print.press.dead ? deadBtn : null), whiteSpace: 'normal', textAlign: 'left' }}>
              {print.press.label}
            </button>
          )}
          {print.press.foot ? (
            <p data-lien-run-print-foot style={{ ...small, margin: '8px 0 0' }}>
              <ValueSentence text={print.press.foot} />
            </p>
          ) : null}
          {print.stopped.length > 0 ? (
            <>
              <ul data-lien-run-print-stopped style={{ ...small, margin: '6px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
                {print.stopped.map((s) => (
                  <li key={s.itemId} data-lien-run-print-stopped-row={s.kind}>
                    <WorkedOutValue>{s.label}</WorkedOutValue> {s.why}
                  </li>
                ))}
              </ul>
              {print.stopped.some((s) => s.kind === 'held') ? <p style={{ ...small, margin: '6px 0 0' }}>{PRINT.stoppedDoor}</p> : null}
            </>
          ) : null}
          {run.counts.leftOut > 0 ? (
            <p style={{ ...small, margin: '6px 0 0' }}>
              <WorkedOutValue>{String(run.counts.leftOut)}</WorkedOutValue> left out of this run {run.counts.leftOut === 1 ? 'does' : 'do'} not print. {run.counts.leftOut === 1 ? 'It is' : 'They are'} listed below.
            </p>
          ) : null}
          {print.printed ? (
            <p role="status" data-lien-run-printed style={{ fontSize: '0.8125rem', color: 'var(--text-green-700)', margin: '8px 0 0' }}>
              <ValueSentence text={print.printed.words} /> {print.printed.next}
            </p>
          ) : null}
        </section>
      ) : null}

      {run.right.length > 0 ? (
        <details data-lien-run-card="right" style={card} onToggle={(e) => setRightOpen(e.currentTarget.open)}>
          <summary style={{ cursor: 'pointer', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline', ...tall(isMobile) }}>
            <b style={{ color: 'var(--text-strong)' }}><WorkedOutValue>{String(run.right.length)}</WorkedOutValue> {run.right.length === 1 ? 'paper is' : 'papers are'} right</b>
            <span style={small}>{run.rightParts}</span>
            <span aria-hidden="true" data-lien-run-right-caret style={{ ...small, color: 'var(--text-link)', fontWeight: 600 }}>{rightOpen ? 'hide them ▾' : 'show them ▸'}</span>
            <b style={{ marginLeft: 'auto', color: 'var(--text-strong)' }}><Money amount={run.totals.right} /></b>
          </summary>
          {run.right.map((line) => (
            <div key={line.key} data-lien-run-line={line.key} data-standing={line.standing} style={{ ...rule, ...lineGrid }}>
              <Who line={line} isMobile={isMobile} onOpenLine={onOpenLine} />
              <span style={{ minWidth: 0, ...at(2) }}><Question line={line} /></span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-strong)', textAlign: isMobile ? 'left' : 'right', ...at(1) }}><Money amount={line.amount} /></span>
            </div>
          ))}
        </details>
      ) : null}

      {run.leftOut.length > 0 ? (
        <section data-lien-run-card="left-out" style={{ ...card, border: '1px dashed var(--border-strong)' }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-strong)' }}>
            <WorkedOutValue>{String(run.leftOut.length)}</WorkedOutValue> left out of this run
          </h3>
          {run.leftOut.map((line) => (
            <div key={line.key} data-lien-run-line={line.key} data-standing={line.standing} style={{ ...rule, ...lineGrid }}>
              <Who line={line} isMobile={isMobile} onOpenLine={onOpenLine} />
              <span style={{ minWidth: 0, ...at(2) }}>
                <Question line={line} />
                {line.leftOut ? (
                  <span data-lien-run-left-out-why style={{ ...small, display: 'block', marginTop: 2 }}>
                    <ValueSentence text={lienLeftOutByWords(line.leftOut, userName)} />. {lienLeaveOutReasonWords(line.leftOut)}
                  </span>
                ) : null}
                {line.rightNow ? <span data-lien-run-right-now style={{ ...small, display: 'block', marginTop: 2, color: 'var(--text-amber-800)' }}>{WORDS.rightNow}</span> : null}
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-strong)', textAlign: isMobile ? 'left' : 'right', ...at(1) }}><Money amount={line.amount} /></span>
              <span style={{ display: 'flex', justifyContent: isMobile ? 'flex-start' : 'flex-end', ...at(3) }}>{canLeaveOut ? putBackPress(line, false) : null}</span>
              {putBackWhy(line)}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  )
}
