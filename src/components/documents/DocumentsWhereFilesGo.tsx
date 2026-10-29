/**
 * Documents → Where files go (punch list #211, PR 2, the mock-up `to-dos/where-files-go/mockup.html`): the office sets
 * where a job's files go and how its folder is named, and sees the rest. Three cards left to right: the jobs root with a
 * live write check, how a job's and a bid's folder is named as a pattern of chips with a live example from a real job,
 * and the tree inside with the one choice, up front or as needed. Under them the two presses: the folders for every live
 * job without one (a batch that acts on what is clean and lists what it held) and a look at one job's folder, plus a look
 * at every pasted folder, whose held jobs the amber line counts. The settings are read and written through the
 * `job-drive-folders` function's three verbs (`whereFilesGoIo.ts`); the rules are `whereFilesGoTab.ts` over
 * `folderName.ts`. The office roles only, never the estimator (`canSetWhereFilesGo`); a change applies to folders made
 * from then on, and the five folder names inside stay fixed.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { EmptyState } from '../EmptyState'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { makeJobDriveFolders } from '../../lib/jobs/jobDriveFoldersIo'
import { driveFolderBackfillOutcome, driveFoldersMadeWords, jobDriveLinksPatch, planDriveFolderBackfill, type JobDriveLinksPatch } from '../../lib/jobs/jobDriveFolders'
import {
  BID_FOLDER_PIECE_LABELS,
  BID_FOLDER_PIECES,
  bidFolderName,
  driveFolderIdFromLinkOrId,
  folderName,
  JOB_FOLDER_PIECE_LABELS,
  JOB_FOLDER_PIECES,
  JOB_FOLDER_TREE,
  type BidFolderPiece,
  type FoldersMade,
  type JobFolderPiece,
} from '../../lib/documents/folderName'
import {
  addPiece,
  APPLIES_FROM_NOW_WORDS,
  bidFolderFacts,
  checkPastedWords,
  EVERY_PASTED_OK_WORDS,
  exampleJob,
  FIXED_NAMES_WORDS,
  FOLDERS_MADE_WORDS,
  heldLineWords,
  JOB_HAS_NO_FOLDER_WORDS,
  jobFolderFacts,
  jobLabel,
  LOOKING_UP_WORDS,
  makeFoldersWords,
  pastedFolderJobs,
  pickerQuery,
  removePiece,
  rootCardWords,
  samePattern,
  trayPieces,
  type FolderCheck,
  type WhereFilesGo,
  type WhereFilesGoBid,
  type WhereFilesGoJob,
} from '../../lib/documents/whereFilesGoTab'
import { checkDriveFolder, findWhereFilesGoJobs, loadWhereFilesGoBid, loadWhereFilesGoJobs, readWhereFilesGo, setWhereFilesGo, type WhereFilesGoSet } from '../../lib/documents/whereFilesGoIo'

// --- looks -----------------------------------------------------------------------------------------------------------

const cards: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 12, marginTop: 12 }
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', display: 'grid', gap: 8, alignContent: 'start', minWidth: 0 }
const cardH: CSSProperties = { margin: 0, fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-strong)' }
const muted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
const okLine: CSSProperties = { fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-green-700)', margin: 0 }
const warnLine: CSSProperties = { fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-amber-800)', margin: 0 }
const input: CSSProperties = { flex: 1, minWidth: 0, border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-subtle)', color: 'var(--text-base)', padding: '7px 10px', font: 'inherit', fontSize: '0.8125rem' }
const btn: CSSProperties = { padding: '0.4rem 0.8rem', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 8, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap' }
const btnPrimary: CSSProperties = { ...btn, background: '#2563eb', borderColor: '#2563eb', color: 'white' }
const btnQuiet: CSSProperties = { ...btn, fontSize: '0.75rem', fontWeight: 500, padding: '0.2rem 0.55rem' }
const chips: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }
const chipOn: CSSProperties = { border: '1px solid var(--text-strong)', borderRadius: 999, background: 'var(--text-strong)', color: 'var(--surface)', fontSize: '0.78rem', fontWeight: 600, padding: '4px 10px', cursor: 'pointer', font: 'inherit', whiteSpace: 'nowrap' }
const chipAdd: CSSProperties = { ...chipOn, border: '1px dashed var(--border-strong)', background: 'var(--surface)', color: 'var(--text-muted)' }
const dot: CSSProperties = { color: 'var(--text-muted)', fontWeight: 700 }
const exampleLine: CSSProperties = { ...muted, margin: 0 }
const exampleName: CSSProperties = { fontSize: '0.9rem', color: 'var(--text-strong)', fontWeight: 700 }
const list: CSSProperties = { margin: 0, paddingLeft: '1.1rem', display: 'grid', gap: '0.25rem' }

/** The folder glyph the mock-up draws beside a folder's name. */
function FolderGlyph() {
  return (
    <span aria-hidden="true" style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: 5, background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
      <svg viewBox="0 0 20 16" width="16" height="13" style={{ display: 'inline-block' }}>
        <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h4l2 2h9A1.5 1.5 0 0 1 19 5.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 1 13.5z" fill="currentColor" />
      </svg>
    </span>
  )
}

