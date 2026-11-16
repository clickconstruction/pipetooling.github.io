/**
 * **Keep its files on the bid…** (punch list #368, PR 2): the press on a mail tied to a bid, drawn wherever the
 * office reads that mail (the mail's window in Messages, My email, and from PR 3 the site's History and the bid's
 * Plan sets). An addendum or a revised spec comes by mail; the press files what the mail carries in the bid's own
 * Drive folder under Plans and adds it to the bid as a set of plans, so the estimators and the robot find it where
 * the bid's plans are.
 *
 * What it draws follows the mail's own files (`bidMailState`): nothing for a mail with no file, the press while a
 * file we hold is in no set yet, a *kept* mark with the door to the set once they all are, and a line that says why
 * when every file stayed in Gmail. The form is filled from the mail and offers a new set or one of the bid's sets the
 * app can file into. The button counts what it will file; a file that stayed in Gmail is named and held; the files go
 * one by one past any that fails, and a file that did not land is tried again on the same set, never a second one.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  INTO_NEW,
  KEEP_ON_BID_LABEL,
  KEEP_ON_BID_TIP,
  bidKeptWords,
  bidMailDraft,
  bidMailDraftProblem,
  bidMailState,
  fileAgainOnBidLabel,
  fileSizeWords,
  keepPressWords,
  mailKeptWords,
  nothingToKeepWords,
  putIntoOptions,
  type BidKeepResult,
  type BidMailDraft,
  type BidMailFile,
} from '../../lib/bids/bidMailSet'
import { supabaseBidMailSetIo, type BidMailSetIo } from '../../lib/bids/bidMailSetIo'
import type { BidPlanSetRow } from '../../lib/bids/bidPlanSets'
import { formatErrorMessage } from '../../utils/errorHandling'
import { Btn, Chip, input } from '../gc/gcUi'

const muted: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }
const field: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(5.5rem, 7rem) minmax(0, 1fr)', gap: '0.3rem 0.6rem', alignItems: 'center', fontSize: '0.8125rem' }
const link: CSSProperties = { color: 'var(--text-link)', fontWeight: 600, fontSize: '0.8125rem', textDecoration: 'none', whiteSpace: 'nowrap' }
/** The form and what it says after take their own row under a row of presses, as the mail window's other panels do. */
const ownRow: CSSProperties = { order: 1, flexBasis: '100%' }

type Read = { files: BidMailFile[]; sets: BidPlanSetRow[] }
type Result = { said: BidKeepResult; setId: string; folderUrl: string; retry: BidMailFile[] }

