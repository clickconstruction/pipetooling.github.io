import type { FlowPanelModel, PanelBox } from '../../lib/flows/panel'

/**
 * The flow folded to its rail (the prototype's `railHtml`): each lane's name, a mark per step, and how far along. A
 * mark opens the step's card as the panel's box does; ‹ opens the panel.
 */

const MARK_BG: Record<PanelBox['state'], string> = {
  done: 'var(--bg-green-100)',
  now: 'var(--bg-amber-100)',
  lapsed: 'var(--bg-red-100)',
  next: 'var(--surface)',
  later: 'var(--surface)',
  skipped: 'var(--bg-muted)',
}

export function FlowRail({ model, onStep, onOpen }: { model: FlowPanelModel; onStep: (stepId: string, jobId: string | null) => void; onOpen: () => void }) {
  return (
    <nav aria-label={`${model.title}, folded`} data-flow-rail="" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 64 }}>
      <button type="button" onClick={onOpen} aria-label={`Open the ${model.title.toLowerCase()}`} title="Opens the panel: what is done, what is on now, whose move it is, what comes next." style={{ font: 'inherit', cursor: 'pointer', background: 'none', border: 0, color: 'var(--text-blue-500)' }}>
        ‹
      </button>
      {model.off ? <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>off</span> : null}
      {model.lanes.map((l) => (
        <div key={`${l.lane}@${l.jobId ?? ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{l.label}</span>
          {l.boxes.map((b) => (
            <button
              key={b.stepId}
              type="button"
              onClick={() => onStep(b.stepId, b.jobId)}
              aria-label={`${b.name}: ${b.state === 'now' ? 'on now' : b.state}`}
              title={b.name}
              data-flow-mark={b.stepId}
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                border: '1px solid var(--border)',
                background: MARK_BG[b.state],
                fontSize: '0.7rem',
                lineHeight: 1,
                cursor: 'pointer',
                color: 'var(--text-600)',
              }}
            >
              {b.symbol}
            </button>
          ))}
        </div>
      ))}
      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }} title={`${model.progress.done} of ${model.progress.of} steps done.`}>
        {model.progress.done} / {model.progress.of}
      </span>
    </nav>
  )
}
