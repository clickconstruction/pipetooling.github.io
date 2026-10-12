import { useMemo, useState } from 'react'
import type { ClauseBook } from '../../lib/contracts/approval'
import { assemblePaper } from '../../lib/contracts/assemble'
import type { PreviewCompany } from '../../lib/contracts/clausesIo'
import { ClausePaper } from './ClausePaper'
import { ClauseField, ClauseWindow } from './ClauseWindow'
import { clauseButtonStyle, clauseInputStyle } from './clauseStyles'

/**
 * Messages, cut 4c: *Preview per trade* (the prototype's `previewContract`, v1.178). The paper as it would go today to a
 * company we pick, in English or Spanish: the clauses for everyone, then that company's trades' exhibit. It is assembled
 * here by the same kernel the sign page uses (`assemble.ts`), so the preview and the sign page never disagree.
 *
 * Since v2.5334 a paper picker opens it for one party with no choice (`as`): a statement of work's company with its
 * package's one trade, or our contract's customer with none.
 */
export function ClausePreviewWindow({
  book,
  companies,
  as,
  onClose,
}: {
  book: ClauseBook
  companies: readonly PreviewCompany[]
  /** The one party it would go to, with no choice: a picker's company or customer. */
  as?: PreviewCompany
  onClose: () => void
}) {
  const withTrades = useMemo(() => companies.filter((c) => c.trades.length > 0), [companies])
  const [companyId, setCompanyId] = useState(withTrades[0]?.id ?? '')
  const [lang, setLang] = useState<'en' | 'es'>('en')
  const company = as ?? withTrades.find((c) => c.id === companyId) ?? null
  const paper = assemblePaper(book.paper, book.clauses, { company: company?.name ?? 'the company', trades: company?.trades ?? [], job: null, lang })

  return (
    <ClauseWindow label={`${book.paper.title}, put together per trade`} title={`${book.paper.title}, put together per trade`} lede="The clauses for everyone, then the exhibit for the company's trades." width={720} onClose={onClose}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'end' }}>
        <div style={{ flex: '1 1 260px' }}>
          {as ? (
            <div data-clause-preview-as style={{ fontSize: '0.88rem' }}>
              As it would go to {as.name}
              {as.trades.length > 0 ? `, ${as.trades.join(', ')}` : ''}
            </div>
          ) : (
            <ClauseField label="As it would go to">
              <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} style={clauseInputStyle}>
                <option value="">A company with no trade: everyone's clauses only</option>
                {withTrades.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}, {c.trades.join(', ')}
                  </option>
                ))}
              </select>
            </ClauseField>
          )}
        </div>
        <div role="group" aria-label="Language" style={{ display: 'flex', gap: '0.3rem' }}>
          {(['en', 'es'] as const).map((l) => (
            <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} style={{ ...clauseButtonStyle, ...(lang === l ? { background: 'var(--bg-blue-tint)', borderColor: '#2563eb' } : {}) }}>
              {l === 'en' ? 'English' : 'Spanish'}
            </button>
          ))}
        </div>
      </div>
      {paper.problem && (
        <div role="status" style={{ color: 'var(--text-amber-800)', fontSize: '0.85rem' }}>
          {paper.problem}
        </div>
      )}
      <div data-theme="light" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.9rem 1rem' }}>
        <ClausePaper paper={paper} />
      </div>
      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>As it would go today. A copy already signed keeps the words and the version it was signed with.</p>
    </ClauseWindow>
  )
}
