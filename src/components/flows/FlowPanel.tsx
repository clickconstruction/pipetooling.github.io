import { Fragment } from 'react'
import type { FlowPanelModel, PanelBox } from '../../lib/flows/panel'
import { weekdayDate } from '../../lib/gc/words'
import { Btn } from '../gc/gcUi'

/**
 * The flow panel (Messages cut 4; the prototype v1.178's `flowPanelHtml`): one person's journey with us, lane by lane,
 * each step a press that opens its card. The Per job lane is drawn for one job, picked in its caption. Under it, how
 * far along, See their page and Edit the flow.
 */

const STATE_WORDS: Record<PanelBox['state'], string> = {
  done: 'done',
  now: 'on now',
  next: 'next',
  later: 'later',
  lapsed: 'lapsed',
  skipped: 'skipped',
}

const MOVE_WORDS: Record<NonNullable<PanelBox['move']>, string> = { us: 'our move', them: 'their move', both: 'both', wait: 'waiting' }

const tone = (b: PanelBox): { bg: string; fg: string; border: string } => {
  if (b.state === 'lapsed') return { bg: 'var(--bg-red-100)', fg: 'var(--text-red-800)', border: 'var(--text-red-800)' }
  if (b.state === 'now') return { bg: 'var(--bg-amber-100)', fg: 'var(--text-amber-800)', border: 'var(--text-amber-800)' }
  if (b.state === 'done') return { bg: 'var(--bg-green-100)', fg: 'var(--text-green-800)', border: 'var(--border)' }
  return { bg: 'var(--surface)', fg: 'var(--text-600)', border: 'var(--border)' }
}

export function FlowGlobe() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 4 }}>
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        <circle cx="8" cy="8" r="6.5" />
        <ellipse cx="8" cy="8" rx="2.8" ry="6.5" />
        <path d="M1.5 8h13M2.6 4.8h10.8M2.6 11.2h10.8" />
      </g>
    </svg>
  )
}

function StepBox({ box, onPress }: { box: PanelBox; onPress: () => void }) {
  const t = tone(box)
  const label = `${box.name}: ${STATE_WORDS[box.state]}${box.move ? `, ${MOVE_WORDS[box.move]}` : ''}${box.day ? `, ${box.day.words}` : ''}`
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={label}
      data-flow-step={box.stepId}
      data-flow-state={box.state}
      style={{
        display: 'grid',
        gap: 2,
        width: '100%',
        textAlign: 'left',
        padding: '0.4rem 0.55rem',
        borderRadius: 8,
        border: `1px solid ${t.border}`,
        background: t.bg,
        color: t.fg,
        cursor: 'pointer',
        font: 'inherit',
      }}
    >
      <span style={{ display: 'flex', gap: 6, alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600 }}>
          {box.symbol ? <span aria-hidden="true">{box.symbol} </span> : null}
          {box.name}
        </span>
        {box.move ? <span style={{ fontSize: '0.75rem' }}>{box.waitingOn ? `waiting on ${box.waitingOn}` : MOVE_WORDS[box.move]}</span> : null}
      </span>
      {box.papers.length ? (
        <span style={{ fontSize: '0.75rem' }} title={box.papers.map((p) => p.words).join('. ')}>
          {box.papers.map((p) => `${p.short} ${p.mark}`).join(' · ')}
        </span>
      ) : null}
      {box.words ? <span style={{ fontSize: '0.75rem' }}>{box.words}</span> : null}
      {box.day ? <span style={{ fontSize: '0.75rem', fontWeight: box.day.late ? 600 : 400 }}>{box.day.words}</span> : null}
      {box.lapsed ? <span style={{ fontSize: '0.75rem' }}>{box.lapsed}</span> : null}
      {box.skipWhy ? <span style={{ fontSize: '0.75rem' }}>Skipped: {box.skipWhy}</span> : null}
    </button>
  )
}

export function FlowPanel({
  model,
  onStep,
  onJob,
  onFold,
  pageHref,
  onEditFlow,
  onTakeOff,
}: {
  model: FlowPanelModel
  /** A step's box was pressed: open its card. */
  onStep: (stepId: string, jobId: string | null) => void
  /** Another job was picked for the Per job lane. */
  onJob: (jobId: string) => void
  /** Fold to the rail. Unset: no fold. */
  onFold?: () => void
  /** Their page as the office opens it. Unset: no globe. */
  pageHref?: string | null
  /** Settings → Flows. Unset: no link. */
  onEditFlow?: () => void
  /** Take them off the flow, with why. Unset, or already off: no press. */
  onTakeOff?: () => void
}) {
  return (
    <section aria-label={model.title} data-flow-panel="" style={{ display: 'grid', gap: '0.6rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>{model.title}</h3>
        {onFold ? (
          <Btn kind="quiet" onClick={onFold} title="Shrink the flow to its rail of marks.">
            fold ›
          </Btn>
        ) : null}
      </header>
      {model.off ? (
        <p role="note" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Off the flow since {weekdayDate(model.off.since)}. {model.off.why}
        </p>
      ) : null}
      {model.lanes.map((l) => (
        <div key={`${l.lane}@${l.jobId ?? ''}`} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.5rem', background: 'var(--surface)', display: 'grid', gap: 4 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
            <span>{l.label}</span>
            {l.lane === 'per_job' && model.jobs.length ? (
              <select
                aria-label="Which job"
                value={model.jobId ?? ''}
                onChange={(e) => onJob(e.target.value)}
                style={{ font: 'inherit', textTransform: 'none', letterSpacing: 0, fontSize: '0.8rem', maxWidth: '100%' }}
              >
                {model.jobs.map((j) => (
                  <option key={j.jobId} value={j.jobId}>
                    {j.name} · {j.words}
                    {j.isDefault ? ' · the default' : ''}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          {l.boxes.map((b, i) => (
            <Fragment key={b.stepId}>
              {b.aside ? (
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', textAlign: 'center', color: 'var(--text-muted)', borderTop: '1px dashed var(--border)', paddingTop: 6 }}>
                  any time in the job
                </div>
              ) : i ? (
                <div aria-hidden="true" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: 1 }}>
                  ↓
                </div>
              ) : null}
              <StepBox box={b} onPress={() => onStep(b.stepId, b.jobId)} />
            </Fragment>
          ))}
        </div>
      ))}
      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        {model.progress.done} of {model.progress.of} steps done.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: '0.85rem' }}>
        {pageHref ? (
          <a href={pageHref} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-blue-500)' }}>
            <FlowGlobe />
            See their page
          </a>
        ) : null}
        {onEditFlow ? (
          <Btn kind="quiet" onClick={onEditFlow} title="Opens the flow in Settings → Flows.">
            Edit the flow
          </Btn>
        ) : null}
        {onTakeOff && !model.off ? (
          <Btn kind="quiet" onClick={onTakeOff} title="Takes them off the flow, with why. No reminder goes while they are off.">
            Take off the flow
          </Btn>
        ) : null}
      </div>
    </section>
  )
}
