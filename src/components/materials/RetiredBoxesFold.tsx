/**
 * Materials on site (punch list #209, v2.6406): the Retired fold at the foot of a job's container
 * list on Jobs → Materials. A cage or box retired by mistake comes back from here with one press;
 * the press is withheld, with its reason, when a live box on the job carries the stencil now.
 * Rules in `lib/materials/unretire.ts`.
 */
import type { CSSProperties } from 'react'
import type { Container } from '../../lib/materials/onSite'
import { bringBackLabel, retiredContainers, retiredFoldWords, unretireVerdict } from '../../lib/materials/unretire'

type Props = {
  /** Every container of the job, live and retired: the verdict needs both. */
  containers: ReadonlyArray<Container>
  onBringBack: (c: Container) => void
  /** The day a box was retired, drawn by the page's own stamp. */
  stamp: (iso: string) => React.ReactNode
}

const wrap: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '0.5rem 0.9rem' }
const summary: CSSProperties = { cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-muted)', minHeight: 36, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }
const row: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', padding: '0.45rem 0', borderTop: '1px solid var(--border)' }
const press: CSSProperties = { minHeight: 36, padding: '0 0.75rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem' }

export default function RetiredBoxesFold({ containers, onBringBack, stamp }: Props) {
  const retired = retiredContainers(containers)
  if (retired.length === 0) return null
  return (
    <details style={wrap} data-testid="retired-fold">
      <summary style={summary}>
        <span>{retiredFoldWords(retired.length)}</span>
        <span style={{ ...muted, fontWeight: 400 }}>A box retired by mistake comes back from here, and its label works again.</span>
      </summary>
      <div style={{ display: 'grid' }}>
        {retired.map((c) => {
          const v = unretireVerdict(containers, c.id)
          return (
            <div key={c.id} style={row} data-testid="retired-row">
              <span>
                <b style={{ fontSize: '1.05rem' }}>{c.label}</b>
                <span style={muted}> {c.kind === 'cage' ? 'cage' : 'box'} · retired {c.retiredAt ? stamp(c.retiredAt) : ''}</span>
              </span>
              {v.ok ? (
                <button type="button" style={press} onClick={() => onBringBack(c)}>{bringBackLabel(c)}</button>
              ) : (
                <span style={muted} data-testid="retired-refusal">{v.words}</span>
              )}
            </div>
          )
        })}
      </div>
    </details>
  )
}
