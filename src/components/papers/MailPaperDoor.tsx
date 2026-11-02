/**
 * The mailbox door for papers (punch list #239, the papers train): on a mail tagged to a Pipeline job, **Keep this
 * mail as a paper on JP…** opens the one form with the kind, the sender and the day guessed from the mail, so the
 * spec book, the task list or the schedule lands beside the set it goes with the day it arrives, with its History
 * line and its ask. The job's part is read when the press opens: the job's own part, or one of its development's
 * parts to pick; a job outside any development with no part gets its own part made. The mail's files follow the
 * paper into its own folder under the job's Plans folder (punch list #239, PR 5, `plan-set-files`), one by one past
 * any that fails; the link field still takes a Drive link when the paper lives somewhere else.
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { formatErrorMessage } from '../../utils/errorHandling'
import { PAPER_FROMS, PAPER_KINDS, fromGuess, historyLineForPaper, isPaperKind, kindGuess, nameFromSubject, type PaperAskLane, type PaperDraft, type PaperFrom, type PaperKind } from '../../lib/papers/papers'
import { supabaseJobPlansIo, type JobPlansIo } from '../../lib/plans/planSetsIo'
import { jobShortLabel, partNameForJob, type PlanSetRow } from '../../lib/plans/planSets'
import { PLAN_SET_FILES_WORDS } from '../../lib/plans/planSetFiles'
import { supabasePlanSetFilesIo, type PlanSetFilesIo } from '../../lib/plans/planSetFilesIo'

const muted: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }
const quiet: CSSProperties = { padding: '0.3rem 0.7rem', fontSize: '0.8125rem', borderRadius: 4, cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)' }
const blue: CSSProperties = { ...quiet, background: '#2563eb', borderColor: '#2563eb', color: 'white' }
const field: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(5.5rem, 7rem) 1fr', gap: '0.3rem 0.6rem', alignItems: 'center', fontSize: '0.8125rem' }
const input: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', padding: '0.3rem 0.45rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', width: '100%', boxSizing: 'border-box' }
const hist: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)', borderLeft: '3px solid var(--border)', paddingLeft: '0.5rem', margin: 0 }

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
  io?: JobPlansIo
  filesIo?: PlanSetFilesIo
}) {
  const io = useMemo(() => ioProp ?? supabaseJobPlansIo(), [ioProp])
  const { user } = useAuth()
  const [opened, setOpened] = useState<Opened | null>(null)
  const [draft, setDraft] = useState<(PaperDraft & { partId: string }) | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [kept, setKept] = useState<string | null>(null)

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
      // The mail's files follow the paper into its folder; one that fails is named, the rest still go.
      let filedWords = ''
      if (messageId && made?.id) {
        const files = await filesIo.attachmentsOf(messageId)
        if (files.length === 0) filedWords = ` ${PLAN_SET_FILES_WORDS.mailNoFiles}`
        else {
          const failed: string[] = []
          for (const f of files) {
            try {
              await filesIo.saveAttachment(made.id, f.id)
            } catch (e) {
              failed.push(`${f.name}: ${formatErrorMessage(e, 'it did not land')}`)
            }
          }
          const n = files.length - failed.length
          filedWords = `${n > 0 ? ` ${PLAN_SET_FILES_WORDS.mailFiled(n)}` : ''}${failed.length ? ` ${failed.length === 1 ? 'One file did not land' : `${failed.length} files did not land`}: ${failed.join('; ')}.` : ''}`
        }
      }
      setKept(`Kept on ${opened.parts.find((p) => p.id === partId)?.name ?? jobShortLabel({ job_name: jobLabel })}: ${draft.name.trim()}. It reads under Plans on ${jobLabel}${opened.developmentId ? ' and on the site' : ''}.${filedWords}`)
      setDraft(null)
    } catch (e) {
      setProblem(formatErrorMessage(e, 'The paper did not keep.'))
    } finally {
      setBusy(false)
    }
  }

  if (kept) return <p style={{ ...muted, color: 'var(--text-green-700)' }}>{kept}</p>
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
