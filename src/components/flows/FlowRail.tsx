import type { FlowPanelModel, PanelBox } from '../../lib/flows/panel'

/**
 * The flow folded to its rail (the prototype's `railHtml`): each lane's name, a mark per step, and how far along. A
 * mark opens the step's card as the panel's box does; ‹ opens the panel. On a phone the rail is a row over the
 * thread's lines (`row`, cut 10, the prototype's 760 px rule), so the lines keep the whole width; › opens the panel.
 */

/** The row's fade at its right end, so a mark cut off there says there is more. */
const ROW_FADE = 'linear-gradient(90deg, black calc(100% - 22px), transparent)'

const MARK_BG: Record<PanelBox['state'], string> = {
  done: 'var(--bg-green-100)',
  now: 'var(--bg-amber-100)',
  lapsed: 'var(--bg-red-100)',
  next: 'var(--surface)',
  later: 'var(--surface)',
  skipped: 'var(--bg-muted)',
}

export function FlowRail({ model, onStep, onOpen, row = false }: { model: FlowPanelModel; onStep: (stepId: string, jobId: string | null) => void; onOpen: () => void; row?: boolean }) {
  const open = (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open the ${model.title.toLowerCase()}`}
      title="Opens the panel: what is done, what is on now, whose move it is, what comes next."
      style={{ font: 'inherit', cursor: 'pointer', background: 'none', border: 0, color: 'var(--text-blue-500)', ...(row ? { padding: '0.15rem 0.35rem', fontSize: '1.1rem', flex: 'none' } : null) }}
    >
      {row ? '›' : '‹'}
    </button>
  )
  const marks = (
    <>
      {model.off ? <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', flex: 'none' }}>off</span> : null}
      {model.lanes.map((l) => (
        <div key={`${l.lane}@${l.jobId ?? ''}`} style={{ display: 'flex', flexDirection: row ? 'row' : 'column', alignItems: 'center', gap: row ? 4 : 3, flex: 'none' }}>
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
                flex: 'none',
              }}
            >
              {b.symbol}
            </button>
          ))}
        </div>
      ))}
      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flex: 'none' }} title={`${model.progress.done} of ${model.progress.of} steps done.`}>
        {model.progress.done} / {model.progress.of}
      </span>
    </>
  )
  if (row)
    return (
      <nav aria-label={`${model.title}, folded`} data-flow-rail="row" style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', minWidth: 0 }}>
        {/* The marks scroll sideways under a fade; the press that opens the panel stays in reach at the row's end. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, overflowX: 'auto', whiteSpace: 'nowrap', scrollbarWidth: 'none', maskImage: ROW_FADE, WebkitMaskImage: ROW_FADE }}>{marks}</div>
        {open}
      </nav>
    )
  return (
    <nav aria-label={`${model.title}, folded`} data-flow-rail="" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 64 }}>
      {open}
      {marks}
    </nav>
  )
}
