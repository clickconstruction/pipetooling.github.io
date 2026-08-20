import type { EstimateDraftStep, EstimateDraftSendGate, EstimateDraftStepKey } from '../../lib/estimateDraftSteps'

/**
 * The draft editor's numbered guide (step rail train PR 2, rail-v2 mockup):
 * on wide screens a fixed rail in the left gutter beside the centered paper;
 * below 1360px a sticky horizontal strip above the content. Both render from
 * the estimateDraftSteps kernel and share the send button + "N steps left"
 * hint. Steps group under "On the customer's copy" / "Behind the scenes" so
 * the layout itself teaches what the customer sees.
 */

const RAIL_CSS = `
  /* Paper-region delineation (owner request: obvious section boundaries). */
  .est-step-margin-dot {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    margin-right: 0.45rem;
    vertical-align: -3px;
    font-size: 0.68rem;
    font-weight: 700;
    border: 1.5px solid var(--border-strong);
    background: var(--surface);
    color: var(--text-muted);
    flex-shrink: 0;
  }
  .est-step-margin-dot.done { border-color: var(--text-green-600); color: var(--text-green-600); }
  .est-step-margin-dot.attention { border-color: #f59e0b; color: var(--text-amber-800); }
  .est-region-ruled {
    border-top: 1px solid var(--border-rule);
    margin-top: 1.35rem;
    padding-top: 1.1rem;
  }
  .est-region-tint { transition: background 0.2s ease; border-radius: 8px; }
  .est-region-tint:focus-within { background: var(--bg-subtle); }
  .est-backstage-card {
    margin-top: 1.35rem;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg-subtle);
    padding: 0.9rem 1rem 1rem;
  }
  .est-backstage-head {
    font-weight: 600;
    font-size: 1.05rem;
    margin: 0 0 0.15rem;
  }
  .est-backstage-head .est-backstage-sub {
    display: block;
    font-weight: 500;
    font-size: 0.78rem;
    color: var(--text-muted);
    margin-bottom: 0.35rem;
  }

  .est-step-rail {
    display: none;
  }
  .est-step-strip {
    position: sticky;
    top: 0;
    z-index: 30;
    display: flex;
    gap: 0.3rem;
    align-items: center;
    padding: 0.45rem 0.5rem;
    margin-bottom: 0.9rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-subtle);
    overflow-x: auto;
  }
  .est-step-strip::-webkit-scrollbar { display: none; }
  .est-step-strip .est-strip-step {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.25rem 0.55rem;
    border-radius: 9999px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-700);
    cursor: pointer;
    white-space: nowrap;
  }
  .est-step-strip .est-strip-step.done { border-color: var(--text-green-600); color: var(--text-green-600); }
  .est-step-strip .est-strip-step.attention { border-color: #f59e0b; color: var(--text-amber-800); }
  @media (min-width: 1400px) {
    .est-step-strip { display: none; }
    .est-step-rail {
      display: block;
      position: fixed;
      top: 92px;
      left: calc(50vw - 450px - 232px);
      width: 212px;
      z-index: 20;
    }
  }
  .est-step-rail .est-rail-group {
    font-size: 0.62rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin: 0.7rem 0 0.25rem 0.5rem;
  }
  .est-step-rail .est-rail-group:first-child { margin-top: 0; }
  .est-step-rail .est-rail-step {
    display: flex;
    gap: 0.6rem;
    align-items: flex-start;
    width: 100%;
    text-align: left;
    padding: 0.42rem 0.5rem;
    border: none;
    border-radius: 8px;
    background: transparent;
    cursor: pointer;
    font: inherit;
    color: var(--text-strong);
  }
  .est-step-rail .est-rail-step:hover { background: var(--bg-muted); }
  .est-step-rail .est-rail-num {
    flex: 0 0 auto;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.75rem;
    border: 2px solid var(--border-strong);
    background: var(--surface);
    color: var(--text-muted);
  }
  .est-step-rail .est-rail-num.done {
    border-color: var(--text-green-600);
    background: var(--bg-green-tint);
    color: var(--text-green-600);
  }
  .est-step-rail .est-rail-num.attention { border-color: #f59e0b; color: var(--text-amber-800); }
  .est-step-rail .est-rail-lbl b { display: block; font-size: 0.8125rem; font-weight: 600; }
  .est-step-rail .est-rail-lbl span {
    display: block;
    font-size: 0.71rem;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 148px;
  }
  .est-step-rail .est-rail-lbl span.attention { color: var(--text-amber-800); font-weight: 600; }
  .est-rail-view-toggle {
    display: inline-flex;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    overflow: hidden;
    font-size: 0.72rem;
    font-weight: 600;
  }
  .est-rail-view-toggle button {
    border: none;
    background: var(--surface);
    color: var(--text-muted);
    padding: 0.32rem 0.6rem;
    font: inherit;
    cursor: pointer;
  }
  .est-rail-view-toggle button.on { background: #3b82f6; color: white; }
  .est-step-rail .est-rail-view-toggle { margin: 0.9rem 0 0 0.5rem; }
  .est-step-strip .est-rail-view-toggle { flex: 0 0 auto; margin-left: auto; }
  .est-step-rail .est-rail-send {
    margin: 0.8rem 0 0 0.5rem;
    border: none;
    border-radius: 6px;
    padding: 0.5rem 1rem;
    font: inherit;
    font-weight: 600;
    font-size: 0.8125rem;
    background: #ea580c;
    color: white;
    cursor: pointer;
  }
  .est-step-rail .est-rail-send:disabled { opacity: 0.5; cursor: not-allowed; }
  .est-step-rail .est-rail-hint {
    margin: 0.4rem 0 0 0.5rem;
    font-size: 0.71rem;
    color: var(--text-muted);
    max-width: 176px;
    line-height: 1.45;
  }
`

