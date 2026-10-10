import { useState } from 'react'
import type { PipelineJobHit } from '../../lib/gc/gcIo'
import { Btn, input } from './gcUi'

/**
 * GC mode, Owner Billing's O11b: on Our number, the Pipeline job a project's general conditions are spent on (the
 * superintendent's time, the trailer, temporary power), so Money's margin counts what they really cost. The money
 * team names it through `gc_project_money` (`setGcGeneralConditionsJob`). The picker is the Pipeline's own search,
 * billing-only jobs left out; a job a crew trade already holds comes last with its press off, since one job counts
 * once.
 */
export function GcGeneralConditionsJob({
  jobId,
  jobLabel,
  heldBy,
  onName,
  search,
}: {
  jobId: string | null
  /** The named job's number, once read. */
  jobLabel: string | null
  /** Pipeline jobs a trade our own crew does already holds: the trade's words, "Plumbing", by job id. */
  heldBy: Record<string, string>
  onName: (jobId: string | null) => Promise<void>
  search: (text: string) => Promise<PipelineJobHit[]>
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [hits, setHits] = useState<PipelineJobHit[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const run = (f: () => Promise<void>) => {
    setBusy(true)
    setProblem(null)
    f()
      .catch((e: unknown) => setProblem(e instanceof Error ? e.message : 'That did not save.'))
      .finally(() => setBusy(false))
  }
  const find = () =>
    run(async () => {
      const found = await search(text)
      // A job a crew holds comes last.
      setHits([...found.filter((h) => !heldBy[h.id]), ...found.filter((h) => heldBy[h.id])])
    })
  const use = (id: string | null) =>
    run(async () => {
      await onName(id)
      setOpen(false)
      setHits(null)
      setText('')
    })

  return (
    <div data-gc-general-conditions-job style={{ display: 'grid', gap: '0.4rem', fontSize: '0.875rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {jobId ? (
          <>
            <span>
              General conditions are spent on Pipeline job <strong>{jobLabel ?? 'named'}</strong>.
            </span>
            <Btn kind="quiet" disabled={busy} onClick={() => setOpen(!open)}>
              Change
            </Btn>
            <Btn kind="quiet" disabled={busy} onClick={() => use(null)}>
              Let it go
            </Btn>
          </>
        ) : (
          <>
            <span style={{ color: 'var(--text-muted)' }}>Name the Pipeline job general conditions are spent on, so Money counts what they really cost.</span>
            <Btn kind="quiet" disabled={busy} onClick={() => setOpen(!open)}>
              Name the Pipeline job
            </Btn>
          </>
        )}
      </div>
      {open && (
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <input
              aria-label="Find a Pipeline job by its number, name or address"
              placeholder="Its number, name or address"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && text.trim()) find()
              }}
              style={{ ...input, minWidth: '16rem' }}
            />
            <Btn kind="quiet" disabled={busy || !text.trim()} onClick={find}>
              Find
            </Btn>
          </div>
          {hits && hits.length === 0 && <span style={{ color: 'var(--text-muted)' }}>No Pipeline job matches.</span>}
          {hits?.map((h) => (
            <div key={h.id} data-gc-pipeline-job={h.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <strong>{h.label}</strong>
              <span>{h.name}</span>
              <span style={{ color: 'var(--text-muted)' }}>{h.address}</span>
              <span style={{ flex: 1 }} />
              {heldBy[h.id] ? (
                <span style={{ color: 'var(--text-muted)' }}>{`On ${heldBy[h.id]} already`}</span>
              ) : (
                <Btn kind="quiet" disabled={busy || h.id === jobId} onClick={() => use(h.id)}>
                  Use this job
                </Btn>
              )}
            </div>
          ))}
        </div>
      )}
      {problem && <div style={{ color: 'var(--text-red-700)' }}>{problem}</div>}
    </div>
  )
}
