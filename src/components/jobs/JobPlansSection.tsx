/**
 * The job window's Documents tab Plans section (punch list #239, PR 2): what the job builds from today, the older
 * sets under it, our as-builts, and the presses that add a set or an as-built. A job outside any development owns
 * its own part, made with its first set; a job inside a development names one of the site's parts, or makes one
 * named after itself. When another part of the site carries a set, a notice says so (the owner, 2026-11-01), with
 * a door to the site's Plans look. The job's old plans link follows the current set by the database's own mirror,
 * so *Open plans* on the Job tab opens the new set the moment the part switches. A set or as-built added with no
 * link gets its own folder under the job's Plans folder in Drive (punch list #239, PR 5, `plan-set-files`), and the
 * crew's as-built takes photos or a PDF, filed one by one past any that fails. A file that fails stays with its reason
 * and files again into the same set; an as-built takes more files later, and a set with no link can still make its
 * folder, so a job whose Drive folder comes tomorrow never needs a second row.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { formatErrorMessage } from '../../utils/errorHandling'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import {
  asBuiltLineWords,
  buildJobPlansView,
  buildingFromLine,
  defaultAsBuiltName,
  defaultSetName,
  emptyNewSetDraft,
  jobShortLabel,
  newSetDraftProblem,
  otherPlansNotice,
  partNameForJob,
  partTimeline,
  setLineWords,
  timelineEntryFor,
  todayYmd,
  type NewSetDraft,
  type PlanSetKind,
  type PlanSetRow,
} from '../../lib/plans/planSets'
import { supabaseJobPlansIo, type JobPlansIo, type JobPlansRead } from '../../lib/plans/planSetsIo'
import { AS_BUILT_ACCEPT, PLAN_SET_FILES_WORDS, asBuiltFileName, fileAgainLabel, filedWords, filingWords, heldBehindLine, splitReadyFiles } from '../../lib/plans/planSetFiles'
import { supabasePlanSetFilesIo, type PlanSetFilesIo } from '../../lib/plans/planSetFilesIo'
import type { BatchOutcome } from '../../lib/batchWords'
import { EmptyState } from '../EmptyState'
import { JobPapersSection } from '../papers/JobPapersSection'
import { PlanSetForm } from '../plans/PlanSetForm'
import { PlanSetChangesLine } from '../plans/PlanSetChangesLine'
import { documentsHeading, documentsQuietButton } from './jobDocumentsStyles'

const OFFICE: ReadonlySet<string> = new Set(['dev', 'master_technician', 'assistant', 'controller', 'estimator'])

const line: CSSProperties = { fontSize: '0.875rem', color: 'var(--text-700)', margin: 0 }
const muted: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }
const linkBtn: CSSProperties = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontSize: '0.875rem', color: 'var(--text-link)', fontWeight: 600 }
const smallLinkBtn: CSSProperties = { ...linkBtn, fontSize: '0.8125rem' }
const blueButton: CSSProperties = { ...documentsQuietButton, background: '#2563eb', borderColor: '#2563eb', color: 'white' }
const chip: CSSProperties = { display: 'inline-block', fontSize: '0.7rem', fontWeight: 700, padding: '0 0.45rem', borderRadius: 999, background: 'var(--bg-green-100)', color: 'var(--text-green-700)', marginLeft: '0.4rem', verticalAlign: 'middle' }
const oursChip: CSSProperties = { ...chip, background: 'var(--bg-muted)', color: 'var(--text-700)' }
const notice: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-100)', border: '1px solid var(--border-amber)', borderRadius: 6, padding: '0.45rem 0.6rem', margin: 0 }
const field: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(5.5rem, 7rem) 1fr', gap: '0.3rem 0.6rem', alignItems: 'center', fontSize: '0.8125rem' }
const input: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', padding: '0.3rem 0.45rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', width: '100%', boxSizing: 'border-box' }
const ul: CSSProperties = { margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.35rem' }

type Form = { kind: 'set'; draft: NewSetDraft } | { kind: 'as_built'; draft: NewSetDraft } | { kind: 'part'; name: string; pick: string } | null

/** What a filing came to: what landed, the files that did not with their reasons, the files held back when picked. */
type FiledFiles = {
  setId: string
  outcome: BatchOutcome
  /** Kept, so the press can file them again into the same set. */
  failed: Array<{ file: File; why: string }>
  held: Array<{ name: string; why: string }>
  folderUrl: string | null
}

