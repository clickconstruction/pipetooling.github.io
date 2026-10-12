import { exhibitHeading, versionLine } from '../../lib/contracts/assemble'
import type { ClausePaperView } from '../../lib/contracts/clauseSign'

/** What a clause paper needs to draw: an assembled paper, or a signed copy's frozen one. */
export type { ClausePaperView } from '../../lib/contracts/clauseSign'

/**
 * Messages, cut 4c: a contract paper made of clauses, as a company reads it (the prototype's `paperHtml`, v1.178). The
 * clauses for everyone, numbered from 1, then the exhibit for the company's trades under its heading, numbered on, then
 * the version line. Settings' preview draws it from `assemblePaper`; the sign page draws the database's assembly of the
 * same rules, and the signed record its frozen copy. A paper with no between line, a person's, draws none.
 */
export function ClausePaper({ paper, showTitle = true }: { paper: ClausePaperView; /** False where the page heads the paper already. */ showTitle?: boolean }) {
  const es = paper.lang === 'es'
  return (
    <article data-clause-paper style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem', lineHeight: 1.45 }}>
      <div>
        {showTitle && <div style={{ fontWeight: 700, fontSize: '1rem' }}>{paper.title}</div>}
        {paper.between.trim() !== '' && (
          <div data-clause-between style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            {es ? 'Entre' : 'Between'} {paper.between}.
          </div>
        )}
      </div>
      <ol data-clause-base style={{ margin: 0, paddingLeft: '1.4rem', display: 'grid', gap: '0.35rem' }}>
        {paper.clauses.map((c) => (
          <li key={c.id} value={c.n}>
            {c.text}
          </li>
        ))}
      </ol>
      {paper.exhibit.length > 0 && (
        <>
          <div data-clause-exhibit-heading style={{ fontWeight: 600, marginTop: '0.25rem' }}>
            {exhibitHeading(paper)}
          </div>
          <ol data-clause-exhibit start={paper.exhibit[0]?.n ?? paper.clauses.length + 1} style={{ margin: 0, paddingLeft: '1.4rem', display: 'grid', gap: '0.35rem' }}>
            {paper.exhibit.map((c) => (
              <li key={c.id} value={c.n}>
                {c.text}
              </li>
            ))}
          </ol>
        </>
      )}
      <div data-clause-version-line style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
        {versionLine(paper)}
      </div>
    </article>
  )
}
