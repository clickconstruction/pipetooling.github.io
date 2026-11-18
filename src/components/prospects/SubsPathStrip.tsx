import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { SUB_STAGE_WORDS, SUB_STRIP_SENTENCE, stageCounts, stageHref, stageWords, type StageIn } from '../../lib/prospects/subsStages'
import type { Prospect } from '../../lib/prospects/prospectRow'

/**
 * The strip over the Subs lane (v2.5807, punch list #153): To call → Called → Talked → On the bench → Quoted, the
 * last two doors to Trade partners, the exits folded. Drawn over the deck, the list and the Board. Moved out of
 * `src/pages/Prospects.tsx` (`renderSubsStrip`) unchanged.
 */
export function SubsPathStrip({
  rows,
  calledIds,
  answeredIds,
  quotedCompanyIds,
}: {
  rows: readonly Prospect[]
  calledIds: ReadonlySet<string>
  answeredIds: ReadonlySet<string>
  quotedCompanyIds: ReadonlySet<string>
}) {
  const inp: StageIn = { calledIds, answeredIds, quotedCompanyIds }
  const counts = stageCounts(rows, inp)
  const exits = counts.exits.filter((x) => x.n > 0)
  const box: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '0.35rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-subtle)', minWidth: '5.25rem', textDecoration: 'none', color: 'inherit' }
  return (
    <div role="group" aria-label="The path onto the bench" style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
        {counts.stages.map((st, i) => {
          const href = stageHref(st.stage)
          const inner = (
            <>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{SUB_STAGE_WORDS[st.stage]}</span>
              <span style={{ fontSize: '1.0625rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: st.n === 0 ? 'var(--text-faint)' : 'var(--text-strong)' }}>{st.n}</span>
            </>
          )
          return (
            <span key={st.stage} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {href ? (
                <Link to={href} data-stage={st.stage} title="On Trade partners. Press to open it." style={{ ...box, borderColor: 'var(--border-violet)', background: 'var(--bg-violet-100)' }}>
                  {inner}
                </Link>
              ) : (
                <span data-stage={st.stage} style={box}>{inner}</span>
              )}
              {i < counts.stages.length - 1 && <span aria-hidden style={{ color: 'var(--text-faint)' }}>→</span>}
            </span>
          )
        })}
        {exits.length > 0 && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>
            {exits.map((x) => `${stageWords(x.exit)} ${x.n}`).join(' · ')} folded under the list
          </span>
        )}
      </div>
      <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        {SUB_STRIP_SENTENCE} The last two boxes open Trade partners.
      </p>
    </div>
  )
}
