/**
 * The papers that travel with a part's plans (punch list #239, the papers train), drawn under the Plans section of
 * the job window's Documents tab. Papers sit under the set each goes with, with the question each raised read back
 * from its lane, and an *Owed to us* group for the papers we are waiting on. **Keep a paper** and **We are owed a
 * paper** open the one form, which shows the History line the keep will write. The keep asks the question first when
 * the paper has one, then writes the row; the History line is the database's trigger.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { formatErrorMessage } from '../../utils/errorHandling'
import { PAPER_FROMS, PAPER_KINDS, askChipWords, buildPapersView, emptyPaperDraft, historyLineForPaper, isPaperKind, kindLabel, paperDraftProblem, paperLineWords, papersFromRows, type Paper, type PaperAskLane, type PaperDraft, type PaperFrom, type PaperKind } from '../../lib/papers/papers'
import type { JobPlansIo } from '../../lib/plans/planSetsIo'
import { todayYmd, type PlanSetRow } from '../../lib/plans/planSets'

const muted: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }
const line: CSSProperties = { fontSize: '0.875rem', color: 'var(--text-700)', margin: 0 }
const linkBtn: CSSProperties = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', color: 'var(--text-link)', fontWeight: 600 }
const quiet: CSSProperties = { padding: '0.3rem 0.7rem', fontSize: '0.8125rem', borderRadius: 4, cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)' }
const blue: CSSProperties = { ...quiet, background: '#2563eb', borderColor: '#2563eb', color: 'white' }
const chip: CSSProperties = { display: 'inline-block', fontSize: '0.7rem', fontWeight: 700, padding: '0 0.45rem', borderRadius: 999, background: 'var(--bg-muted)', color: 'var(--text-700)', marginRight: '0.35rem', verticalAlign: 'middle' }
const amberChip: CSSProperties = { ...chip, background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }
const greenChip: CSSProperties = { ...chip, background: 'var(--bg-green-100)', color: 'var(--text-green-700)' }
const field: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(5.5rem, 7rem) 1fr', gap: '0.3rem 0.6rem', alignItems: 'center', fontSize: '0.8125rem' }
const input: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', padding: '0.3rem 0.45rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', width: '100%', boxSizing: 'border-box' }
const hist: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)', borderLeft: '3px solid var(--border)', paddingLeft: '0.5rem', margin: '0.15rem 0 0' }

export function JobPapersSection({
  io,
  partId,
  partName,
  sets,
  currentSetId,
  jobId,
  jobLabel,
  developmentId,
  siteName,
  userId,
  canWrite,
}: {
  io: JobPlansIo
  partId: string
  partName: string
  /** The part's sets, for *goes with* and the names. */
  sets: ReadonlyArray<PlanSetRow>
  currentSetId: string | null
  jobId: string
  jobLabel: string
  developmentId: string | null
  siteName: string
  userId: string | null
  /** The office keeps papers; a crew member on the job may too (the database fences it). */
  canWrite: boolean
}) {
  const [papers, setPapers] = useState<Paper[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [gen, setGen] = useState(0)
  const [form, setForm] = useState<{ owed: boolean; draft: PaperDraft } | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [came, setCame] = useState<{ id: string; link: string } | null>(null)
  const [pendingRemove, setPendingRemove] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setError(null)
    io.readPapers([partId]).then(
      (r) => live && setPapers(papersFromRows(r.rows, r.requests)),
      (e: unknown) => live && setError(formatErrorMessage(e, 'The papers did not read.')),
    )
    return () => {
      live = false
    }
  }, [io, partId, gen])

  const view = useMemo(() => buildPapersView(papers ?? [], partId), [papers, partId])
  const nowMs = Date.now()
  const setName = (id: string | null) => (id ? (sets.find((s) => s.id === id)?.name ?? null) : null)
  const paperName = (id: string | null) => (id ? (papers?.find((p) => p.id === id)?.name ?? null) : null)
  const drawings = sets.filter((s) => s.part_id === partId && s.kind !== 'as_built' && !isPaperKind(s.kind))

  const open = (owed: boolean) => {
    setProblem(null)
    setForm({ owed, draft: { ...emptyPaperDraft(todayYmd(), currentSetId), asks: owed, askLane: 'estimators' } })
  }
  const run = async (act: () => Promise<void>, fallback: string) => {
    if (busy) return
    setBusy(true)
    setProblem(null)
    try {
      await act()
      setForm(null)
      setCame(null)
      setPendingRemove(null)
      setGen((n) => n + 1)
    } catch (e) {
      setProblem(formatErrorMessage(e, fallback))
    } finally {
      setBusy(false)
    }
  }
  const keep = () => {
    if (!form) return
    const p = paperDraftProblem(form.draft, form.owed)
    if (p) {
      setProblem(p)
      return
    }
    void run(() => io.keepPaper({ partId, draft: form.draft, owed: form.owed, jobId, jobLabel, developmentId, siteName, userId }).then(() => undefined), 'The paper did not keep.')
  }

  const row = (p: Paper) => {
    const ask = p.ask ? askChipWords(p.ask, nowMs) : null
    return (
      <li key={p.id} style={{ display: 'grid', gap: 2, padding: '0.3rem 0', borderBottom: '1px solid var(--border)' }} data-testid={`paper-${p.id}`}>
        <span style={{ fontSize: '0.875rem' }}>
          <span style={chip}>{kindLabel(p.kind)}</span>
          <strong>{p.name}</strong> <span style={muted}>· {paperLineWords(p)}</span>{' '}
          {p.link ? (
            <button type="button" style={linkBtn} onClick={() => openInExternalBrowser(p.link)}>
              Open ↗
            </button>
          ) : p.owed ? null : (
            <span style={muted}>· link still to come</span>
          )}
        </span>
        {p.memo ? <span style={muted}>{p.memo}</span> : null}
        {p.replaces_set_id && paperName(p.replaces_set_id) ? <span style={muted}>replaces {paperName(p.replaces_set_id)}</span> : null}
        {p.ask && ask ? (
          <span style={{ fontSize: '0.8125rem' }}>
            <span style={ask.open ? amberChip : greenChip}>{ask.words}</span> {p.ask.words}
            {p.ask.answer ? <span style={muted}> · {p.ask.answer}</span> : null}
          </span>
        ) : null}
        {canWrite ? (
          <span style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
            {p.owed ? (
              came?.id === p.id ? (
                <>
                  <input style={{ ...input, width: '18rem' }} value={came.link} placeholder="the paper’s Drive link" aria-label="The paper's link" onChange={(e) => setCame({ id: p.id, link: e.target.value })} />
                  <button type="button" style={quiet} disabled={busy || !/^https?:\/\//i.test(came.link.trim())} onClick={() => void run(() => io.markPaperCame(p.id, came.link), 'The paper did not mark as come.')}>
                    It came
                  </button>
                  <button type="button" style={linkBtn} onClick={() => setCame(null)}>
                    Cancel
                  </button>
                </>
              ) : (
                <button type="button" style={linkBtn} onClick={() => setCame({ id: p.id, link: '' })}>
                  It came
                </button>
              )
            ) : null}
            {pendingRemove === p.id ? (
              <>
                <button type="button" style={{ ...linkBtn, color: 'var(--text-red-700)' }} disabled={busy} onClick={() => void run(() => io.removeSet(p.id), 'The paper did not come off.')}>
                  Remove
                </button>
                <button type="button" style={linkBtn} onClick={() => setPendingRemove(null)}>
                  Keep
                </button>
              </>
            ) : (
              <button type="button" style={{ ...linkBtn, color: 'var(--text-muted)' }} aria-label={`Remove ${p.name}`} disabled={busy} onClick={() => setPendingRemove(p.id)}>
                ×
              </button>
            )}
          </span>
        ) : null}
      </li>
    )
  }

  const draftLine = form
    ? historyLineForPaper(
        { kind: form.draft.kind, name: form.draft.name || '…', source: form.draft.from, memo: form.draft.memo, owed: form.owed, askWords: form.draft.asks || form.owed ? form.draft.askWords || '…' : null, askLane: form.draft.askLane },
        setName(form.draft.goesWithSetId),
        paperName(form.draft.replacesPaperId),
      )
    : null

  return (
    <div style={{ display: 'grid', gap: '0.45rem', marginTop: '0.4rem' }} data-testid="job-papers-section" data-state={error ? 'failed' : papers ? (view.count || view.owed.length ? 'papers' : 'empty') : 'loading'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>Papers with the plans</span>
        <span style={muted}>
          {papers ? `${view.count} ${view.count === 1 ? 'paper' : 'papers'} on ${partName}` : 'Reading…'}
          {view.openAsks ? ` · ${view.openAsks} waiting on an answer` : ''}
          {view.owed.length ? ` · ${view.owed.length} owed` : ''}
        </span>
        {canWrite ? (
          <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
            <button type="button" style={quiet} disabled={busy} onClick={() => open(false)}>
              Keep a paper
            </button>
            <button type="button" style={quiet} disabled={busy} onClick={() => open(true)}>
              We are owed a paper
            </button>
          </span>
        ) : null}
      </div>
      {error ? (
        <p style={{ ...muted, color: 'var(--text-amber-800)' }}>
          {error}{' '}
          <button type="button" style={linkBtn} onClick={() => setGen((n) => n + 1)}>
            Try again
          </button>
        </p>
      ) : null}
      {papers && view.bySet.length === 0 && view.owed.length === 0 && !form ? (
        <p style={line}>Nothing is kept with {partName}’s plans yet. {canWrite ? 'Keep a paper puts a spec, a schedule or the owner’s list beside the set it goes with.' : 'The office keeps a spec, a schedule or the owner’s list beside the set it goes with.'}</p>
      ) : null}
      {view.bySet.map((g) => (
        <div key={g.setId || 'part'} style={{ display: 'grid', gap: 2 }}>
          <p style={{ ...muted, fontWeight: 600 }}>{g.setId ? `With ${setName(g.setId) ?? 'a set'}${g.setId === currentSetId ? ' · building from' : ''}` : `On ${partName} itself`}</p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>{g.papers.map(row)}</ul>
        </div>
      ))}
      {view.owed.length ? (
        <div style={{ display: 'grid', gap: 2 }}>
          <p style={{ ...muted, fontWeight: 600, color: 'var(--text-amber-800)' }}>Owed to us</p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>{view.owed.map(row)}</ul>
        </div>
      ) : null}
      {problem && !form ? <p style={{ ...muted, color: 'var(--text-amber-800)' }}>{problem}</p> : null}
      {form ? (
        <div style={{ display: 'grid', gap: '0.4rem', padding: '0.6rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-muted)' }} data-testid="paper-form">
          <strong style={{ fontSize: '0.875rem' }}>{form.owed ? 'A paper we are owed' : 'Keep a paper'}</strong>
          <label style={field}>
            <span>Kind</span>
            <select style={input} value={form.draft.kind} onChange={(e) => setForm({ ...form, draft: { ...form.draft, kind: e.target.value as PaperKind } })}>
              {PAPER_KINDS.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label style={field}>
            <span>Name</span>
            <input style={input} value={form.draft.name} onChange={(e) => setForm({ ...form, draft: { ...form.draft, name: e.target.value } })} />
          </label>
          <label style={field}>
            <span>Goes with</span>
            <select style={input} value={form.draft.goesWithSetId ?? ''} onChange={(e) => setForm({ ...form, draft: { ...form.draft, goesWithSetId: e.target.value || null } })}>
              <option value="">{partName} itself</option>
              {drawings.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.id === currentSetId ? ' · building from' : ''}
                </option>
              ))}
            </select>
          </label>
          <label style={field}>
            <span>From</span>
            <select style={input} value={form.draft.from} onChange={(e) => setForm({ ...form, draft: { ...form.draft, from: e.target.value as PaperFrom } })}>
              {PAPER_FROMS.map((f) => (
                <option key={f.from} value={f.from}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label style={field}>
            <span>{form.owed ? 'Asked on' : 'Came'}</span>
            <input style={input} type="date" value={form.draft.cameOn} onChange={(e) => setForm({ ...form, draft: { ...form.draft, cameOn: e.target.value } })} />
          </label>
          <label style={field}>
            <span>Memo</span>
            <input style={input} value={form.draft.memo} placeholder="what it says, in a line" onChange={(e) => setForm({ ...form, draft: { ...form.draft, memo: e.target.value } })} />
          </label>
          {form.owed ? null : (
            <>
              <label style={field}>
                <span>Link</span>
                <input style={input} value={form.draft.link} placeholder="A Drive link, or leave it empty for now" onChange={(e) => setForm({ ...form, draft: { ...form.draft, link: e.target.value } })} />
              </label>
              <label style={field}>
                <span>Replaces</span>
                <select style={input} value={form.draft.replacesPaperId ?? ''} onChange={(e) => setForm({ ...form, draft: { ...form.draft, replacesPaperId: e.target.value || null } })}>
                  <option value="">nothing</option>
                  {(papers ?? [])
                    .filter((p) => !p.owed)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
              <label style={field}>
                <span>Asks us</span>
                <span>
                  <input type="checkbox" checked={form.draft.asks} onChange={(e) => setForm({ ...form, draft: { ...form.draft, asks: e.target.checked } })} /> this paper asks something of us
                </span>
              </label>
            </>
          )}
          {form.draft.asks || form.owed ? (
            <>
              <label style={field}>
                <span>Who answers</span>
                <select style={input} value={form.draft.askLane} onChange={(e) => setForm({ ...form, draft: { ...form.draft, askLane: e.target.value as PaperAskLane } })}>
                  <option value="estimators">The estimators</option>
                  <option value="dispatch">Dispatch</option>
                </select>
              </label>
              <label style={field}>
                <span>{form.owed ? 'Who owes it' : 'The ask'}</span>
                <input style={input} value={form.draft.askWords} placeholder={form.owed ? 'The owner owes the soil report' : 'what it asks, in a line'} onChange={(e) => setForm({ ...form, draft: { ...form.draft, askWords: e.target.value } })} />
              </label>
            </>
          ) : null}
          {draftLine ? <span style={hist}>Will write on the site’s History: {draftLine}</span> : null}
          {problem ? <p style={{ ...muted, color: 'var(--text-amber-800)' }}>{problem}</p> : null}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" style={blue} disabled={busy} onClick={keep}>
              {form.owed ? 'Keep it as owed' : 'Keep the paper'}
            </button>
            <button type="button" style={quiet} disabled={busy} onClick={() => setForm(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
