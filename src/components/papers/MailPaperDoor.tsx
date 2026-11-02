/**
 * The mailbox door for papers (punch list #239, the papers train): on a mail tagged to a Pipeline job, **Keep this
 * mail as a paper on JP…** opens the one form with the kind, the sender and the day guessed from the mail, so the
 * spec book, the task list or the schedule lands beside the set it goes with the day it arrives, with its History
 * line and its ask. The job's part is read when the press opens: the job's own part, or one of its development's
 * parts to pick; a job outside any development with no part gets its own part made. The mail's files follow the
 * paper into its own folder under the job's Plans folder (punch list #239, PR 5, `plan-set-files`), one by one past
 * any that fails, a file that stayed in Gmail named instead of sent; the link field still takes a Drive link when the
 * paper lives somewhere else. What became of the files is said in words that match the color, and a file that did not
 * land, or a read that failed, is tried again on the same paper, never a second one.
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { formatErrorMessage } from '../../utils/errorHandling'
import { PAPER_FROMS, PAPER_KINDS, fromGuess, historyLineForPaper, isPaperKind, kindGuess, nameFromSubject, type PaperAskLane, type PaperDraft, type PaperFrom, type PaperKind } from '../../lib/papers/papers'
import { supabaseJobPlansIo, type JobPlansIo } from '../../lib/plans/planSetsIo'
import { jobShortLabel, partNameForJob, type PlanSetRow } from '../../lib/plans/planSets'
import { PLAN_SET_FILES_WORDS, fileAgainLabel, mailFilesWords, splitMailFiles, type MailFile, type MailFilesResult } from '../../lib/plans/planSetFiles'
import { supabasePlanSetFilesIo, type PlanSetFilesIo } from '../../lib/plans/planSetFilesIo'

const muted: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }
const quiet: CSSProperties = { padding: '0.3rem 0.7rem', fontSize: '0.8125rem', borderRadius: 4, cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)' }
const blue: CSSProperties = { ...quiet, background: '#2563eb', borderColor: '#2563eb', color: 'white' }
const field: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(5.5rem, 7rem) 1fr', gap: '0.3rem 0.6rem', alignItems: 'center', fontSize: '0.8125rem' }
const input: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', padding: '0.3rem 0.45rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', width: '100%', boxSizing: 'border-box' }
const hist: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)', borderLeft: '3px solid var(--border)', paddingLeft: '0.5rem', margin: 0 }

type Kept = {
  head: string
  /** The paper, for a second try of its files. */
  setId: string | null
  files: MailFilesResult | null
  /** The files that did not land, kept for that second try. */
  retry: MailFile[]
}

const noFiles = (linkTyped: boolean): MailFilesResult => ({ readFailed: null, landed: 0, failed: [], left: [], linkTyped, noLineFiles: 0 })

type Opened = {
  /** The parts the paper may go on: the job's own, or the development's. */
  parts: Array<{ id: string; name: string }>
  /** The job's part when it names one. */
  jobPartId: string | null
  developmentId: string | null
  siteName: string
  sets: PlanSetRow[]
  /** A job outside any development with no part yet: the keep makes its part first. */
  makeOwnPart: boolean
}

