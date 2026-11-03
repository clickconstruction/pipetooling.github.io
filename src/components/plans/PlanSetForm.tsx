/**
 * The one form a new set of plans is typed into (punch list #239): on a job's Documents tab (PR 2) and
 * on the Development page's Plans look (PR 3). Name · Kind · From · Dated · Memo · Link for a set; Name ·
 * Memo · Link for an as-built, which also takes **Photos or a PDF** from the phone or this computer (punch list
 * #239, PR 5): each pick adds to the list, a file over 10 MB or of another kind is held with its reason and the
 * rest still go, and the press names its count. The presses name what they do: *Add the set and build from it*,
 * *Add it, keep <set> current*, *Add the as-built with 3 files*. Pure over its props; the caller writes.
 */
import { useRef, type CSSProperties } from 'react'
import { PLAN_SET_KINDS, PLAN_SET_SOURCES, addSetPressWords, defaultSetName, type NewSetDraft, type PlanSetKind, type PlanSetRow, type PlanSetSource } from '../../lib/plans/planSets'
import { AS_BUILT_ACCEPT, PLAN_SET_FILES_WORDS, addPickedFiles, asBuiltPressWords, filingWords, pickedFilesWords, splitReadyFiles } from '../../lib/plans/planSetFiles'
import { addFileSizeWords } from '../../lib/jobs/jobFolderAddFile'

import { changesPlaceholder } from '../../lib/plans/planSets'

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
  files,
  onFiles,
  filing,
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
  /** The as-built's photos or PDF, picked on this device; the caller files them after the row saves. */
  files?: ReadonlyArray<File>
  onFiles?: (files: File[]) => void
  /** While the caller files them: which one is going. */
  filing?: { done: number; total: number } | null
}) {
  const put = (patch: Partial<NewSetDraft>) => onChange({ ...draft, ...patch })
  const words = addSetPressWords(current)
  const asBuilt = mode === 'as_built'
  const fileInput = useRef<HTMLInputElement>(null)
  const picked = files ?? []
  const split = splitReadyFiles(picked)
  const asBuiltWords = asBuiltPressWords(split.ready.length, split.held.length)
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
          <label style={{ ...field, alignItems: 'start' }}>
            <span>What changed</span>
            <textarea style={{ ...input, minHeight: '3.4rem', resize: 'vertical' }} rows={2} value={draft.changes ?? ''} placeholder={changesPlaceholder(current)} onChange={(e) => put({ changes: e.target.value })} data-testid="plan-set-changes" />
          </label>
        </>
      )}
      <label style={field}>
        <span>Memo</span>
        <input style={input} value={draft.memo} placeholder={asBuilt ? 'What the crew changed, in a line' : 'Who sent it, when, and where the file is'} onChange={(e) => put({ memo: e.target.value })} />
      </label>
      {asBuilt && onFiles ? (
        <div style={field} data-testid="job-plans-as-built-files">
          <span>Files</span>
          <div style={{ display: 'grid', gap: '0.3rem' }}>
            <input
              ref={fileInput}
              type="file"
              accept={AS_BUILT_ACCEPT}
              multiple
              aria-label={PLAN_SET_FILES_WORDS.pick}
              style={{ display: 'none' }}
              onChange={(e) => {
                onFiles(addPickedFiles(picked, Array.from(e.target.files ?? [])))
                e.target.value = ''
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" style={quiet} disabled={busy} title={PLAN_SET_FILES_WORDS.pickTitle} onClick={() => fileInput.current?.click()}>
                {picked.length ? PLAN_SET_FILES_WORDS.change : PLAN_SET_FILES_WORDS.pick}
              </button>
              {picked.length ? (
                <>
                  <span style={muted}>{pickedFilesWords(picked)}</span>
                  <button type="button" style={{ ...quiet, border: 'none', background: 'none', color: 'var(--text-link)', padding: 0 }} disabled={busy} onClick={() => onFiles([])}>
                    {PLAN_SET_FILES_WORDS.clear}
                  </button>
                </>
              ) : null}
            </div>
            {split.held.length ? (
              <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.8125rem', color: 'var(--text-amber-800)' }} data-testid="job-plans-as-built-held">
                {split.held.map((h, i) => (
                  <li key={`${h.file.name}-${i}`}>
                    {h.file.name} · {addFileSizeWords(h.file.size)} · {h.why}
                  </li>
                ))}
              </ul>
            ) : null}
            {filing ? <p style={muted}>{filingWords(filing.done, filing.total)}</p> : null}
          </div>
        </div>
      ) : null}
      <label style={field}>
        <span>Link</span>
        <input style={input} value={draft.link} placeholder={asBuilt && onFiles ? 'A Drive link instead of files, or leave it empty: the as-built gets its own folder' : 'A Drive folder or file link, or leave it empty for now'} onChange={(e) => put({ link: e.target.value })} />
      </label>
      {problem ? <p style={{ ...muted, color: 'var(--text-amber-800)' }}>{problem}</p> : null}
      {asBuilt && asBuiltWords.foot ? <p style={{ ...muted, color: 'var(--text-amber-800)' }}>{asBuiltWords.foot}</p> : null}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {asBuilt ? (
          <button type="button" style={blue} disabled={busy || asBuiltWords.dead} onClick={() => onAdd(false)}>
            {onFiles ? asBuiltWords.button : 'Add the as-built'}
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
