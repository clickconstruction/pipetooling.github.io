import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { FlowKind } from '../../../lib/flows/facts'
import { emptyDraft, KIND_CARDS, newPaperDoneWhen, newPaperProblems, savedWords, type NewPaperDraft, type SavedPaper } from '../../../lib/flows/newPaper'
import { saveFlowPaper } from '../../../lib/flows/newPaperIo'
import { formatErrorMessage } from '../../../utils/errorHandling'

/**
 * A new paper (Messages cut 4, the prototype's v1.177), opened from the flow editor's paper picker (Settings → Flows,
 * helper 5's): the kind first, then what that kind needs. An upload has a name and maybe a date it runs out; a contract
 * has its clauses in both languages, published by a dev or a controller and proposed by anyone else; a notice has its
 * words in both languages. Saving makes a Contract library document (`flow_paper_create`) whose id is the step's new
 * paper, and hands the editor that paper with the one fact that finishes the step (`onSaved`).
 */

const FLOW_WORDS: Record<Exclude<FlowKind, 'unknown'>, string> = { trade: 'the trade partner flow', customer: 'the customer flow', arch: 'the architect flow' }

const label: CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }
const field: CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '0.35rem 0.5rem', background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.875rem' }
const note: CSSProperties = { fontSize: '0.8rem', color: 'var(--text-muted)' }
const btn = (primary: boolean): CSSProperties => ({
  border: `1px solid ${primary ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
  background: primary ? 'var(--text-blue-500)' : 'var(--surface)',
  color: primary ? 'var(--surface)' : 'var(--text-700)',
  borderRadius: 8,
  padding: '0.35rem 0.85rem',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: '0.85rem',
})

export function GcNewPaperWindow({
  flowKind,
  step,
  trades = [],
  onClose,
  onSaved,
}: {
  flowKind: Exclude<FlowKind, 'unknown'>
  /** The step the paper turns on. */
  step: { id: string; name: string }
  /** The trades a contract's clause can be kept to, for its exhibit. */
  trades?: readonly string[]
  onClose: () => void
  /** The paper made: put its id on the step's papers and its one fact on the step's facts. */
  onSaved: (paper: SavedPaper) => void
}) {
  const [d, setD] = useState<NewPaperDraft>(emptyDraft)
  const [shown, setShown] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const set = (over: Partial<NewPaperDraft>) => setD((was) => ({ ...was, ...over }))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const save = async () => {
    const problems = newPaperProblems(d)
    setShown(problems)
    if (problems.length || !d.kind || saving) return
    setSaving(true)
    setProblem(null)
    try {
      const saved = await saveFlowPaper(flowKind, { ...d, kind: d.kind })
      setDone(savedWords(saved, step.name, saved.clauses, saved.told))
      onSaved(saved)
    } catch (e) {
      setProblem(formatErrorMessage(e, 'The paper was not added.'))
    } finally {
      setSaving(false)
    }
  }

  const names = (placeholder: string, placeholderEs: string) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem' }}>
      <label>
        <span style={label}>What it is called</span>
        <input style={field} value={d.name} placeholder={placeholder} onChange={(e) => set({ name: e.target.value })} />
      </label>
      <label>
        <span style={label}>In Spanish</span>
        <input style={field} value={d.nameEs} placeholder={placeholderEs} onChange={(e) => set({ nameEs: e.target.value })} />
      </label>
    </div>
  )

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(0.75rem + var(--app-top-chrome, 0px)) 0.75rem 0.75rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="A new paper"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(760px, 100%)', maxHeight: 'min(92vh, 100%)', overflowY: 'auto', border: '1px solid var(--border-strong)', padding: '1rem', display: 'grid', gap: '0.75rem' }}
      >
        <div>
          <strong style={{ fontSize: '1.1rem' }}>A new paper</strong>
          <div style={note}>
            Turns on <b>{step.name}</b> in {FLOW_WORDS[flowKind]}.
          </div>
        </div>

        <div role="group" aria-label="What kind of paper?" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.5rem' }}>
          {KIND_CARDS.map((c) => (
            <button
              key={c.kind}
              type="button"
              aria-pressed={d.kind === c.kind}
              onClick={() => set({ kind: c.kind })}
              style={{
                textAlign: 'left',
                border: `1px solid ${d.kind === c.kind ? 'var(--text-blue-500)' : 'var(--border)'}`,
                background: d.kind === c.kind ? 'var(--bg-blue-tint)' : 'var(--surface)',
                borderRadius: 10,
                padding: '0.55rem 0.7rem',
                cursor: 'pointer',
                font: 'inherit',
                color: 'inherit',
              }}
            >
              <b style={{ display: 'block', fontSize: '0.875rem' }}>{c.title}</b>
              <span style={note}>{c.words}</span>
            </button>
          ))}
        </div>

        {d.kind === 'upload' && (
          <>
            {names('their bond, their safety plan', 'su fianza')}
            <label>
              <span style={label}>Does it run out?</span>
              <select style={{ ...field, width: 'auto' }} value={d.runsOut ? 'yes' : 'no'} onChange={(e) => set({ runsOut: e.target.value === 'yes' })}>
                <option value="no">No</option>
                <option value="yes">Yes, it has a date on it</option>
              </select>
            </label>
            {d.runsOut && (
              <label style={note}>
                Ask for the next one{' '}
                <input type="number" min={1} max={365} value={d.renewAskDays} onChange={(e) => set({ renewAskDays: Number(e.target.value) })} style={{ ...field, width: 72, display: 'inline-block' }} aria-label="Days before it runs out" />{' '}
                days before it runs out.
              </label>
            )}
          </>
        )}

        {d.kind === 'contract' && (
          <>
            {names('the safety agreement, the warranty', 'el acuerdo de seguridad')}
            <div>
              <span style={label}>Clauses</span>
              <div style={note}>A clause for everyone is the base. A clause kept to one trade goes on that trade's exhibit, and only that trade sees it.</div>
              {d.clauses.map((c, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.4rem', alignItems: 'start', marginTop: '0.5rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', paddingTop: 6 }}>{i + 1}</span>
                  <div style={{ display: 'grid', gap: '0.3rem' }}>
                    <textarea style={field} rows={2} placeholder="English" aria-label={`Clause ${i + 1} in English`} value={c.en} onChange={(e) => set({ clauses: d.clauses.map((x, j) => (j === i ? { ...x, en: e.target.value } : x)) })} />
                    <textarea style={field} rows={2} placeholder="Spanish. Empty shows the English on the Spanish page." aria-label={`Clause ${i + 1} in Spanish`} value={c.es} onChange={(e) => set({ clauses: d.clauses.map((x, j) => (j === i ? { ...x, es: e.target.value } : x)) })} />
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <select style={{ ...field, width: 'auto' }} aria-label={`Who clause ${i + 1} is for`} value={c.scope[0] ?? 'all'} onChange={(e) => set({ clauses: d.clauses.map((x, j) => (j === i ? { ...x, scope: [e.target.value] } : x)) })}>
                        <option value="all">Everyone</option>
                        {trades.map((t) => (
                          <option key={t} value={t}>
                            {t} only, on its exhibit
                          </option>
                        ))}
                      </select>
                      {d.clauses.length > 1 && (
                        <button type="button" style={{ ...btn(false), padding: '0.2rem 0.5rem' }} aria-label={`Remove clause ${i + 1}`} onClick={() => set({ clauses: d.clauses.filter((_, j) => j !== i) })}>
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" style={{ ...btn(false), marginTop: '0.5rem' }} onClick={() => set({ clauses: [...d.clauses, { en: '', es: '', scope: ['all'] }] })}>
                Add a clause
              </button>
            </div>
            <div style={note}>The e-sign consent is the app's own words on every sign page. It is not edited here.</div>
            <div style={note}>A dev's or a controller's clauses publish as v1. Anyone else's wait for one of them to approve.</div>
          </>
        )}

        {d.kind === 'notice' && (
          <>
            {names('the start letter, the holiday notice', 'la carta de inicio')}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem' }}>
              <label>
                <span style={label}>The words in English</span>
                <textarea style={field} rows={5} placeholder="Dear {person}, …" value={d.bodyEn} onChange={(e) => set({ bodyEn: e.target.value })} />
              </label>
              <label>
                <span style={label}>The words in Spanish</span>
                <textarea style={field} rows={5} placeholder="Estimado {person}, …" value={d.bodyEs} onChange={(e) => set({ bodyEs: e.target.value })} />
              </label>
            </div>
          </>
        )}

        {d.kind && (
          <div>
            <span style={label}>Done when</span>
            <div style={note}>{newPaperDoneWhen(d, step.name)}</div>
          </div>
        )}

        {shown.length > 0 && (
          <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
            {shown.join(' ')}
          </div>
        )}
        {problem && (
          <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
            {problem}
          </div>
        )}
        {done && (
          <div role="status" style={{ fontSize: '0.875rem', background: 'var(--bg-green-tint)', color: 'var(--text-green-700)', borderRadius: 8, padding: '0.45rem 0.65rem' }}>
            {done}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
          <button type="button" style={btn(false)} onClick={onClose}>
            {done ? 'Close' : 'Not now'}
          </button>
          {!done && (
            <button type="button" style={btn(true)} disabled={saving} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
