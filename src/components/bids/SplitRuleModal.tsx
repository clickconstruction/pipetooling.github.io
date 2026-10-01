import type { CSSProperties } from 'react'
import type { SplitExample } from '../../lib/submittals/takeoffCandidates'

const quiet: CSSProperties = { fontSize: '0.8rem', color: 'var(--text-muted)' }
const btn: CSSProperties = { padding: '0.4rem 0.8rem', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', fontWeight: 500 }
const th: CSSProperties = { textAlign: 'left', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--border-strong)' }
const td: CSSProperties = { padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top', fontSize: '0.8125rem' }

/**
 * When a row can split (v2.4118): the rule in two sentences, then this bid's own count names as the
 * rule reads them — the same reader that offers the Split switch, so the table is always true for the bid on screen.
 */
export function SplitRuleModal({ examples, onClose }: { examples: ReadonlyArray<SplitExample>; onClose: () => void }) {
  const shown = examples.slice(0, 40)
  return (
    <div role="presentation" onClick={(e) => { e.stopPropagation(); onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div role="dialog" aria-modal="true" aria-label="When a row can split" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 8, maxWidth: 600, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '1rem 1.25rem 0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)' }}>When a row can split</h3>
          <p style={{ ...quiet, margin: '0.3rem 0 0' }}>The app reads the tags off a fixture’s name. A name that spells out more than one tag — <i>WC 1&amp;2</i>, <i>UR 1, 2 &amp; 3</i> — gets the Split switch; the rest do not. Off, the row keeps every tag on one line. On, each tag gets its own row with the same product, house and count.</p>
        </div>
        <div style={{ overflowY: 'auto', padding: '0 1.25rem' }}>
          {shown.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="split-rule-table">
              <thead><tr><th style={th}>On this bid</th><th style={th}>Reads as</th><th style={th}></th></tr></thead>
              <tbody>
                {shown.map((x) => (
                  <tr key={x.name}>
                    <td style={td}>{x.name}</td>
                    <td style={td}>{x.readsAs}{x.note ? <span style={{ ...quiet, display: 'block' }}>{x.note}</span> : null}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap', fontWeight: 600, color: x.canSplit ? 'var(--text-green-700)' : 'var(--text-muted)' }}>{x.canSplit ? 'can split' : 'one row'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={quiet}>No fixtures on this bid’s takeoff yet.</p>
          )}
          <p style={{ ...quiet, margin: '0.7rem 0 0.5rem' }}>
            To split a row the app cannot read — <i>WC-1</i> that covers WC-1 and WC-1A on the plans — rename the count on Takeoffs to <i>WC 1&amp;1A</i>, or add the second row by hand after Rev 1 is built. The same reader runs on a draft row’s tag, so a row typed as <i>WC-1, WC-2</i> gets Split too.
          </p>
        </div>
        <div style={{ padding: '0.6rem 1.25rem 1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={btn}>Close</button>
        </div>
      </div>
    </div>
  )
}