type Props = {
  steps: EstimateDraftStep[]
  sendGate: EstimateDraftSendGate
  onStepClick: (key: EstimateDraftStepKey) => void
  onSend: () => void
  sending: boolean
  sendLabel: string
  customerViewOn: boolean
  onToggleCustomerView: () => void
}

function StepGlyph({ step }: { step: EstimateDraftStep }) {
  return <span className={`est-rail-num ${step.status}`}>{step.status === 'done' ? '✓' : step.number}</span>
}

export default function EstimateDraftStepRail({
  steps,
  sendGate,
  onStepClick,
  onSend,
  sending,
  sendLabel,
  customerViewOn,
  onToggleCustomerView,
}: Props) {
  const paperSteps = steps.filter((s) => s.group === 'paper')
  const backstageSteps = steps.filter((s) => s.group === 'backstage')

  return (
    <>
      <style>{RAIL_CSS}</style>
      <nav className="est-step-strip" aria-label="Draft steps">
        {steps.map((s) => (
          <button key={s.key} type="button" className={`est-strip-step ${s.status}`} onClick={() => onStepClick(s.key)}>
            {s.status === 'done' ? '✓' : s.status === 'attention' ? '●' : ''} {s.number} {s.label}
          </button>
        ))}
        <span className="est-rail-view-toggle" role="group" aria-label="Editor view">
          <button type="button" className={customerViewOn ? undefined : 'on'} onClick={() => customerViewOn && onToggleCustomerView()}>
            Editing
          </button>
          <button type="button" className={customerViewOn ? 'on' : undefined} onClick={() => !customerViewOn && onToggleCustomerView()}>
            Customer view
          </button>
        </span>
      </nav>
      <nav className="est-step-rail" aria-label="Draft steps">
        <p className="est-rail-group">On the customer's copy</p>
        {paperSteps.map((s) => (
          <button key={s.key} type="button" className="est-rail-step" onClick={() => onStepClick(s.key)}>
            <StepGlyph step={s} />
            <span className="est-rail-lbl">
              <b>{s.label}</b>
              <span className={s.status === 'attention' ? 'attention' : undefined}>{s.sublabel}</span>
            </span>
          </button>
        ))}
        <p className="est-rail-group">Behind the scenes</p>
        {backstageSteps.map((s) => (
          <button key={s.key} type="button" className="est-rail-step" onClick={() => onStepClick(s.key)}>
            <StepGlyph step={s} />
            <span className="est-rail-lbl">
              <b>{s.label}</b>
              <span className={s.status === 'attention' ? 'attention' : undefined}>{s.sublabel}</span>
            </span>
          </button>
        ))}
        <span className="est-rail-view-toggle" role="group" aria-label="Editor view">
          <button type="button" className={customerViewOn ? undefined : 'on'} onClick={() => customerViewOn && onToggleCustomerView()}>
            Editing
          </button>
          <button type="button" className={customerViewOn ? 'on' : undefined} onClick={() => !customerViewOn && onToggleCustomerView()}>
            Customer view
          </button>
        </span>
        <br />
        <button type="button" className="est-rail-send" onClick={onSend} disabled={!sendGate.ready || sending}>
          {sending ? 'Sending…' : sendLabel}
        </button>
        <p className="est-rail-hint">{sendGate.sentence}</p>
      </nav>
    </>
  )
}
