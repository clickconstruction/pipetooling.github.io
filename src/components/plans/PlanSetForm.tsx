/**
 * The one form a new set of plans is typed into (punch list #239): on a job's Documents tab (PR 2) and
 * on the Development page's Plans look (PR 3). Name · Kind · From · Dated · Memo · Link for a set; Name ·
 * Memo · Link for an as-built. The presses name what they do: *Add the set and build from it*, *Add it,
 * keep <set> current*, *Add the as-built*. Pure over its props; the caller writes.
 */
import type { CSSProperties } from 'react'
import { PLAN_SET_KINDS, PLAN_SET_SOURCES, addSetPressWords, defaultSetName, type NewSetDraft, type PlanSetKind, type PlanSetRow, type PlanSetSource } from '../../lib/plans/planSets'

const field: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(5.5rem, 7rem) 1fr', gap: '0.3rem 0.6rem', alignItems: 'center', fontSize: '0.8125rem' }
const input: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', padding: '0.3rem 0.45rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', width: '100%', boxSizing: 'border-box' }
const muted: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }
const quiet: CSSProperties = { padding: '0.3rem 0.7rem', fontSize: '0.8125rem', borderRadius: 4, cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)' }
const blue: CSSProperties = { ...quiet, background: '#2563eb', borderColor: '#2563eb', color: 'white' }

export function PlanSetForm({
  mode,
  draft,
  onChange,
  existing,
  current,
  busy,
  problem,
  onAdd,
  onCancel,
}: {
  mode: 'set' | 'as_built'
  draft: NewSetDraft
  onChange: (next: NewSetDraft) => void
  /** The sets already on the part, so a kind's default name counts on from them. */
  existing: ReadonlyArray<Pick<PlanSetRow, 'name'>>
  /** The set the part builds from today; null with none. */
  current: Pick<PlanSetRow, 'name'> | null
  busy: boolean
  problem: string | null
  /** Add the set; `makeCurrent` is what the press pressed said. */
  onAdd: (makeCurrent: boolean) => void
  onCancel: () => void
}) {
  const put = (patch: Partial<NewSetDraft>) => onChange({ ...draft, ...patch })
  const words = addSetPressWords(current)
  const asBuilt = mode === 'as_built'
  return (
    <div style={{ display: 'grid', gap: '0.4rem', padding: '0.6rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-muted)' }} data-testid={asBuilt ? 'job-plans-as-built-form' : 'job-plans-set-form'}>
      <label style={field}>
        <span>Name</span>
        <input style={input} value={draft.name} onChange={(e) => put({ name: e.target.value })} />
      </label>
      {asBuilt ? null : (
        <>
          <label style={field}>
            <span>Kind</span>
            <select style={input} value={draft.kind} onChange={(e) => put({ kind: e.target.value as PlanSetKind, name: defaultSetName(e.target.value as PlanSetKind, existing) })}>
              {PLAN_SET_KINDS.filter((k) => k.kind !== 'as_built').map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label style={field}>
            <span>From</span>
            <select style={input} value={draft.source} onChange={(e) => put({ source: e.target.value as PlanSetSource })}>
              {PLAN_SET_SOURCES.map((s) => (
                <option key={s.source} value={s.source}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label style={field}>
            <span>Dated</span>
            <input style={input} type="date" value={draft.dated} onChange={(e) => put({ dated: e.target.value })} title="The date printed on the sheets" />
          </label>
        </>
      )}
      <label style={field}>
        <span>Memo</span>
        <input style={input} value={draft.memo} placeholder={asBuilt ? 'What the crew changed, in a line' : 'What changed, in a line'} onChange={(e) => put({ memo: e.target.value })} />
      </label>
      <label style={field}>
        <span>Link</span>
        <input style={input} value={draft.link} placeholder="A Drive folder or file link, or leave it empty for now" onChange={(e) => put({ link: e.target.value })} />
      </label>
      {problem ? <p style={{ ...muted, color: 'var(--text-amber-800)' }}>{problem}</p> : null}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {asBuilt ? (
          <button type="button" style={blue} disabled={busy} onClick={() => onAdd(false)}>
            Add the as-built
          </button>
        ) : (
          <>
            <button type="button" style={blue} disabled={busy} onClick={() => onAdd(true)}>
              {words.makeCurrent}
            </button>
            {words.keep ? (
              <button type="button" style={quiet} disabled={busy} onClick={() => onAdd(false)}>
                {words.keep}
              </button>
            ) : null}
          </>
        )}
        <button type="button" style={quiet} disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