export function BidMailSetDoor({
  bidId,
  bidLabel,
  messageId,
  mail,
  io = supabaseBidMailSetIo,
  say,
  onKept,
}: {
  bidId: string
  /** The bid as the press names it: *B482*. */
  bidLabel: string
  /** The mail's line in Messages. */
  messageId: string
  mail: { subject: string | null | undefined; who: string | null | undefined; at: string }
  io?: BidMailSetIo
  /** The page's toast, when it has one. The door says the same words itself either way. */
  say?: (words: string, tone: 'success' | 'error') => void
  /** A set was added or a file landed: the page reads what it shows again. */
  onKept?: () => void
}) {
  const [read, setRead] = useState<Read | null>(null)
  const [readFailed, setReadFailed] = useState<string | null>(null)
  const [draft, setDraft] = useState<BidMailDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const load = useCallback(async () => {
    try {
      const [files, sets] = await Promise.all([io.filesOf(messageId), io.setsOf(bidId)])
      setRead({ files, sets })
      setReadFailed(null)
    } catch (e) {
      setReadFailed(formatErrorMessage(e, 'This mail’s files did not read.'))
    }
  }, [io, messageId, bidId])

  useEffect(() => {
    void load()
  }, [load])

  const state = useMemo(() => (read ? bidMailState(read.files) : null), [read])
  const setName = useCallback((id: string | null) => read?.sets.find((s) => s.id === id)?.name ?? '', [read])

  /** The picked files into the set, one by one past any that fails. */
  const fileThem = async (setId: string, files: ReadonlyArray<BidMailFile>): Promise<{ landed: number; failed: Array<{ file: BidMailFile; why: string }> }> => {
    const failed: Array<{ file: BidMailFile; why: string }> = []
    for (const f of files) {
      try {
        await io.saveAttachment(setId, f.id)
      } catch (e) {
        failed.push({ file: f, why: formatErrorMessage(e, 'it did not land') })
      }
    }
    return { landed: files.length - failed.length, failed }
  }

  const finish = async (next: Result) => {
    setResult(next)
    setDraft(null)
    const words = bidKeptWords(next.said, bidLabel)
    say?.(words.words, words.tone === 'success' ? 'success' : 'error')
    await load()
    onKept?.()
  }

  const keep = async () => {
    if (!draft || !read || state?.kind !== 'keep' || busy) return
    const why = bidMailDraftProblem(draft)
    if (why) {
      setProblem(why)
      return
    }
    setBusy(true)
    setProblem(null)
    try {
      const picked = state.ready.filter((f) => draft.picked.includes(f.id))
      let target: { id: string; name: string; folderUrl: string; joined: boolean }
      if (draft.into === INTO_NEW) {
        const kept = await io.keep({ bidId, messageId, name: draft.name.trim(), memo: draft.memo.trim(), planDate: draft.planDate })
        target = { id: kept.set.id, name: kept.set.name, folderUrl: kept.folderUrl, joined: kept.reused }
      } else {
        const set = read.sets.find((s) => s.id === draft.into)
        if (!set) throw new Error('That set is no longer on the bid. Pick another, or keep the files as a new set.')
        target = { id: set.id, name: set.name, folderUrl: set.link, joined: true }
      }
      const filed = await fileThem(target.id, picked)
      await finish({
        said: { setName: target.name, joined: target.joined, landed: filed.landed, failed: filed.failed.map((x) => ({ name: x.file.name, why: x.why })), left: state.left },
        setId: target.id,
        folderUrl: target.folderUrl,
        retry: filed.failed.map((x) => x.file),
      })
    } catch (e) {
      setProblem(formatErrorMessage(e, 'The files were not kept on the bid.'))
    } finally {
      setBusy(false)
    }
  }

  const fileAgain = async () => {
    if (!result || result.retry.length === 0 || busy) return
    setBusy(true)
    try {
      const filed = await fileThem(result.setId, result.retry)
      await finish({ ...result, said: { ...result.said, landed: result.said.landed + filed.landed, failed: filed.failed.map((x) => ({ name: x.file.name, why: x.why })) }, retry: filed.failed.map((x) => x.file) })
    } finally {
      setBusy(false)
    }
  }

  if (readFailed) {
    return (
      <span data-bid-mail-set="read-failed" style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span role="alert" style={{ ...muted, color: 'var(--text-amber-800)' }}>
          {readFailed}
        </span>
        <Btn kind="quiet" onClick={() => void load()}>
          Read again
        </Btn>
      </span>
    )
  }
  if (!read || !state || state.kind === 'none') return null

  if (result) {
    const said = bidKeptWords(result.said, bidLabel)
    return (
      <div data-bid-mail-set="result" data-tone={said.tone} role="status" style={{ ...ownRow, display: 'grid', gap: '0.3rem', justifyItems: 'start', fontSize: '0.8125rem' }}>
        <span style={{ color: said.tone === 'warning' ? 'var(--text-amber-800)' : 'var(--text-green-700)' }}>{said.words}</span>
        <span style={{ display: 'inline-flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <a href={result.folderUrl} target="_blank" rel="noreferrer" style={link}>
            Open the folder ↗
          </a>
          {result.retry.length > 0 ? (
            <Btn disabled={busy} onClick={() => void fileAgain()}>
              {busy ? 'Filing…' : fileAgainOnBidLabel(result.retry.length)}
            </Btn>
          ) : null}
        </span>
      </div>
    )
  }

  if (state.kind === 'left') {
    return (
      <span data-bid-mail-set="left" style={muted}>
        {nothingToKeepWords(state.left.length)}
      </span>
    )
  }

  const keptSetIds = [...new Set(state.kept.map((f) => f.setId).filter((id): id is string => id !== null))]
  const keptMark =
    keptSetIds.length > 0 ? (
      <span data-bid-mail-set="kept" style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip tone="green" small>
          {mailKeptWords(keptSetIds.map(setName), bidLabel)}
        </Chip>
        {keptSetIds.length === 1 && read.sets.find((s) => s.id === keptSetIds[0])?.link ? (
          <a href={read.sets.find((s) => s.id === keptSetIds[0])!.link} target="_blank" rel="noreferrer" style={link}>
            Open the set ↗
          </a>
        ) : null}
      </span>
    ) : null

  if (state.kind === 'kept') return keptMark

  if (!draft) {
    return (
      <>
        {keptMark}
        <Btn title={KEEP_ON_BID_TIP} onClick={() => setDraft(bidMailDraft(mail, state.ready, read.sets))}>
          {KEEP_ON_BID_LABEL}
        </Btn>
      </>
    )
  }

  const put = (patch: Partial<BidMailDraft>) => {
    setDraft({ ...draft, ...patch })
    setProblem(null)
  }
  const intoNew = draft.into === INTO_NEW
  const picked = state.ready.filter((f) => draft.picked.includes(f.id)).length
  const press = keepPressWords(picked, state.left.length, bidLabel, intoNew ? null : setName(draft.into) || 'the set')
  const options = putIntoOptions(read.sets)
  return (
    <div data-bid-mail-set="form" role="group" aria-label={`Keep this mail’s files on ${bidLabel}`} style={{ ...ownRow, display: 'grid', gap: '0.45rem', padding: '0.6rem 0.75rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-muted)' }}>
      <strong style={{ fontSize: '0.875rem' }}>Keep this mail’s files on {bidLabel}</strong>
      <div style={field}>
        <span>Files</span>
        <div style={{ display: 'grid', gap: '0.2rem' }}>
          {state.ready.map((f) => (
            <label key={f.id} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={draft.picked.includes(f.id)}
                disabled={busy}
                onChange={(e) => put({ picked: e.target.checked ? [...draft.picked, f.id] : draft.picked.filter((id) => id !== f.id) })}
              />
              <span style={{ overflowWrap: 'anywhere', minWidth: 0 }}>{f.name}</span>
              {fileSizeWords(f.size) ? <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>· {fileSizeWords(f.size)}</span> : null}
            </label>
          ))}
          {state.left.map((f) => (
            <span key={f.id} data-bid-mail-file="left" style={{ color: 'var(--text-amber-800)', overflowWrap: 'anywhere' }}>
              {f.name} · stays in Gmail, {f.leftWhy === 'too_big' ? 'too big for us to keep' : 'never copied here'}
            </span>
          ))}
          {state.kept.map((f) => (
            <span key={f.id} data-bid-mail-file="kept" style={{ color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>
              {f.name} · already in {setName(f.setId) || 'a set on this bid'}
            </span>
          ))}
        </div>
      </div>
      {options.length > 1 ? (
        <label style={field}>
          <span>Put them in</span>
          <select style={input} value={draft.into} disabled={busy} onChange={(e) => put({ into: e.target.value })}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {intoNew ? (
        <>
          <label style={field}>
            <span>Name</span>
            <input style={input} value={draft.name} disabled={busy} onChange={(e) => put({ name: e.target.value })} />
          </label>
          <label style={field}>
            <span>Date on it</span>
            <input style={{ ...input, maxWidth: '11rem' }} type="date" value={draft.planDate} disabled={busy} onChange={(e) => put({ planDate: e.target.value })} />
          </label>
          <label style={field}>
            <span>Memo</span>
            <input style={input} value={draft.memo} disabled={busy} placeholder="what changed, or who sent it" onChange={(e) => put({ memo: e.target.value })} />
          </label>
        </>
      ) : null}
      <p style={muted} data-bid-mail-set="goes-to">
        {intoNew ? `Goes to the bid’s Drive folder, under Plans › ${draft.name.trim() || '…'}.` : `Goes into the folder of ${setName(draft.into) || 'that set'}.`} The robot keeps reading the set it reads today.
      </p>
      {press.foot ? <p style={{ ...muted, color: state.left.length > 0 && picked > 0 ? 'var(--text-amber-800)' : undefined }}>{press.foot}</p> : null}
      {problem ? (
        <p role="alert" style={{ ...muted, color: 'var(--text-red-700)' }}>
          {problem}
        </p>
      ) : null}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Btn kind="primary" wrap disabled={busy || press.dead} onClick={() => void keep()}>
          {busy ? 'Filing…' : press.button}
        </Btn>
        <Btn kind="quiet" disabled={busy} onClick={() => setDraft(null)}>
          Not now
        </Btn>
      </div>
    </div>
  )
}
