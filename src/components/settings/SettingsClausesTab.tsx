import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { canApproveClause } from '../../lib/gc/access'
import { approvedToast, approveProposal, orWords, scopeFor, type ClauseBook, type ClauseProposal } from '../../lib/contracts/approval'
import { scopeWords, settingsView, type Clause } from '../../lib/contracts/assemble'
import { buildablePapers, clauseHistory, clausePaperAnchor, clausePaperCards, paperFromRow, tradeChoices, type ClausePaperCard } from '../../lib/contracts/clauseRows'
import { approveClauseProposal, loadClauseLibrary, tellClauseEditor, type ClauseLibrary } from '../../lib/contracts/clausesIo'
import { formatDenverDateTimeShort } from '../../utils/dateUtils'
import { formatErrorMessage } from '../../utils/errorHandling'
import { ClauseDeclineWindow } from '../contracts/ClauseDeclineWindow'
import { ClauseEditWindow, type ClauseEditMode } from '../contracts/ClauseEditWindow'
import { ClausePreviewWindow } from '../contracts/ClausePreviewWindow'
import { clauseButtonStyle, clauseInputStyle, clausePrimaryStyle } from '../contracts/clauseStyles'

const when = (at: string): string => {
  const ms = Date.parse(at)
  return Number.isNaN(ms) ? '' : formatDenverDateTimeShort(ms)
}

const cardStyle: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.8rem 0.9rem', display: 'grid', gap: '0.55rem', background: 'var(--surface)' }
const sectionHead: CSSProperties = { fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginTop: '0.2rem' }
const small: CSSProperties = { ...clauseButtonStyle, padding: '0.2rem 0.55rem', fontSize: '0.78rem' }
const smallPrimary: CSSProperties = { ...clausePrimaryStyle, padding: '0.2rem 0.55rem', fontSize: '0.78rem' }
const pill = (forEveryone: boolean): CSSProperties => ({
  fontSize: '0.72rem',
  borderRadius: 999,
  padding: '0 0.5rem',
  border: `1px solid ${forEveryone ? 'var(--border)' : 'var(--bg-blue-200)'}`,
  background: forEveryone ? 'transparent' : 'var(--bg-blue-tint)',
  color: 'var(--text-base)',
  whiteSpace: 'nowrap',
})

type Editing = { mode: ClauseEditMode; book: ClauseBook; clause: Clause | null }

/**
 * Messages, cut 4c: Settings → Contracts and clauses (the prototype's `contractsHtml`, v1.178; `BUILD_PLAN.md` → Cut 4c).
 * One card per library document built from clauses: its version, its clauses for everyone, then one exhibit per trade on
 * the one numbering (`assemble.ts` → `settingsView`), each clause with its trades, its version, Edit, Retire and History.
 * A change waiting on approval sits under its clause, with Approve and Decline for a controller or a dev. *Preview per
 * trade* puts the paper together for a company. *Build a paper from clauses* starts a library document's first clause.
 * Anyone in the office edits; a controller or a dev approves (`gc/access.ts`).
 */
