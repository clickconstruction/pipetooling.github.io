/**
 * GC mode design spike: a trade not ready to start, on the opened activity (G-77; the kernel is
 * `gcNotReady.ts`, the mock-up `to-dos/gc-mode/mockups/G-77.md`). It sits first, under the
 * activity's name, because it is why the bar is held: who is not ready and by when, each paper
 * that is not in with its own next step, and that the bar stays held until they are. A paper's
 * button opens the company's window on that paper's send: who it goes to, the day it is due and
 * the email in their language. Sending writes the promise Follow up chases, as it does from there.
 */
import type { GcProject, GcState } from '../../lib/gcMode/gcTypes'
import { notReadyBlock, uninsuredBlock } from '../../lib/gcMode/gcNotReady'
import { useCompanyOpener } from './gcCompanyOpener.proto'
import { Btn } from './gcUi'

export function GcNotReady({ state, project, lineId }: { state: GcState; project: GcProject; lineId: string }) {
  const opener = useCompanyOpener()
  // Not ready to start (G-77), or under way with its insurance run out (G-138).
  const block = notReadyBlock(state, project, lineId) ?? uninsuredBlock(state, project, lineId)
  if (!block) return null
  const partner = block.partner
  // The first paper with a button is the next step, in Get started's order; the rest are plain.
  const first = block.lines.find((l) => l.verb)
  return (
    <div
      data-tour="gc-not-ready"
      style={{
        display: 'grid',
        gap: '0.4rem',
        padding: '0.55rem 0.75rem',
        borderRadius: 6,
        borderLeft: `3px solid ${block.late ? 'var(--border-red)' : 'var(--border-amber)'}`,
        background: block.late ? 'var(--bg-red-tint)' : 'var(--bg-amber-tint)',
      }}
    >
      <strong style={{ color: block.late ? 'var(--text-red-700)' : 'var(--text-amber-800)' }}>{block.title}</strong>
      {block.lines.map((l) => {
        const doc = l.doc
        return (
          <div key={l.kind} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 16rem', minWidth: 0 }}>
              <div>
                {l.line}
                {l.hint ? ` ${l.hint}` : ''}
              </div>
              {l.promise && <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{l.promise}</div>}
            </div>
            {l.verb && doc && partner && opener && (
              <Btn kind={l === first ? 'primary' : 'plain'} onClick={() => opener.openPartner(partner.id, { tab: 'documents', doc, send: true })}>
                {l.verb}
              </Btn>
            )}
          </div>
        )
      })}
      <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{block.last}</div>
    </div>
  )
}