/** Picks photos or a PDF for a set already on the list, and hands them up. */
function AddFilesPress({ setName, disabled, onPick }: { setName: string; disabled: boolean; onPick: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={AS_BUILT_ACCEPT}
        multiple
        aria-label={`${PLAN_SET_FILES_WORDS.addToSet} to ${setName}`}
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (files.length) onPick(files)
        }}
      />
      <button type="button" style={smallLinkBtn} disabled={disabled} title={PLAN_SET_FILES_WORDS.addToSetTitle} onClick={() => input.current?.click()}>
        {PLAN_SET_FILES_WORDS.addToSet}
      </button>
    </>
  )
}

/** Where the section's read stands: `data-job-documents-plans` carries it, and `onState` reports it. */
export type JobPlansSectionState = 'loading' | 'failed' | 'current' | 'no-current' | 'no-part'

export function JobPlansSection({
  job,
  io: ioProp,
  filesIo = supabasePlanSetFilesIo,
  onPlansLinkChanged,
  onLeave,
  onState,
}: {
  job: { id: string; job_name?: string | null; click_number?: string | null; hcp_number?: string | null }
  io?: JobPlansIo
  /** The set's Drive folder and the files in it; the real one by default, a fake in tests. */
  filesIo?: PlanSetFilesIo
  /** The current set's link, after a press that changed what the job builds from: the window patches its copy of the job. */
  onPlansLinkChanged?: (link: string) => void
  /** Called before the notice's door leaves for the site's page, so the window closes first. */
  onLeave?: () => void
  /** Where the read stands, each time it changes (punch list #276): the crew's window keeps its Open plans row only while no part is read. */
  onState?: (state: JobPlansSectionState) => void
}) {
  const io = useMemo(() => ioProp ?? supabaseJobPlansIo(), [ioProp])
  const { role, user } = useAuth()
  const navigate = useNavigate()
  const canWrite = OFFICE.has(role ?? '')
  const [read, setRead] = useState<JobPlansRead | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [form, setForm] = useState<Form>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [pendingRemove, setPendingRemove] = useState<string | null>(null)
  // The as-built's photos or PDF (PR 5): picked here, filed after the row saves, one by one past any that fails.
  const [asBuiltFiles, setAsBuiltFiles] = useState<File[]>([])
  const [filing, setFiling] = useState<{ done: number; total: number } | null>(null)
  const [filed, setFiled] = useState<FiledFiles | null>(null)

  useEffect(() => {
    let live = true
    setError(null)
    io.read(job.id).then(
      (r) => live && setRead(r),
      (e: unknown) => live && setError(formatErrorMessage(e, 'The plans did not read.')),
    )
    return () => {
      live = false
    }
  }, [io, job.id, tick])

  const view = useMemo(() => buildJobPlansView(read?.part ?? null, read?.sets ?? []), [read])
  const timeline = useMemo(() => partTimeline([...(view.current ? [view.current] : []), ...view.older]), [view])
  const noticeWords = read?.job.development_id ? otherPlansNotice({ developmentName: read.job.development_name, myPartId: read.part?.id ?? null, parts: read.developmentParts }) : null
  const nameOf = (id: string | null) => (id ? (read?.names[id] ?? null) : null)
  const reload = () => setTick((t) => t + 1)

  /** The part the job builds from, made on the first set when the job has none. */
  const partFor = useCallback(
    async (pick: { name: string; pick: string } | null): Promise<string> => {
      if (read?.part) return read.part.id
      if (!read) throw new Error('The plans did not read.')
      if (read.job.development_id && pick?.pick) {
        await io.pickPart(job.id, pick.pick)
        return pick.pick
      }
      const made = await io.makePart({ jobId: job.id, developmentId: read.job.development_id, name: (pick?.name ?? partNameForJob(job)).trim() || partNameForJob(job), userId: user?.id ?? null })
      return made.id
    },
    [io, job, read, user?.id],
  )

  const run = async (act: () => Promise<void>, fallback: string) => {
    if (busy) return
    setBusy(true)
    setProblem(null)
    try {
      await act()
      setForm(null)
      reload()
    } catch (e) {
      setProblem(formatErrorMessage(e, fallback))
    } finally {
      setBusy(false)
    }
  }

  const openSetForm = () => {
    const kind: PlanSetKind = view.current ? 'addendum' : 'issued'
    const draft = emptyNewSetDraft(kind)
    draft.name = defaultSetName(kind, read?.sets ?? [])
    setProblem(null)
    setFiled(null)
    setForm({ kind: 'set', draft })
  }
  const openAsBuiltForm = () => {
    const draft = emptyNewSetDraft('as_built')
    draft.name = defaultAsBuiltName(jobShortLabel(job), todayYmd())
    setProblem(null)
    setFiled(null)
    setAsBuiltFiles([])
    setForm({ kind: 'as_built', draft })
  }
  const openPartForm = () => {
    setProblem(null)
    setForm({ kind: 'part', name: partNameForJob(job), pick: '' })
  }

  /** Up one by one into the set's own folder: a file that fails is named and kept for a second try, the rest still go. */
  const fileInto = async (setId: string, files: File[], held: FiledFiles['held'], folderUrlBefore: string | null = null): Promise<string | null> => {
    const ymd = todayYmd()
    const failed: FiledFiles['failed'] = []
    let folderUrl = folderUrlBefore
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i]!
      setFiling({ done: i, total: files.length })
      try {
        const r = await filesIo.put(setId, file, asBuiltFileName(jobShortLabel(job), ymd, i + 1, files.length, file))
        folderUrl = r.folderUrl
      } catch (e) {
        failed.push({ file, why: formatErrorMessage(e, 'It did not land.') })
      }
    }
    setFiling(null)
    setFiled({ setId, outcome: filedWords(files.length - failed.length, failed.length), failed, held, folderUrl })
    return folderUrl
  }

  const heldOf = (held: ReadonlyArray<{ file: File; why: string }>): FiledFiles['held'] => held.map((h) => ({ name: h.file.name, why: h.why }))

  const addSet = (draft: NewSetDraft, makeCurrent: boolean) =>
    run(async () => {
      const p = newSetDraftProblem(draft)
      if (p) throw new Error(p)
      const partId = await partFor(null)
      const made = await io.addSet({
        partId,
        draft,
        makeCurrent,
        replacesSetId: makeCurrent && view.current ? view.current.id : null,
        marksUpSetId: draft.kind === 'as_built' ? (view.current?.id ?? null) : null,
        jobId: draft.kind === 'as_built' ? job.id : null,
        userId: user?.id ?? null,
      })
      let link = made.link
      const picked = splitReadyFiles(draft.kind === 'as_built' ? asBuiltFiles : [])
      const held = heldOf(picked.held)
      if (picked.ready.length) {
        const folderUrl = await fileInto(made.id, picked.ready, held)
        if (folderUrl && !link) link = folderUrl
      } else {
        let folderUrl: string | null = null
        let folderProblem: string | null = null
        // A set with no link gets its own folder under Plans; the register mirrors Drive. A hold here is said, not fatal.
        if (!draft.link.trim()) {
          try {
            folderUrl = (await filesIo.folder(made.id)).url
            link = folderUrl
          } catch (e) {
            folderProblem = formatErrorMessage(e, 'The set’s folder was not made.')
          }
        }
        if (folderProblem) setFiled({ setId: made.id, outcome: { line: folderProblem, head: null, tone: 'warning' }, failed: [], held, folderUrl: null })
        else if (held.length) setFiled({ setId: made.id, outcome: filedWords(0, 0), failed: [], held, folderUrl })
      }
      setAsBuiltFiles([])
      if (makeCurrent && link) onPlansLinkChanged?.(link)
    }, 'The set did not save.')

  /** The press on a filing that left files behind: only those, into the same set, never a second row. */
  const fileAgain = () => {
    if (!filed || filed.failed.length === 0) return
    const { setId, failed, held, folderUrl } = filed
    void run(async () => {
      await fileInto(
        setId,
        failed.map((f) => f.file),
        held,
        folderUrl,
      )
    }, 'The files did not land.')
  }

  /** More photos or a PDF for an as-built already on the list. */
  const addFilesTo = (setId: string, files: File[]) => {
    const picked = splitReadyFiles(files)
    const held = heldOf(picked.held)
    setFiled(null)
    void run(async () => {
      if (picked.ready.length) await fileInto(setId, picked.ready, held)
      else setFiled({ setId, outcome: filedWords(0, 0), failed: [], held, folderUrl: null })
    }, 'The files did not land.')
  }

  /** A set still with no link: its own folder now, as when the job's Drive folder came after the set. */
  const makeFolder = (s: PlanSetRow, current: boolean) =>
    run(async () => {
      const f = await filesIo.folder(s.id)
      if (current) onPlansLinkChanged?.(f.url)
    }, 'The set’s folder was not made.')

  const makeFolderPress = (s: PlanSetRow, current: boolean) =>
    canWrite ? (
      <button type="button" style={smallLinkBtn} disabled={busy} title={PLAN_SET_FILES_WORDS.makeFolderTitle} onClick={() => void makeFolder(s, current)}>
        {PLAN_SET_FILES_WORDS.makeFolder}
      </button>
    ) : null

  const buildFrom = (s: PlanSetRow) =>
    run(async () => {
      if (!view.part) return
      await io.makeCurrent(view.part.id, s.id, user?.id ?? null)
      if (s.link) onPlansLinkChanged?.(s.link)
    }, 'The set did not switch.')

  const remove = (s: PlanSetRow) =>
    run(async () => {
      await io.removeSet(s.id)
      setPendingRemove(null)
      if (filed?.setId === s.id) setFiled(null)
    }, 'The set did not come off.')

  /** The change line written on a set already on the part; true when it took, so the editor closes. */
  const saveChanges = async (setId: string, changes: string): Promise<boolean> => {
    let ok = false
    await run(async () => {
      await io.updateChanges(setId, changes)
      ok = true
    }, 'What changed did not save.')
    return ok
  }

  const goToSite = () => {
    if (!read?.job.development_id) return
    onLeave?.()
    navigate(`/developments/${read.job.development_id}`)
  }

  const setRow = (s: PlanSetRow, current: boolean) => (
    <li key={s.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.25rem 0.6rem' }}>
      <span style={{ fontSize: '0.875rem', fontWeight: current ? 700 : 500 }}>
        {s.name}
        {current ? <span style={chip}>building from</span> : null}
        {s.source === 'ours' && !current ? <span style={oursChip}>ours</span> : null}
      </span>
      <span style={{ ...muted }}>{setLineWords(s)}</span>
      {s.memo ? <span style={{ ...muted, flexBasis: '100%' }}>{s.memo}</span> : null}
      <PlanSetChangesLine entry={timelineEntryFor(timeline, s)} canWrite={canWrite} busy={busy} onSave={saveChanges} style={{ flexBasis: '100%' }} />
      <span style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        {s.link ? (
          <button type="button" style={smallLinkBtn} onClick={() => openInExternalBrowser(s.link)}>
            Open ↗
          </button>
        ) : (
          <>
            <span style={muted}>link still to come</span>
            {makeFolderPress(s, current)}
          </>
        )}
        {canWrite && !current ? (
          <button type="button" style={smallLinkBtn} disabled={busy} onClick={() => void buildFrom(s)}>
            Build from this set
          </button>
        ) : null}
        {canWrite || (s.kind === 'as_built' && s.created_by && s.created_by === user?.id) ? (
          pendingRemove === s.id ? (
            <>
              <button type="button" style={{ ...smallLinkBtn, color: 'var(--text-red-700)' }} disabled={busy} onClick={() => void remove(s)}>
                Remove
              </button>
              <button type="button" style={smallLinkBtn} disabled={busy} onClick={() => setPendingRemove(null)}>
                Keep
              </button>
            </>
          ) : (
            <button type="button" style={smallLinkBtn} aria-label={`Remove ${s.name}`} disabled={busy} onClick={() => setPendingRemove(s.id)}>
              ×
            </button>
          )
        ) : null}
      </span>
    </li>
  )

  const setForm_ = (f: { kind: 'set' | 'as_built'; draft: NewSetDraft }) => (
    <PlanSetForm
      mode={f.kind}
      draft={f.draft}
      onChange={(d) => setForm({ ...f, draft: d })}
      existing={read?.sets ?? []}
      current={view.current}
      busy={busy}
      problem={problem}
      onAdd={(makeCurrent) => void addSet(f.draft, makeCurrent)}
      onCancel={() => setForm(null)}
      {...(f.kind === 'as_built' ? { files: asBuiltFiles, onFiles: setAsBuiltFiles, filing } : {})}
    />
  )

  const partForm = (f: { kind: 'part'; name: string; pick: string }) => (
    <div style={{ display: 'grid', gap: '0.4rem', padding: '0.6rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-muted)' }} data-testid="job-plans-part-form">
      {read && read.developmentParts.length > 0 ? (
        <label style={field}>
          <span>Part of the site</span>
          <select style={input} value={f.pick} onChange={(e) => setForm({ ...f, pick: e.target.value })}>
            <option value="">A new part, named below</option>
            {read.developmentParts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {f.pick ? null : (
        <label style={field}>
          <span>New part</span>
          <input style={input} value={f.name} onChange={(e) => setForm({ ...f, name: e.target.value })} />
        </label>
      )}
      {problem ? <p style={{ ...muted, color: 'var(--text-amber-800)' }}>{problem}</p> : null}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" style={blueButton} disabled={busy} onClick={() => void run(() => partFor(f).then(() => undefined), 'The part did not save.')}>
          {f.pick ? 'Build from this part' : 'Make the part'}
        </button>
        <button type="button" style={documentsQuietButton} disabled={busy} onClick={() => setForm(null)}>
          Cancel
        </button>
      </div>
    </div>
  )

  const state: JobPlansSectionState = !read && !error ? 'loading' : error ? 'failed' : view.current ? 'current' : view.part ? 'no-current' : 'no-part'
  useEffect(() => {
    onState?.(state)
  }, [state, onState])
  // Green only when nothing stayed behind: a held file is a word the person still has to act on.
  const filedTone = filed?.outcome.tone === 'success' && filed.held.length > 0 ? 'warning' : filed?.outcome.tone

  return (
    <section aria-labelledby="job-documents-plans" data-job-documents-plans={state} style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <h3 id="job-documents-plans" style={{ ...documentsHeading, flex: 1 }}>
          Plans
        </h3>
        {read && canWrite ? (
          <button type="button" style={documentsQuietButton} disabled={busy} onClick={openSetForm}>
            + New set
          </button>
        ) : null}
        {read && (view.part || !read.job.development_id) ? (
          <button type="button" style={documentsQuietButton} disabled={busy} onClick={openAsBuiltForm}>
            Add our as-built
          </button>
        ) : null}
      </div>
      {noticeWords ? (
        <p style={notice} data-testid="job-plans-other-plans">
          {noticeWords}{' '}
          <button type="button" style={{ ...smallLinkBtn, color: 'inherit', textDecoration: 'underline' }} onClick={goToSite}>
            Open the site’s plans ›
          </button>
        </p>
      ) : null}
      {error ? (
        <p style={{ ...muted, color: 'var(--text-amber-800)' }}>
          {error}{' '}
          <button type="button" style={smallLinkBtn} onClick={reload}>
            Try again
          </button>
        </p>
      ) : !read ? (
        <p style={muted}>Reading the plans…</p>
      ) : (
        <>
          {read.job.development_id && !read.part && form?.kind !== 'part' ? (
            <p style={line}>
              This job is in {read.job.development_name?.trim() || 'a development'} and names no part of the site yet.{' '}
              {canWrite ? (
                <button type="button" style={linkBtn} onClick={openPartForm}>
                  Pick the part it builds from
                </button>
              ) : null}
            </p>
          ) : null}
          {view.current ? (
            <div>
              <p style={line}>
                <strong>Building from:</strong> {view.current.name} <span style={muted}>· {setLineWords(view.current)}</span>{' '}
                {view.current.link ? (
                  <button type="button" style={linkBtn} onClick={() => openInExternalBrowser(view.current!.link)}>
                    Open ↗
                  </button>
                ) : (
                  <>
                    <span style={muted}>· link still to come</span> {makeFolderPress(view.current, true)}
                  </>
                )}
              </p>
              {view.current.memo ? <p style={muted}>{view.current.memo}</p> : null}
              <PlanSetChangesLine entry={timelineEntryFor(timeline, view.current)} canWrite={canWrite} busy={busy} onSave={saveChanges} style={{ display: 'flex' }} />
              {buildingFromLine(view, nameOf(view.part?.current_set_by ?? null)) ? <p style={muted}>{buildingFromLine(view, nameOf(view.part?.current_set_by ?? null))}</p> : null}
            </div>
          ) : view.part && view.older.length > 0 ? (
            <p style={line}>Pick the set this job builds from: press Build from this set on one below.</p>
          ) : form ? null : (
            <EmptyState
              compact
              main="No set of plans is on this job yet."
              {...(canWrite ? { next: { label: '+ New set', onPress: openSetForm }, tail: 'adds the set the job builds from.' } : { tail: 'The office adds the set the job builds from.' })}
            />
          )}
          {view.older.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.25rem' }}>
              <p style={{ ...muted, fontWeight: 600 }}>Older sets</p>
              <ul style={ul}>{view.older.map((s) => setRow(s, false))}</ul>
            </div>
          ) : null}
          {view.asBuilts.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.25rem' }}>
              <p style={{ ...muted, fontWeight: 600 }}>Our as-builts</p>
              <ul style={ul}>
                {view.asBuilts.map((s) => (
                  <li key={s.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.25rem 0.6rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{s.name}</span>
                    <span style={muted}>{asBuiltLineWords(s, nameOf(s.created_by), read.sets)}</span>
                    {s.memo ? <span style={{ ...muted, flexBasis: '100%' }}>{s.memo}</span> : null}
                    <span style={{ display: 'flex', gap: '0.6rem' }}>
                      {s.link ? (
                        <button type="button" style={smallLinkBtn} onClick={() => openInExternalBrowser(s.link)}>
                          Open ↗
                        </button>
                      ) : (
                        <span style={muted}>link still to come</span>
                      )}
                      {canWrite || (s.created_by && s.created_by === user?.id) ? <AddFilesPress setName={s.name} disabled={busy} onPick={(files) => addFilesTo(s.id, files)} /> : null}
                      {canWrite || (s.created_by && s.created_by === user?.id) ? (
                        pendingRemove === s.id ? (
                          <>
                            <button type="button" style={{ ...smallLinkBtn, color: 'var(--text-red-700)' }} disabled={busy} onClick={() => void remove(s)}>
                              Remove
                            </button>
                            <button type="button" style={smallLinkBtn} disabled={busy} onClick={() => setPendingRemove(null)}>
                              Keep
                            </button>
                          </>
                        ) : (
                          <button type="button" style={smallLinkBtn} aria-label={`Remove ${s.name}`} disabled={busy} onClick={() => setPendingRemove(s.id)}>
                            ×
                          </button>
                        )
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {form?.kind === 'set' || form?.kind === 'as_built' ? setForm_(form) : form?.kind === 'part' ? partForm(form) : null}
          {view.part ? (
            <JobPapersSection
              io={io}
              partId={view.part.id}
              partName={view.part.name}
              sets={read.sets}
              currentSetId={view.part.current_set_id}
              jobId={job.id}
              jobLabel={jobShortLabel(job)}
              developmentId={read.job.development_id}
              siteName={read.job.development_name?.trim() || jobShortLabel(job)}
              userId={user?.id ?? null}
              canWrite
            />
          ) : null}
          {problem && !form ? <p style={{ ...muted, color: 'var(--text-amber-800)' }}>{problem}</p> : null}
          {filing && form?.kind !== 'as_built' ? <p style={muted}>{filingWords(filing.done, filing.total)}</p> : null}
          {filed ? (
            <div data-testid="job-plans-filed" data-tone={filedTone} style={{ ...muted, color: filedTone === 'success' ? 'var(--text-green-700)' : 'var(--text-amber-800)', display: 'grid', gap: '0.2rem' }}>
              <span>
                {filed.outcome.line}{' '}
                {filed.folderUrl ? (
                  <button type="button" style={smallLinkBtn} onClick={() => openInExternalBrowser(filed.folderUrl!)}>
                    Open the folder ↗
                  </button>
                ) : null}
              </span>
              {filed.outcome.head ? <span>{filed.outcome.head}</span> : null}
              {filed.failed.map((f, i) => (
                <span key={`${f.file.name}-${i}`}>
                  {f.file.name} · {f.why}
                </span>
              ))}
              {filed.failed.length > 0 ? (
                <span>
                  <button type="button" style={smallLinkBtn} disabled={busy} onClick={fileAgain}>
                    {fileAgainLabel(filed.failed.length)}
                  </button>
                </span>
              ) : null}
              {filed.held.map((h, i) => (
                <span key={`${h.name}-${i}`}>{heldBehindLine(h.name, h.why)}</span>
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}

export default JobPlansSection
