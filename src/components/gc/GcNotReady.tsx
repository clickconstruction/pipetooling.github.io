/**
 * GC mode, the real build, the schedule's PR 9d: a trade not ready to start, in the bar's form (G-77), or under way with
 * its insurance run out (G-138). Ported from the GC mode prototype (branch spike/gc-mode, `GcNotReady.tsx`; the plan is
 * to-dos/gc-mode/mockups/schedule-pr9d.md there). It sits first, because it is why the bar is held: who is not ready and
 * by when, each paper that is not in with its own next step, and that the bar stays held until they are. The words are
 * the kernel's (`notReadyBlock`, `uninsuredBlock`), which read the company's own papers since the Board's B6-b-ii.
 *
 * A paper's button opens the company's window on its Documents tab at that paper, with its send open when the reader
 * may send it (`useCompanyOpener`'s `CompanyAt`, the Board's B6-b-ii).
 */
import type { GcProject, GcState } from '../../lib/gc/types'
import { notReadyBlock, uninsuredBlock } from '../../lib/gc/schedule/notReady'
import { useCompanyOpener } from './gcCompanyOpener'
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
      data-not-ready
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
        // The paper's Documents row: 'msa', 'insurance', 'w9' or 'sow-<package>'. Null (an award): no button.
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