/** The check's answer, in its colour: green when the app can write there, amber for Drive's refusal. */
function CheckWords({ ok, words, testId }: { ok: boolean; words: string; testId?: string }) {
  return (
    <p data-testid={testId} style={ok ? okLine : warnLine}>
      {ok ? '✓ ' : ''}
      {words}
    </p>
  )
}

type Save = (set: WhereFilesGoSet, done: string) => Promise<boolean>

// --- the jobs root ---------------------------------------------------------------------------------------------------

function RootCard({ settings, save }: { settings: WhereFilesGo; save: Save }) {
  const words = rootCardWords(settings.root)
  const [pasted, setPasted] = useState('')
  const [checking, setChecking] = useState(false)
  const [checked, setChecked] = useState<{ link: string; check: FolderCheck } | null>(null)
  const [checkProblem, setCheckProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const confirmDialog = useConfirmDialog()
  const check = async () => {
    const link = pasted.trim()
    if (!link || checking) return
    setChecking(true)
    setCheckProblem(null)
    setChecked(null)
    try {
      setChecked({ link, check: await checkDriveFolder(link) })
    } catch (e) {
      setCheckProblem(formatErrorMessage(e, 'The folder was not checked.'))
    } finally {
      setChecking(false)
    }
  }
  const checkedId = checked ? driveFolderIdFromLinkOrId(checked.link) : null
  const isNewRoot = Boolean(checked?.check.ok && checkedId && checkedId !== settings.root?.id)
  const move = async () => {
    if (!checked || saving) return
    const name = checked.check.folder?.name || 'this folder'
    const ok = await confirmDialog({
      title: 'Move the jobs root',
      message: `New job folders will be made under ${name}. The folders that exist stay where they are.`,
      confirmLabel: 'Move the root',
    })
    if (!ok) return
    setSaving(true)
    const saved = await save({ root: checked.link }, `The jobs root is now ${name}.`)
    setSaving(false)
    if (saved) {
      setChecked(null)
      setPasted('')
    }
  }
  return (
    <section style={card} aria-label="The jobs root" data-testid="wfg-root-card">
      <h4 style={cardH}>The jobs root</h4>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--text-strong)', fontSize: '0.95rem' }}>
        <FolderGlyph />
        <span style={{ minWidth: 0 }}>
          <span data-testid="wfg-root-name">{words.name}</span>
          {words.path ? <span style={{ ...muted, display: 'block', fontWeight: 500 }}>{words.path}</span> : null}
        </span>
      </div>
      {words.owner || words.count ? (
        <p style={{ ...muted, margin: 0 }}>
          {words.owner ? <span>{words.owner} </span> : null}
          {words.count ? <span>{words.count}</span> : null}
        </p>
      ) : null}
      {words.from ? <p style={{ ...muted, margin: 0 }}>{words.from}</p> : null}
      {settings.root ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <CheckWords ok={settings.root.ok} words={settings.root.words} testId="wfg-root-check" />
          <button type="button" style={btnQuiet} onClick={() => openInExternalBrowser(settings.root!.url)}>
            Open in Drive
          </button>
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          aria-label="A Drive folder link for the jobs root"
          placeholder="Paste a Drive folder link to move it"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void check()
          }}
          style={input}
        />
        <button type="button" style={btn} disabled={checking || !pasted.trim()} onClick={() => void check()}>
          {checking ? 'Checking…' : 'Check'}
        </button>
      </div>
      {checkProblem ? <p style={warnLine}>{checkProblem}</p> : null}
      {checked ? (
        <>
          <CheckWords ok={checked.check.ok} words={checked.check.words} testId="wfg-pasted-check" />
          {checked.check.folder ? (
            <p style={{ ...muted, margin: 0 }}>
              {checked.check.folder.name}
              {checked.check.folder.path.length > 0 ? ` · ${[...checked.check.folder.path, checked.check.folder.name].join(' › ')}` : ''}
            </p>
          ) : null}
          {isNewRoot ? (
            <div>
              <button type="button" style={btnPrimary} disabled={saving} onClick={() => void move()}>
                {saving ? 'Moving…' : 'Move the jobs root here'}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

// --- how a folder is named -------------------------------------------------------------------------------------------

function PatternRow<P extends string>({ testId, label, pattern, pieces, labels, example, saved, onChange, onSave, onUndo, saving }: {
  testId: string
  label: ReactNode
  pattern: readonly P[]
  pieces: readonly P[]
  labels: Readonly<Record<P, string>>
  example: string | null
  saved: readonly P[]
  onChange: (next: P[]) => void
  onSave: () => void
  onUndo: () => void
  saving: boolean
}) {
  const dirty = !samePattern(pattern, saved)
  const tray = trayPieces(pattern, pieces)
  return (
    <div style={{ display: 'grid', gap: 6 }} data-testid={testId}>
      <div style={chips}>
        {label}
        {pattern.map((p, i) => (
          <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            {i > 0 ? <span style={dot}>·</span> : null}
            <button type="button" style={chipOn} aria-label={`Remove ${labels[p]}`} title={pattern.length > 1 ? 'Press to take this piece out' : 'A folder name needs one piece'} disabled={pattern.length <= 1} onClick={() => onChange(removePiece(pattern, p))}>
              {labels[p]}
              {pattern.length > 1 ? <span aria-hidden="true" style={{ marginLeft: 6, opacity: 0.7 }}>×</span> : null}
            </button>
          </span>
        ))}
      </div>
      {tray.length > 0 ? (
        <div style={chips}>
          <span style={muted}>Add:</span>
          {tray.map((p) => (
            <button key={p} type="button" style={chipAdd} aria-label={`Add ${labels[p]}`} onClick={() => onChange(addPiece(pattern, p))}>
              + {labels[p]}
            </button>
          ))}
        </div>
      ) : null}
      {example ? (
        <p style={exampleLine}>
          Reads <b style={exampleName}>{example}</b>
        </p>
      ) : null}
      {dirty ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button type="button" style={btnPrimary} disabled={saving} onClick={onSave}>
            {saving ? 'Saving…' : 'Save the name'}
          </button>
          <button type="button" style={btnQuiet} disabled={saving} onClick={onUndo}>
            Undo
          </button>
        </div>
      ) : null}
    </div>
  )
}

function NameCard({ settings, job, bid, save }: { settings: WhereFilesGo; job: WhereFilesGoJob | null; bid: WhereFilesGoBid | null; save: Save }) {
  const [jobPattern, setJobPattern] = useState<JobFolderPiece[]>(settings.jobPattern)
  const [bidPattern, setBidPattern] = useState<BidFolderPiece[]>(settings.bidPattern)
  const [saving, setSaving] = useState<'job' | 'bid' | null>(null)
  useEffect(() => setJobPattern(settings.jobPattern), [settings.jobPattern])
  useEffect(() => setBidPattern(settings.bidPattern), [settings.bidPattern])
  const jobFacts = job ? jobFolderFacts(job) : null
  const bidFacts = bid ? bidFolderFacts(bid) : null
  const saveJob = async () => {
    setSaving('job')
    await save({ job_pattern: jobPattern }, 'Saved. New job folders are named this way.')
    setSaving(null)
  }
  const saveBid = async () => {
    setSaving('bid')
    await save({ bid_pattern: bidPattern }, 'Saved. New bid folders are named this way.')
    setSaving(null)
  }
  return (
    <section style={card} aria-label="How a job's folder is named" data-testid="wfg-name-card">
      <h4 style={cardH}>How a job’s folder is named</h4>
      <PatternRow
        testId="wfg-job-pattern"
        label={null}
        pattern={jobPattern}
        pieces={JOB_FOLDER_PIECES}
        labels={JOB_FOLDER_PIECE_LABELS}
        example={jobFacts ? folderName(jobPattern, jobFacts) : null}
        saved={settings.jobPattern}
        onChange={setJobPattern}
        onSave={() => void saveJob()}
        onUndo={() => setJobPattern(settings.jobPattern)}
        saving={saving === 'job'}
      />
      <PatternRow
        testId="wfg-bid-pattern"
        label={<span style={muted}>A bid’s folder:</span>}
        pattern={bidPattern}
        pieces={BID_FOLDER_PIECES}
        labels={BID_FOLDER_PIECE_LABELS}
        example={bidFacts ? bidFolderName(bidPattern, bidFacts) : null}
        saved={settings.bidPattern}
        onChange={setBidPattern}
        onSave={() => void saveBid()}
        onUndo={() => setBidPattern(settings.bidPattern)}
        saving={saving === 'bid'}
      />
      <p style={{ ...muted, margin: 0 }}>{APPLIES_FROM_NOW_WORDS}</p>
    </section>
  )
}

// --- what is inside --------------------------------------------------------------------------------------------------

function TreeCard({ settings, exampleName: name, save }: { settings: WhereFilesGo; exampleName: string | null; save: Save }) {
  const [saving, setSaving] = useState(false)
  const pick = async (made: FoldersMade) => {
    if (made === settings.foldersMade || saving) return
    setSaving(true)
    await save({ folders_made: made }, made === 'upfront' ? 'Saved. A new job gets every folder when its folder is made.' : 'Saved. A new job gets each folder when something first lands in it.')
    setSaving(false)
  }
  const leaf = (depth: number, text: string) => (
    <li key={text} style={{ paddingLeft: depth * 16, listStyle: 'none', fontSize: '0.8125rem', color: 'var(--text-strong)', lineHeight: 1.55 }}>
      <span aria-hidden="true" style={{ color: 'var(--text-faint)', marginRight: 4 }}>└</span>
      {text}
    </li>
  )
  return (
    <section style={card} aria-label="What is inside" data-testid="wfg-tree-card">
      <h4 style={cardH}>What is inside</h4>
      <ul style={{ margin: 0, padding: 0 }} data-testid="wfg-tree">
        <li style={{ listStyle: 'none', fontWeight: 700, fontSize: '0.8125rem', color: 'var(--text-strong)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <FolderGlyph />
          {name ?? 'A job’s folder'}
        </li>
        {leaf(1, JOB_FOLDER_TREE.pictures)}
        {leaf(1, JOB_FOLDER_TREE.plans)}
        {leaf(1, JOB_FOLDER_TREE.teamOnly)}
        {leaf(2, JOB_FOLDER_TREE.photos)}
        {leaf(2, JOB_FOLDER_TREE.sentByUs)}
      </ul>
      <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'grid', gap: 5 }} disabled={saving}>
        <legend style={{ ...muted, padding: 0, marginBottom: 4 }}>When the folders are made</legend>
        {(['upfront', 'as-needed'] as const).map((made) => (
          <label key={made} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.8rem', color: settings.foldersMade === made ? 'var(--text-strong)' : 'var(--text-700)', fontWeight: settings.foldersMade === made ? 600 : 400, cursor: 'pointer' }}>
            <input type="radio" name="wfg-folders-made" value={made} checked={settings.foldersMade === made} onChange={() => void pick(made)} style={{ marginTop: 2 }} />
            {FOLDERS_MADE_WORDS[made]}
          </label>
        ))}
      </fieldset>
      <p style={{ ...muted, margin: 0 }}>{FIXED_NAMES_WORDS}</p>
    </section>
  )
}

// --- the presses under the cards -------------------------------------------------------------------------------------

type HeldRow = { job: WhereFilesGoJob; why: string }

function JobRows({ rows }: { rows: HeldRow[] }) {
  return (
    <ul style={list}>
      {rows.map(({ job, why }) => (
        <li key={job.id} style={{ fontSize: '0.8125rem' }}>
          <span style={{ fontWeight: 600 }}>{jobLabel(job)}</span> <span style={muted}>· {why}</span>{' '}
          <Link to={`/jobs?edit=${encodeURIComponent(job.id)}`} style={{ ...btnQuiet, textDecoration: 'none', display: 'inline-block' }}>
            Open the job
          </Link>
        </li>
      ))}
    </ul>
  )
}

function Presses({ jobs, onFoldersMade }: { jobs: WhereFilesGoJob[]; onFoldersMade: (id: string, patch: JobDriveLinksPatch) => void }) {
  const { showToast } = useToastContext()
  const plan = planDriveFolderBackfill(jobs, makeFoldersWords)

  // The batch: every live job without a folder, run one after another past a job that fails.
  const [run, setRun] = useState<{ total: number; done: number; failed: HeldRow[]; closed: HeldRow[]; running: boolean } | null>(null)
  const start = async () => {
    const ready = plan.ready
    if (ready.length === 0 || run?.running) return
    let done = 0
    const failed: HeldRow[] = []
    const closed: HeldRow[] = []
    setRun({ total: ready.length, done, failed, closed, running: true })
    for (const job of ready) {
      try {
        const r = await makeJobDriveFolders(job.id)
        onFoldersMade(job.id, jobDriveLinksPatch(r))
        done += 1
        const hold = driveFoldersMadeWords(r).hold
        if (hold) closed.push({ job, why: hold })
      } catch (e) {
        failed.push({ job, why: formatErrorMessage(e, 'The folders were not made.') })
      }
      setRun({ total: ready.length, done, failed: [...failed], closed: [...closed], running: true })
    }
    setRun({ total: ready.length, done, failed, closed, running: false })
    const outcome = driveFolderBackfillOutcome(done, failed.length)
    showToast(outcome.line, outcome.tone)
  }
  const outcome = run && !run.running ? driveFolderBackfillOutcome(run.done, run.failed.length) : null

  // One job's folder: type a number or a name, press the job, read the words.
  const [pickOpen, setPickOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [one, setOne] = useState<{ job: WhereFilesGoJob; ok: boolean; words: string; url: string | null } | null>(null)
  const [oneChecking, setOneChecking] = useState<string | null>(null)
  const matches = useMemo(() => {
    const q = typed.trim().toLowerCase()
    if (!q) return []
    return jobs.filter((j) => jobLabel(j).toLowerCase().includes(q) || (j.customer_name ?? '').toLowerCase().includes(q)).slice(0, 8)
  }, [jobs, typed])
  // A job the live list does not hold, a paid one, is looked up among every job once the typing rests (v2.6073).
  const query = pickerQuery(typed)
  const [lookedUp, setLookedUp] = useState<{ query: string; rows: WhereFilesGoJob[]; problem: string | null } | null>(null)
  const [looking, setLooking] = useState(false)
  useEffect(() => {
    if (!query || matches.length > 0) {
      setLooking(false)
      return
    }
    let alive = true
    setLooking(true)
    const t = setTimeout(() => {
      findWhereFilesGoJobs(query)
        .then((rows) => {
          if (alive) setLookedUp({ query, rows, problem: null })
        })
        .catch((e: unknown) => {
          if (alive) setLookedUp({ query, rows: [], problem: formatErrorMessage(e, 'The look-up did not read.') })
        })
        .finally(() => {
          if (alive) setLooking(false)
        })
    }, 300)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [query, matches.length])
  const found = lookedUp && lookedUp.query === query ? lookedUp : null
  const jobChips = (rows: WhereFilesGoJob[]) => (
    <div style={chips}>
      {rows.map((j) => (
        <button key={j.id} type="button" style={chipAdd} disabled={oneChecking !== null} onClick={() => void checkOne(j)}>
          {oneChecking === j.id ? 'Checking…' : jobLabel(j)}
        </button>
      ))}
    </div>
  )
  const checkOne = async (job: WhereFilesGoJob) => {
    if (oneChecking) return
    const link = (job.google_drive_link ?? '').trim()
    if (!link) {
      setOne({ job, ok: false, words: JOB_HAS_NO_FOLDER_WORDS, url: null })
      return
    }
    setOneChecking(job.id)
    try {
      const r = await checkDriveFolder(link)
      setOne({ job, ok: r.ok, words: r.words, url: r.url })
    } catch (e) {
      setOne({ job, ok: false, words: formatErrorMessage(e, 'The folder was not checked.'), url: null })
    } finally {
      setOneChecking(null)
    }
  }

  // Every pasted folder: the look that fills the amber line.
  const pasted = pastedFolderJobs(jobs)
  const pastedWords = checkPastedWords(pasted.length)
  const [sweep, setSweep] = useState<{ total: number; looked: number; held: HeldRow[]; running: boolean } | null>(null)
  const [heldOpen, setHeldOpen] = useState(false)
  const sweepAll = async () => {
    if (pasted.length === 0 || sweep?.running) return
    const held: HeldRow[] = []
    let looked = 0
    setSweep({ total: pasted.length, looked, held, running: true })
    for (const job of pasted) {
      try {
        const r = await checkDriveFolder(job.google_drive_link ?? '')
        if (!r.ok) held.push({ job, why: r.words })
      } catch (e) {
        held.push({ job, why: formatErrorMessage(e, 'The folder was not checked.') })
      }
      looked += 1
      setSweep({ total: pasted.length, looked, held: [...held], running: true })
    }
    setSweep({ total: pasted.length, looked, held, running: false })
  }
  const heldLine = sweep && !sweep.running ? heldLineWords(sweep.held.length) : null

  return (
    <div style={{ display: 'grid', gap: 10, marginTop: 12 }} data-testid="wfg-presses">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" style={{ ...btnPrimary, ...(plan.words.dead ? { opacity: 0.45 } : {}) }} disabled={plan.words.dead || !!run?.running} onClick={() => void start()} data-testid="wfg-make-folders">
          {run?.running ? `Making folders… ${run.done + run.failed.length} of ${run.total}` : plan.words.button}
        </button>
        <button type="button" style={btn} aria-expanded={pickOpen} onClick={() => setPickOpen((v) => !v)}>
          Check a job’s folder {pickOpen ? '▴' : '▾'}
        </button>
        <button type="button" style={{ ...btn, ...(pastedWords.dead ? { opacity: 0.45 } : {}) }} disabled={pastedWords.dead || !!sweep?.running} onClick={() => void sweepAll()}>
          {sweep?.running ? `Checking… ${sweep.looked} of ${sweep.total}` : pastedWords.button}
        </button>
        {heldLine ? (
          <button type="button" style={{ ...btnQuiet, border: 'none', background: 'none', color: 'var(--text-amber-800)', fontWeight: 600, fontSize: '0.8rem' }} aria-expanded={heldOpen} onClick={() => setHeldOpen((v) => !v)} data-testid="wfg-held-line">
            {heldLine} ›
          </button>
        ) : sweep && !sweep.running ? (
          <span style={okLine}>✓ {EVERY_PASTED_OK_WORDS}</span>
        ) : null}
      </div>
      <p style={{ ...muted, margin: 0 }}>{plan.words.foot ?? 'Each job gets its folder under the root with Customer Pictures, Plans and Team only inside.'}</p>
      {plan.held.length > 0 ? <JobRows rows={plan.held} /> : null}
      {outcome?.head && run ? (
        <>
          <p style={warnLine}>{outcome.head}</p>
          <JobRows rows={run.failed} />
        </>
      ) : null}
      {run && !run.running && run.closed.length > 0 ? (
        <>
          <p style={warnLine}>{run.closed.length === 1 ? '1 job got its folders but keeps one the app cannot write in.' : `${run.closed.length} jobs got their folders but keep one the app cannot write in.`}</p>
          <JobRows rows={run.closed} />
        </>
      ) : null}
      {heldOpen && sweep && sweep.held.length > 0 ? <JobRows rows={sweep.held} /> : null}
      {pickOpen ? (
        <div style={{ display: 'grid', gap: 6, maxWidth: 520 }} data-testid="wfg-check-one">
          <input aria-label="Type a job number or name" placeholder="Type a job number or name" value={typed} onChange={(e) => setTyped(e.target.value)} style={input} />
          {matches.length > 0 ? (
            jobChips(matches)
          ) : !query ? null : looking || !found ? (
            <p style={{ ...muted, margin: 0 }}>{LOOKING_UP_WORDS}</p>
          ) : found.problem ? (
            <p style={warnLine}>{found.problem}</p>
          ) : found.rows.length > 0 ? (
            <>
              <p style={{ ...muted, margin: 0 }}>Among every job:</p>
              {jobChips(found.rows)}
            </>
          ) : (
            <EmptyState compact {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'jobs', query: typed }), { onPress: () => setTyped('') })} />
          )}
          {one ? (
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }}>{jobLabel(one.job)}</span>
              <CheckWords ok={one.ok} words={one.words} testId="wfg-one-check" />
              {one.url ? (
                <div>
                  <button type="button" style={btnQuiet} onClick={() => openInExternalBrowser(one.url!)}>
                    Open the folder
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

// --- the tab ---------------------------------------------------------------------------------------------------------

export function DocumentsWhereFilesGo() {
  const { showToast } = useToastContext()
  const [settings, setSettings] = useState<WhereFilesGo | null>(null)
  const [settingsFailure, setSettingsFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [jobs, setJobs] = useState<WhereFilesGoJob[] | null>(null)
  const [jobsFailure, setJobsFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [bid, setBid] = useState<WhereFilesGoBid | null>(null)
  const [reading, setReading] = useState(true)

  const readSettings = useCallback(async () => {
    try {
      setSettings(await readWhereFilesGo())
      setSettingsFailure(null)
    } catch (e) {
      setSettingsFailure(recoveryFailureFromError(e, 'The settings did not read.'))
    }
  }, [])
  const readJobs = useCallback(async () => {
    try {
      const [j, b] = await Promise.all([loadWhereFilesGoJobs(), loadWhereFilesGoBid().catch(() => null)])
      setJobs(j)
      setBid(b)
      setJobsFailure(null)
    } catch (e) {
      setJobsFailure(recoveryFailureFromError(e, 'The jobs did not read.'))
    }
  }, [])
  const load = useCallback(async () => {
    setReading(true)
    await Promise.all([readSettings(), readJobs()])
    setReading(false)
  }, [readSettings, readJobs])
  useEffect(() => {
    void load()
  }, [load])

  /** One save for the three cards: the answer is the settings after it, the refusal is the function's words. */
  const save: Save = useCallback(
    async (set, done) => {
      try {
        setSettings(await setWhereFilesGo(set))
        showToast(done, 'success')
        return true
      } catch (e) {
        showToast(formatErrorMessage(e, 'The setting was not saved.'), 'error')
        return false
      }
    },
    [showToast],
  )

  const onFoldersMade = (id: string, patch: JobDriveLinksPatch) => setJobs((prev) => (prev ? prev.map((j) => (j.id === id ? { ...j, ...patch } : j)) : prev))
  const sample = jobs ? exampleJob(jobs) : null
  const sampleName = settings && sample ? folderName(settings.jobPattern, jobFolderFacts(sample)) : null

  return (
    <div data-testid="documents-where-files-go">
      <h2 style={{ margin: '0 0 2px', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-strong)' }}>Where files go</h2>
      <p style={{ ...muted, margin: 0, fontSize: '0.8125rem' }}>Every job’s files live in one folder under the root. The app makes the folder and writes its links on the job.</p>
      {settingsFailure ? <OfflineRetryPanel failure={settingsFailure} onRetry={readSettings} surface="where-files-go" idempotent busy={reading} style={{ marginTop: 12 }} /> : null}
      {settings ? (
        <div style={cards}>
          <RootCard settings={settings} save={save} />
          <NameCard settings={settings} job={sample} bid={bid} save={save} />
          <TreeCard settings={settings} exampleName={sampleName} save={save} />
        </div>
      ) : !settingsFailure ? (
        <p style={{ ...muted, marginTop: 12 }}>Reading the settings…</p>
      ) : null}
      {jobsFailure ? <OfflineRetryPanel failure={jobsFailure} onRetry={readJobs} surface="where-files-go-jobs" idempotent busy={reading} style={{ marginTop: 12 }} /> : null}
      {jobs ? <Presses jobs={jobs} onFoldersMade={onFoldersMade} /> : null}
    </div>
  )
}

export default DocumentsWhereFilesGo