export function SettingsClausesTab() {
  const { showToast } = useToastContext()
  const { user, profileName, role } = useAuth()
  const approver = canApproveClause(role)
  const [lib, setLib] = useState<ClauseLibrary | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [previewing, setPreviewing] = useState<ClauseBook | null>(null)
  const [declining, setDeclining] = useState<ClauseProposal | null>(null)
  const [historyOf, setHistoryOf] = useState<string | null>(null)
  const [buildId, setBuildId] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLib(await loadClauseLibrary())
      setProblem(null)
    } catch (e) {
      setProblem(formatErrorMessage(e))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const cards = useMemo(() => (lib ? clausePaperCards(lib) : []), [lib])
  const buildable = useMemo(() => (lib ? buildablePapers(lib) : []), [lib])
  const trades = useMemo(() => (lib ? tradeChoices(lib.packageTrades, lib.companies.map((c) => c.trades), cards.flatMap((c) => c.book.clauses)) : []), [lib, cards])
  const approvers = lib?.approvers ?? []
  const signer = { userId: user?.id ?? '', name: profileName ?? '', role }

  const approve = async (book: ClauseBook, p: ClauseProposal) => {
    const checked = approveProposal(book, p, signer, { at: new Date().toISOString(), newId: () => 'pending' })
    if (checked.kind === 'refused') {
      showToast(checked.why, 'error')
      return
    }
    setBusy(p.id)
    try {
      await approveClauseProposal(p.id)
      // The editor hears of it (messages-notify); the toast says whether the email went.
      const told = await tellClauseEditor(p.id)
      showToast(approvedToast(signer.name || 'you', p.by, p.kind, Boolean(told?.emailSent)), 'success')
      await load()
    } catch (e) {
      showToast(formatErrorMessage(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  const startBuild = () => {
    const row = lib?.papers.find((p) => p.id === buildId)
    if (!row) return
    setEditing({ mode: 'new', book: { paper: paperFromRow(row), clauses: [] }, clause: null })
  }

  const proposalView = (book: ClauseBook, p: ClauseProposal, clause: Clause | null) => (
    <div key={p.id} data-clause-proposal={p.id} style={{ borderLeft: '3px solid var(--bg-amber-200)', background: 'var(--bg-amber-tint)', borderRadius: 6, padding: '0.45rem 0.6rem', display: 'grid', gap: '0.3rem', fontSize: '0.85rem' }}>
      <div>
        <strong>{p.kind === 'retire' ? `${p.by} wants to retire it` : p.kind === 'new' ? `${p.by} proposed a new clause` : `${p.by} proposed a change`}</strong>
        <span style={{ color: 'var(--text-muted)' }}>
          {' '}
          {[p.kind === 'new' ? scopeFor(p.scope) : null, when(p.at), p.why || null].filter(Boolean).join(' · ')}
        </span>
      </div>
      {p.kind !== 'retire' && <div>{p.en}</div>}
      {p.kind !== 'retire' && p.es && <div style={{ color: 'var(--text-muted)' }}>{p.es}</div>}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {approver ? (
          <>
            <button type="button" disabled={busy === p.id} onClick={() => void approve(book, p)} style={smallPrimary}>
              {busy === p.id ? 'Approving…' : p.kind === 'edit' && clause ? `Approve · v${clause.v + 1}` : 'Approve'}
            </button>
            <button type="button" onClick={() => setDeclining(p)} style={small}>
              Decline
            </button>
          </>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>waiting on {orWords(approvers)}</span>
        )}
      </div>
    </div>
  )

  const historyView = (card: ClausePaperCard, clauseId: string) => {
    const lines = clauseHistory(card.changes, clauseId, when)
    return (
      <div data-clause-history={clauseId} style={{ display: 'grid', gap: '0.3rem', fontSize: '0.8rem', paddingLeft: '0.6rem', borderLeft: '2px solid var(--border)' }}>
        {lines.length === 0 && <span style={{ color: 'var(--text-muted)' }}>No change since it was first written here.</span>}
        {lines.map((l) => (
          <div key={l.id}>
            <strong>{l.title}</strong> <span style={{ color: 'var(--text-muted)' }}>{l.facts.join(' · ')}</span>
            <div style={{ color: 'var(--text-muted)' }}>{l.words}</div>
          </div>
        ))}
      </div>
    )
  }

  const clauseRow = (card: ClausePaperCard, clause: Clause, n: number | null) => {
    const waiting = card.waiting.filter((p) => p.clauseId === clause.id)
    const retired = clause.retiredAt != null
    return (
      <div key={`${clause.id}-${n ?? 'r'}`} data-clause-row={clause.id} style={{ display: 'grid', gap: '0.35rem', padding: '0.35rem 0', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6rem 1fr auto', gap: '0.5rem', alignItems: 'start' }}>
          <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{n ?? '–'}</span>
          <div style={{ minWidth: 0 }}>
            <div>{clause.en}</div>
            {clause.es && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{clause.es}</div>}
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.25rem', alignItems: 'center' }}>
              {scopeWords(clause.scope).map((w) => (
                <span key={w} style={pill(clause.scope === 'all')}>
                  {w}
                </span>
              ))}
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>v{clause.v}</span>
              {retired && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>retired {when(clause.retiredAt ?? '')}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {!retired && (
              <>
                <button type="button" onClick={() => setEditing({ mode: 'edit', book: card.book, clause })} style={small}>
                  Edit
                </button>
                <button type="button" onClick={() => setEditing({ mode: 'retire', book: card.book, clause })} style={small}>
                  Retire
                </button>
              </>
            )}
            <button type="button" aria-expanded={historyOf === clause.id} onClick={() => setHistoryOf(historyOf === clause.id ? null : clause.id)} style={small}>
              History
            </button>
          </div>
        </div>
        {waiting.map((p) => proposalView(card.book, p, clause))}
        {historyOf === clause.id && historyView(card, clause.id)}
      </div>
    )
  }

  const paperCard = (card: ClausePaperCard) => {
    const view = settingsView(card.book.clauses)
    const live = view.base.length + new Set(view.exhibits.flatMap((x) => x.rows.map((r) => r.clause.id))).size
    const news = card.waiting.filter((p) => p.kind === 'new')
    const { paper } = card.book
    return (
      <section key={paper.id} id={clausePaperAnchor(paper.id)} data-clause-paper-card={paper.id} style={cardStyle}>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '1rem' }}>{paper.title}</strong>
          {card.packet && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{card.packet}</span>}
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {paper.revision > 0 ? `Version ${paper.revision}` : 'Not published yet'} · {live} {live === 1 ? 'clause' : 'clauses'}
          </span>
          {card.waiting.length > 0 && <strong style={{ color: 'var(--text-amber-800)', fontSize: '0.8rem' }}>{card.waiting.length} waiting on approval</strong>}
          <span style={{ flex: 1 }} />
          <button type="button" onClick={() => setPreviewing(card.book)} style={small}>
            Preview per trade
          </button>
          <button type="button" onClick={() => setEditing({ mode: 'new', book: card.book, clause: null })} style={small}>
            + a clause
          </button>
        </div>
        <div style={sectionHead}>Everyone</div>
        {view.base.length === 0 ? <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>None yet.</div> : view.base.map((r) => clauseRow(card, r.clause, r.n))}
        <div style={sectionHead}>The trade exhibits</div>
        {view.exhibits.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>None yet. A clause for a trade lands here.</div>
        ) : (
          view.exhibits.map((x) => (
            <div key={x.trade} data-clause-exhibit={x.trade} style={{ display: 'grid' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '0.2rem' }}>Exhibit for {x.trade}</div>
              {x.rows.map((r) => clauseRow(card, r.clause, r.n))}
            </div>
          ))
        )}
        {news.length > 0 && <div style={{ display: 'grid', gap: '0.4rem' }}>{news.map((p) => proposalView(card.book, p, null))}</div>}
        {view.retired.length > 0 && (
          <details>
            <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Retired ({view.retired.length})</summary>
            {view.retired.map((c) => clauseRow(card, c, null))}
          </details>
        )}
      </section>
    )
  }

  return (
    <div data-settings-clauses style={{ display: 'grid', gap: '0.9rem' }}>
      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5 }}>
        A contract here is an ordered set of clauses. A clause applies to everyone, or to the trades named on it. A clause for a trade goes on that trade&apos;s exhibit. The paper a company signs is put
        together when it goes. A signed copy keeps the words and each clause&apos;s version.
      </p>
      <p data-clause-role style={{ margin: 0, fontSize: '0.85rem' }}>
        {approver
          ? `Signed in as ${profileName ?? 'you'}, who may approve. Your changes go out at once.`
          : `Signed in as ${profileName ?? 'you'}. A controller or a dev approves your changes before they go out.`}
      </p>
      {problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
          {problem}
        </div>
      )}
      {!lib && !problem && <div style={{ color: 'var(--text-muted)' }}>Loading the clauses…</div>}
      {lib && cards.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>No paper is built from clauses yet. Pick one from the library below to start.</div>}
      {cards.map(paperCard)}
      {lib && (
        <div data-clause-build style={{ ...cardStyle, gap: '0.4rem' }}>
          <strong style={{ fontSize: '0.9rem' }}>Build a paper from clauses</strong>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Pick a document from the Contract library. Its first clause goes through the same steps as any other.</span>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <select aria-label="A document from the library" value={buildId} onChange={(e) => setBuildId(e.target.value)} style={{ ...clauseInputStyle, width: 'auto', flex: '1 1 260px' }}>
              <option value="">{buildable.length ? 'Pick a document' : 'Every document is built from clauses or is a form'}</option>
              {buildable.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
            <button type="button" disabled={!buildId} onClick={startBuild} style={clausePrimaryStyle}>
              Write its first clause
            </button>
          </div>
        </div>
      )}
      {editing && lib && (
        <ClauseEditWindow
          mode={editing.mode}
          book={editing.book}
          clause={editing.clause}
          trades={trades}
          approvers={approvers}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            setBuildId('')
            void load()
          }}
        />
      )}
      {previewing && lib && <ClausePreviewWindow book={previewing} companies={lib.companies} onClose={() => setPreviewing(null)} />}
      {declining && (
        <ClauseDeclineWindow
          proposalId={declining.id}
          by={declining.by}
          onClose={() => setDeclining(null)}
          onDone={() => {
            setDeclining(null)
            void load()
          }}
        />
      )}
    </div>
  )
}
