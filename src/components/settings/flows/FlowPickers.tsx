/**
 * Settings → Flows' two pickers (the prototype's `factPicker` and `paperPicker`, v1.178): what finishes a step, picked
 * from the facts the app keeps and never typed, and the papers it turns on. A library paper on the step offers its
 * facts by its name. "+ Add a new paper" hands off to the New paper window, which the steps table opens.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { DOC_FACT_KINDS, FACT_GROUPS, FLOW_FACTS, FLOW_PAPERS, docFact, docFactId, isDocPaperId, type DocFactId } from '../../../lib/flows/facts'
import { flat, type FlowDef, type FlowStep } from '../../../lib/flows/state'
import { docName } from './flowNames'
import { flowHead, flowNote, flowPopover, flowQuiet } from './flowStyles'

/** A popover that closes on a press outside it or on Escape. */
function Popover({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) onClose()
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('keydown', key)
    }
  }, [onClose])
  return (
    <div ref={box} role="dialog" aria-label={label} style={flowPopover}>
      {children}
    </div>
  )
}

const rowStyle = (on: boolean) => ({
  display: 'grid',
  gap: '0.05rem',
  textAlign: 'left' as const,
  padding: '0.3rem 0.4rem',
  borderRadius: 6,
  border: 'none',
  background: on ? 'var(--bg-green-tint)' : 'transparent',
  cursor: on ? 'default' : 'pointer',
  font: 'inherit',
  color: 'var(--text-base)',
})

export function FlowFactPicker({
  flow,
  step,
  docNames,
  onPick,
  onAskForFact,
  onClose,
}: {
  flow: FlowDef
  step: FlowStep
  docNames: Readonly<Record<string, string>>
  onPick: (factId: string, docName?: string) => void
  onAskForFact: () => void
  onClose: () => void
}) {
  const mine = new Set<string>(step.facts)
  const usedOn = (id: string) => flat(flow).find((s) => s.id !== step.id && (s.facts as readonly string[]).includes(id))?.name ?? null
  const docPapers = (step.papers as readonly string[]).filter(isDocPaperId)
  const row = (id: string, text: string, small: string) => {
    const on = mine.has(id)
    const other = on ? null : usedOn(id)
    return (
      <button key={id} type="button" data-fact={id} disabled={on} onClick={() => onPick(id)} style={rowStyle(on)}>
        <span style={{ fontSize: '0.85rem' }}>
          {text}
          {on ? ' · on this step' : other ? ` · also on ${other}` : ''}
        </span>
        <span style={{ ...flowNote, fontSize: '0.75rem' }}>{small}</span>
      </button>
    )
  }
  return (
    <Popover label="Finished when" onClose={onClose}>
      <p style={{ ...flowNote, color: 'var(--text-base)' }}>
        <strong>Finished when</strong> · a fact the app keeps. Pick one. The step turns green when it is true.
      </p>
      {FACT_GROUPS.map((g) => {
        const facts = FLOW_FACTS.filter((f) => f.group === g)
        return facts.length ? (
          <div key={g} style={{ display: 'grid', gap: '0.1rem' }}>
            <div style={flowHead}>{g}</div>
            {facts.map((f) => row(f.id, f.text, f.small))}
          </div>
        ) : null
      })}
      {docPapers.length > 0 && (
        <div style={{ display: 'grid', gap: '0.1rem' }}>
          <div style={flowHead}>Papers from the library</div>
          {docPapers.flatMap((p) => {
            const name = docName(p, docNames)
            return DOC_FACT_KINDS.map((k) => {
              const id: DocFactId = docFactId(p.slice(4), k)
              const f = docFact(id, `the ${name}`)
              const on = mine.has(id)
              return (
                <button key={id} type="button" data-fact={id} disabled={on} onClick={() => onPick(id, name)} style={rowStyle(on)}>
                  <span style={{ fontSize: '0.85rem' }}>
                    {f.text}
                    {on ? ' · on this step' : ''}
                  </span>
                </button>
              )
            })
          })}
        </div>
      )}
      <button type="button" onClick={onAskForFact} style={{ ...flowQuiet, justifySelf: 'start', marginTop: '0.25rem' }}>
        Ask for a fact that is missing
      </button>
    </Popover>
  )
}

export function FlowPaperPicker({
  step,
  onPick,
  onNewPaper,
  onClose,
}: {
  step: FlowStep
  onPick: (paperId: string) => void
  onNewPaper: () => void
  onClose: () => void
}) {
  const on = new Set<string>(step.papers)
  const papers = Object.values(FLOW_PAPERS).filter((p) => !on.has(p.id))
  return (
    <Popover label="The papers this step turns on" onClose={onClose}>
      <p style={{ ...flowNote, color: 'var(--text-base)' }}>
        <strong>The papers this step turns on</strong>
      </p>
      {papers.map((p) => (
        <button key={p.id} type="button" data-paper={p.id} onClick={() => onPick(p.id)} style={rowStyle(false)}>
          <span style={{ fontSize: '0.85rem' }}>{p.label}</span>
        </button>
      ))}
      <button type="button" onClick={onNewPaper} style={{ ...flowQuiet, justifySelf: 'start', marginTop: '0.25rem' }}>
        + Add a new paper
      </button>
    </Popover>
  )
}