export function MailPaperDoor({
  jobId,
  jobLabel,
  subject,
  senderAddress,
  at,
  messageId = null,
  mailFileCount = 0,
  io: ioProp,
  filesIo = supabasePlanSetFilesIo,
}: {
  jobId: string
  jobLabel: string
  subject: string
  senderAddress: string | null
  at: string
  /** The mail's line in Messages when the conversation is tagged: its files follow the paper into Drive. */
  messageId?: string | null
  /** How many files the mail shows, so a mail no line holds yet can say they stay behind. */
  mailFileCount?: number
  io?: JobPlansIo
  filesIo?: PlanSetFilesIo
}) {
  const io = useMemo(() => ioProp ?? supabaseJobPlansIo(), [ioProp])
  const { user } = useAuth()
  const [opened, setOpened] = useState<Opened | null>(null)
  const [draft, setDraft] = useState<(PaperDraft & { partId: string }) | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [kept, setKept] = useState<Kept | null>(null)

  const open = async () => {
    if (busy) return
    setBusy(true)
    setProblem(null)
    try {
      const r = await io.read(jobId)
      let parts: Array<{ id: string; name: string }> = []
      let sets: PlanSetRow[] = r.sets
      if (r.part) parts = [{ id: r.part.id, name: r.part.name }]
      if (r.job.development_id) {
        const site = await io.readSite(r.job.development_id)
        parts = site.parts.map((p) => ({ id: p.id, name: p.name }))
        sets = site.sets
      }
      const o: Opened = { parts, jobPartId: r.part?.id ?? null, developmentId: r.job.development_id, siteName: r.job.development_name?.trim() || jobLabel, sets, makeOwnPart: !r.part && !r.job.development_id }
      setOpened(o)
      setDraft({
        partId: r.part?.id ?? parts[0]?.id ?? '',
        kind: kindGuess(subject),
        name: nameFromSubject(subject),
        from: fromGuess(senderAddress),
        cameOn: at.slice(0, 10),
        memo: '',
        link: '',
        goesWithSetId: r.part?.current_set_id ?? null,
        replacesPaperId: null,
        asks: false,
        askLane: 'estimators',
        askWords: '',
      })
    } catch (e) {
      setProblem(formatErrorMessage(e, 'The job did not read.'))
    } finally {
      setBusy(false)
    }
  }

  /**
   * The mail's files into the paper's folder, one that fails named and the rest still landing. `only` are the files a
   * first try left behind; with none the files are read first, and a read that fails says so instead of reading as
   * a mail with no file. The paper is kept whatever happens here.
   */
  const fileTheMail = async (setId: string, lineId: string, before: MailFilesResult, only: MailFile[]): Promise<{ files: MailFilesResult; retry: MailFile[] }> => {
    let ready = only
    let left = before.left
    if (only.length === 0) {
      try {
        const split = splitMailFiles(await filesIo.attachmentsOf(lineId))
        ready = split.ready
        left = split.left
      } catch (e) {
        return { files: { ...before, readFailed: formatErrorMessage(e, 'The read did not finish.') }, retry: [] }
      }
    }
    const failed: Array<{ file: MailFile; why: string }> = []
    for (const f of ready) {
      try {
        await filesIo.saveAttachment(setId, f.id)
      } catch (e) {
        failed.push({ file: f, why: formatErrorMessage(e, 'it did not land') })
      }
    }
    return {
      files: { ...before, readFailed: null, left, landed: before.landed + ready.length - failed.length, failed: failed.map((x) => ({ name: x.file.name, why: x.why })) },
      retry: failed.map((x) => x.file),
    }
  }

  const fileAgain = async () => {
    if (!kept?.setId || !kept.files || !messageId || busy) return
    setBusy(true)
    const next = await fileTheMail(kept.setId, messageId, kept.files, kept.retry)
    setKept({ ...kept, ...next })
    setBusy(false)
  }

  const keep = async () => {
    if (!opened || !draft || busy) return
    if (!draft.name.trim()) {
      setProblem('Give the paper a name.')
      return
    }
    setBusy(true)
    setProblem(null)
    try {
      let partId = draft.partId
      if (!partId && opened.makeOwnPart) {
        const made = await io.makePart({ jobId, developmentId: null, name: partNameForJob({ job_name: jobLabel }), userId: user?.id ?? null })
        partId = made.id
      }
      if (!partId) throw new Error('Pick the part of the site the paper goes on.')
      if (opened.developmentId && !opened.jobPartId) await io.pickPart(jobId, partId)
      const made = await io.keepPaper({ partId, draft, owed: false, jobId, jobLabel, developmentId: opened.developmentId, siteName: opened.siteName, userId: user?.id ?? null })
      const linkTyped = Boolean(draft.link.trim())
      const filing =
        messageId && made?.id
          ? await fileTheMail(made.id, messageId, noFiles(linkTyped), [])
          : { files: !messageId && mailFileCount > 0 ? { ...noFiles(linkTyped), noLineFiles: mailFileCount } : null, retry: [] }
      setKept({
        head: `Kept on ${opened.parts.find((p) => p.id === partId)?.name ?? jobShortLabel({ job_name: jobLabel })}: ${draft.name.trim()}. It reads under Plans on ${jobLabel}${opened.developmentId ? ' and on the site' : ''}.`,
        setId: made?.id ?? null,
        ...filing,
      })
      setDraft(null)
    } catch (e) {
      setProblem(formatErrorMessage(e, 'The paper did not keep.'))
    } finally {
      setBusy(false)
    }
  }

  if (kept) {
    const said = kept.files ? mailFilesWords(kept.files) : null
    const again = kept.retry.length > 0 ? fileAgainLabel(kept.retry.length) : kept.files?.readFailed ? PLAN_SET_FILES_WORDS.mailReadAgain : null
    return (
      <div style={{ display: 'grid', gap: '0.25rem', justifyItems: 'start' }} data-testid="mail-paper-kept" data-tone={said?.tone ?? 'success'}>
        <p style={{ ...muted, color: said?.tone === 'warning' ? 'var(--text-amber-800)' : 'var(--text-green-700)' }}>
          {kept.head}
          {said ? ` ${said.words}` : ''}
        </p>
        {again ? (
          <button type="button" style={quiet} disabled={busy} onClick={() => void fileAgain()}>
            {busy ? 'Filing…' : again}
          </button>
        ) : null}
      </div>
    )
  }
  if (!draft || !opened)
    return (
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }} data-testid="mail-paper-door">
        <button type="button" style={quiet} disabled={busy} onClick={() => void open()}>
          {busy ? 'Reading the job…' : `Keep this mail as a paper on ${jobLabel}`}
        </button>
        {problem ? <span style={{ ...muted, color: 'var(--text-amber-800)' }}>{problem}</span> : null}
      </div>
    )
  const put = (patch: Partial<PaperDraft & { partId: string }>) => setDraft({ ...draft, ...patch })
  const drawings = opened.sets.filter((s) => s.part_id === draft.partId && s.kind !== 'as_built' && !isPaperKind(s.kind))
  const goesWithName = draft.goesWithSetId ? (opened.sets.find((s) => s.id === draft.goesWithSetId)?.name ?? null) : null
  return (
    <div style={{ display: 'grid', gap: '0.4rem', padding: '0.6rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-muted)' }} data-testid="mail-paper-form">
      <strong style={{ fontSize: '0.875rem' }}>Keep this mail as a paper on {jobLabel}</strong>
      {opened.parts.length > 1 || (opened.parts.length === 1 && !opened.jobPartId) ? (
        <label style={field}>
          <span>On the part</span>
          <select style={input} value={draft.partId} onChange={(e) => put({ partId: e.target.value, goesWithSetId: null })}>
            {opened.parts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      ) : opened.makeOwnPart ? (
        <p style={muted}>{jobLabel} has no part yet; the keep makes its own.</p>
      ) : null}
      <label style={field}>
        <span>Kind</span>
        <select style={input} value={draft.kind} onChange={(e) => put({ kind: e.target.value as PaperKind })}>
          {PAPER_KINDS.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      <label style={field}>
        <span>Name</span>
        <input style={input} value={draft.name} onChange={(e) => put({ name: e.target.value })} />
      </label>
      {drawings.length ? (
        <label style={field}>
          <span>Goes with</span>
          <select style={input} value={draft.goesWithSetId ?? ''} onChange={(e) => put({ goesWithSetId: e.target.value || null })}>
            <option value="">the part itself</option>
            {drawings.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label style={field}>
        <span>From</span>
        <select style={input} value={draft.from} onChange={(e) => put({ from: e.target.value as PaperFrom })}>
          {PAPER_FROMS.map((f) => (
            <option key={f.from} value={f.from}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      <label style={field}>
        <span>Came</span>
        <input style={input} type="date" value={draft.cameOn} onChange={(e) => put({ cameOn: e.target.value })} />
      </label>
      <label style={field}>
        <span>Memo</span>
        <input style={input} value={draft.memo} placeholder="what it says, in a line" onChange={(e) => put({ memo: e.target.value })} />
      </label>
      <label style={field}>
        <span>Link</span>
        <input style={input} value={draft.link} placeholder="A Drive link, or leave it empty for now" onChange={(e) => put({ link: e.target.value })} />
      </label>
      <label style={field}>
        <span>Asks us</span>
        <span>
          <input type="checkbox" checked={draft.asks} onChange={(e) => put({ asks: e.target.checked })} /> this paper asks something of us
        </span>
      </label>
      {draft.asks ? (
        <>
          <label style={field}>
            <span>Who answers</span>
            <select style={input} value={draft.askLane} onChange={(e) => put({ askLane: e.target.value as PaperAskLane })}>
              <option value="estimators">The estimators</option>
              <option value="dispatch">Dispatch</option>
            </select>
          </label>
          <label style={field}>
            <span>The ask</span>
            <input style={input} value={draft.askWords} placeholder="what it asks, in a line" onChange={(e) => put({ askWords: e.target.value })} />
          </label>
        </>
      ) : null}
      <p style={hist}>Will write on the site’s History: {historyLineForPaper({ kind: draft.kind, name: draft.name || '…', source: draft.from, memo: draft.memo, owed: false, askWords: draft.asks ? draft.askWords || '…' : null, askLane: draft.askLane }, goesWithName, null)}</p>
      {!messageId && mailFileCount > 0 ? <p style={muted}>{PLAN_SET_FILES_WORDS.mailNoLineAhead(mailFileCount)}</p> : null}
      {problem ? <p style={{ ...muted, color: 'var(--text-amber-800)' }}>{problem}</p> : null}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" style={blue} disabled={busy || !draft.name.trim()} onClick={() => void keep()}>
          {busy ? 'Keeping…' : 'Keep the paper'}
        </button>
        <button type="button" style={quiet} disabled={busy} onClick={() => setDraft(null)}>
          Cancel
        </button>
      </div>
    </div>
  )
}
