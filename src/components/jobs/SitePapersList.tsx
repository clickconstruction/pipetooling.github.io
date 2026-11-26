import type { CSSProperties } from 'react'
import { sitePapersCountSentence, type SitePaperLine } from '../../lib/addresses/sitePapers'
import { PARTY_PAPER_TONE_COLORS } from '../../lib/contracts/partyPapers'
import { ValueSentence } from '../valuesInPlace/ValuesInPlace'

/**
 * The lines of a site's papers (punch list #439, piece 3), drawn the same on a job's Documents tab and on a
 * development's page: one line that counts the signed, then each paper with its company first, the paper and who
 * signs under it, and a state chip with its day. It reads and presses nothing.
 */

const quiet: CSSProperties = { margin: 0, color: 'var(--text-muted)', fontSize: '0.8125rem' }
const line: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.2rem 0.75rem', padding: '0.45rem 0', borderTop: '1px solid var(--border)' }
const subLine: CSSProperties = { display: 'block', color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '0.1rem', overflowWrap: 'anywhere' }
const stateChip: CSSProperties = { padding: '0.08rem 0.5rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap' }

export function SitePapersList({ lines, lead, testId }: { lines: ReadonlyArray<SitePaperLine>; lead: string; testId: string }) {
  if (lines.length === 0) return null
  return (
    <>
      <p style={quiet}>{lead}</p>
      <p style={quiet} data-testid={`${testId}-count`}>
        <ValueSentence text={sitePapersCountSentence(lines)} />
      </p>
      <div>
        {lines.map((l) => {
          const colors = PARTY_PAPER_TONE_COLORS[l.state.tone]
          return (
            <div key={l.id} style={line} data-testid={`${testId.replace(/s$/, '')}-row`}>
              <div style={{ minWidth: 0, flex: '1 1 14rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>{l.company}</span>
                <span style={subLine}>{[l.name, l.signer].filter(Boolean).join(' · ')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexShrink: 0 }}>
                <span style={{ ...stateChip, background: colors.background, color: colors.color }}>{l.state.words}</span>
                {l.day ? (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                    <ValueSentence text={l.day} />
                  </span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

export default SitePapersList
