import { useMemo, useState } from 'react'
import type { ClauseBook } from '../../lib/contracts/approval'
import { assemblePaper } from '../../lib/contracts/assemble'
import { choiceOf, resolvedFields, startPicks, type PaperPicks } from '../../lib/contracts/paperSettings'
import { SAMPLE_MARK, SAMPLE_PARTY, SUMMARY_NOTE, levelLine, levelOf, levelWords, samplePress, sampleStamp, summaryLines } from '../../lib/contracts/paperSummary'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { ClauseSamplePrint } from './ClauseSamplePrint'
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
  // A paper built from settings (#389) is put together for a mix of picks, and for the blanks typed for one job.
  const def = book.paper.settingsDef ?? null
  const [picks, setPicks] = useState<PaperPicks>(() => (def ? startPicks(def) : {}))
  const [typed, setTyped] = useState<Record<string, string>>({})
  const filled = def ? resolvedFields(def, picks, null, lang) : {}
  const level = def ? levelOf(def, picks) : null
  // Step 2: the summary beside the paper, and the sample, which is this same paper for a made-up party.
  const [reading, setReading] = useState<'paper' | 'summary'>('paper')
  const [printing, setPrinting] = useState(false)
  const paper = assemblePaper(book.paper, book.clauses, { company: company?.name ?? 'the company', trades: company?.trades ?? [], job: null, lang, ...(def ? { picks, fields: typed } : {}) })
  const sample = samplePress(paper.problem)

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
      {def && (
        <div data-clause-preview-settings style={{ display: 'grid', gap: '0.5rem', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.7rem' }}>
          {def.levels.length > 0 && (
            <div role="group" aria-label="Level" style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {def.levels.map((l) => (
                <button key={l.key} type="button" aria-pressed={level?.key === l.key} onClick={() => setPicks({ ...startPicks(def), ...l.picks })} style={{ ...clauseButtonStyle, ...(level?.key === l.key ? { background: 'var(--bg-blue-tint)', borderColor: '#2563eb' } : {}) }}>
                  {l.label}
                </button>
              ))}
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{level ? levelWords(def, picks, lang).aligned : levelWords(def, picks, lang).name}</span>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.45rem' }}>
            {def.settings.map((s) => (
              <ClauseField key={s.key} label={s.label}>
                <select aria-label={s.label} value={picks[s.key] ?? ''} onChange={(e) => setPicks((now) => ({ ...now, [s.key]: e.target.value }))} style={clauseInputStyle}>
                  {!choiceOf(def, s.key, picks[s.key]) && <option value="">Pick one</option>}
                  {s.choices.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </ClauseField>
            ))}
            {def.fields
              .filter((f) => !(f.key in filled))
              .map((f) => (
                <ClauseField key={f.key} label={`${f.label}, typed for one job`}>
                  <input aria-label={`${f.label}, typed for one job`} value={typed[f.key] ?? ''} onChange={(e) => setTyped((now) => ({ ...now, [f.key]: e.target.value }))} style={clauseInputStyle} />
                </ClauseField>
              ))}
          </div>
        </div>
      )}
      {paper.problem && (
        <div role="status" style={{ color: 'var(--text-amber-800)', fontSize: '0.85rem' }}>
          {paper.problem}
        </div>
      )}
      {def && (
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div role="group" aria-label="What to read" style={{ display: 'flex', gap: '0.3rem' }}>
            {(['paper', 'summary'] as const).map((r) => (
              <button key={r} type="button" aria-pressed={reading === r} onClick={() => setReading(r)} style={{ ...clauseButtonStyle, ...(reading === r ? { background: 'var(--bg-blue-tint)', borderColor: '#2563eb' } : {}) }}>
                {r === 'paper' ? 'Paper' : 'Summary'}
              </button>
            ))}
          </div>
          <span style={{ flex: 1 }} />
          {sample.dead && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No sample while the paper cannot go.</span>}
          <button type="button" disabled={sample.dead} onClick={() => setPrinting(true)} style={sample.dead ? { ...clauseButtonStyle, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'not-allowed' } : clauseButtonStyle}>
            {sample.label}
          </button>
        </div>
      )}
      {def && reading === 'summary' ? (
        <div data-clause-summary data-theme="light" style={{ background: 'var(--surface)', color: 'var(--text-base)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.9rem 1rem', display: 'grid', gap: '0.6rem' }}>
          <strong data-clause-summary-level>{levelLine(def, picks, lang)}</strong>
          <dl style={{ margin: 0, display: 'grid', gap: '0.5rem' }}>
            {summaryLines(def, picks, lang).map((l) => (
              <div key={l.key} data-clause-summary-line={l.key} style={{ display: 'grid', gap: 2 }}>
                <dt style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  {l.label}: {l.choice}
                </dt>
                <dd style={{ margin: 0, fontSize: '0.88rem', color: l.out ? 'var(--text-muted)' : 'var(--text-base)' }}>{l.says}</dd>
              </div>
            ))}
          </dl>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>{SUMMARY_NOTE[lang]}</p>
        </div>
      ) : (
        <div data-theme="light" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.9rem 1rem' }}>
          <ClausePaper paper={paper} />
        </div>
      )}
      {printing && def && (
        <ClauseSamplePrint
          paper={assemblePaper(book.paper, book.clauses, { company: SAMPLE_PARTY.company, trades: company?.trades ?? [], job: SAMPLE_PARTY.job, lang, picks, fields: typed })}
          mark={SAMPLE_MARK[lang]}
          stamp={sampleStamp(def, picks, book.paper.revision, lang)}
          facts={[
            ['The job', SAMPLE_PARTY.job],
            ['Signer', `${SAMPLE_PARTY.signer}, ${SAMPLE_PARTY.company}`],
          ]}
          onClose={() => setPrinting(false)}
        />
      )}
      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>As it would go today. A copy already signed keeps the words and the version it was signed with.</p>
    </ClauseWindow>
  )
}
