/**
 * Messages → My email (punch list #230 PR 3, `to-dos/messages-my-email/`): the tab on `/messages?tab=my-email`, a
 * tagging desk and never a second inbox. It reads the person's own Inbox and Sent live through `gmail-mine`
 * (`myMail/myMailIo.ts`), fifty at a time, and keeps nothing until a tag. The view chips **To tag · Tagged · All**
 * (`?view=`), the search box (`?q=`, Gmail's own search), the line that says what is read and kept, the rows
 * (`MyMailListRow`), the notices folded behind one line, and **Older ›** for the next page. A row's **Yes** tags its
 * conversation onto the guess; *other…* and **Tag…** open the job picker (`JobPickerWindow`, their jobs first, then a
 * search); the rest of the row opens the reader (`MyMailReader`), whose bar does the same and, once tagged, **Untag**.
 * A tag that met a sender nobody knows opens *Who is this?* for them at once; closing it leaves the tag standing.
 *
 * No badge, no count, no unread, no reply, no archive: the reply is made in Gmail. An empty To tag is the good state.
 * A refusal is one calm line with the function's words; a read that fails draws on `OfflineRetryPanel` and reads again
 * by itself when the signal comes back.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useConfirmDialog } from '../../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../../contexts/ToastContext'
import type { Contact } from '../../../lib/contacts/kernel'
import { emptyWordsWithPress } from '../../../lib/emptyWords'
import { helpGuideHref } from '../../../lib/helpGuideAnchors'
import type { JobTile } from '../../../lib/messages/jobTiles'
import { jobRefOf } from '../../../lib/messages/jobKeys'
import type { MyMailJobChip, MyMailJobRef, MyMailListOk, MyMailRefusal, MyMailRow, MyMailTagOk, MyMailView } from '../../../lib/myMail/contract'
import { MY_MAIL_REFUSAL_WORDS } from '../../../lib/myMail/contract'
import { FIRST_PAGE, MY_MAIL_LIST_WORDS, newerPage, olderPage, pageToken, taggedWords, untaggedWords, type MyMailPages } from '../../../lib/myMail/list'
import { supabaseMyMailIo, type MyMailIo } from '../../../lib/myMail/myMailIo'
import { MY_MAIL_READER_WORDS, unknownSenderContact } from '../../../lib/myMail/reader'
import { MY_MAIL_GUIDE, MY_MAIL_GUIDE_READS, MY_MAIL_SETTINGS_HREF, MY_MAIL_VIEWS } from '../../../lib/myMail/tab'
import { MY_MAIL_WORDS, viewRows } from '../../../lib/myMail/view'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../../lib/offlineRecoveryState'
import { formatErrorMessage } from '../../../utils/errorHandling'
import { EmptyState } from '../../EmptyState'
import OfflineRetryPanel from '../../OfflineRetryPanel'
import { JobPickerWindow } from '../../gc/messages/JobPickerWindow'
import type { MessagesWrites } from '../../gc/messages/messagesWrites'
import { WhoIsThisWindow } from '../../gc/messages/WhoIsThisWindow'
import { MyMailListRow } from './MyMailListRow'
import { MyMailReader } from './MyMailReader'

const W = MY_MAIL_LIST_WORDS


export interface MyMailTabProps {
  /** The four actions; the function's own when left out. A smoke hands in a fake. */
  io?: MyMailIo
  view: MyMailView
  onView: (view: MyMailView) => void
  /** The words searched, as the URL holds them. */
  q: string
  onQ: (q: string) => void
  /**
   * The person's switch: off draws the off line and reads nothing; undefined while it is read, and the tab waits;
   * null when it cannot be known, and the tab reads, the function deciding.
   */
  on: boolean | null | undefined
  phone: boolean
  /** The job picker's lists: their jobs first, then a search. From the page's view of Messages. */
  jobs: { theirs: (address: string) => readonly JobTile[]; search: (words: string) => Promise<JobTile[]> }
  /** Who is this?, for a sender a tag could not place. */
  writes: Pick<MessagesWrites, 'nameContact' | 'searchRecords'>
  /** The person a line sits on, from the page's view, for *open the thread ›*. */
  lineContact: (messageId: string) => string | null
  /** The page's thread window, over the tab. */
  onOpenThread: (contactId: string, messageId: string | null) => void
  /** A tag, an untag or a name changed the lines: the page reads its view again. */
  onChanged?: () => void
  /** The clock the rows' days read against. */
  nowIso?: string
}

type Answer = { kind: 'page'; page: MyMailListOk } | { kind: 'refused'; refusal: MyMailRefusal }

const chipButton = (on: boolean): CSSProperties => ({
  fontFamily: 'inherit',
  fontSize: '0.8rem',
  padding: '0.2rem 0.75rem',
  borderRadius: 999,
  border: `1px solid ${on ? 'var(--text-strong)' : 'var(--border-strong)'}`,
  background: on ? 'var(--text-strong)' : 'var(--surface)',
  color: on ? 'var(--surface)' : 'var(--text-600)',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
})
const quietPress: CSSProperties = { border: 0, background: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer' }
const calm: CSSProperties = { margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.85rem' }

/** A refusal as one calm line, in the function's words; the switch off carries its door to Your account. */
function RefusalLine({ words, error }: { words: string; error: string }) {
  return (
    <p data-my-mail-refusal={error} style={calm}>
      {words}
      {error === 'off' ? (
        <>
          {' '}
          <Link to={MY_MAIL_SETTINGS_HREF} style={{ color: 'var(--text-link)', fontWeight: 600 }}>
            {W.openSettings}
          </Link>
        </>
      ) : null}
    </p>
  )
}

export function MyMailTab({ io: ioProp, view, onView, q, onQ, on, phone, jobs, writes, lineContact, onOpenThread, onChanged, nowIso: nowProp }: MyMailTabProps) {
  const io = useMemo(() => ioProp ?? supabaseMyMailIo(), [ioProp])
  const { showToast } = useToastContext()
  const confirm = useConfirmDialog()
  const [nowIso] = useState(() => nowProp ?? new Date().toISOString())

  // The page of rows: Gmail's tokens walked so far, for this view and these words; a new view or new words start over.
  const key = `${view}|${q.trim()}`
  const [paging, setPaging] = useState<{ key: string; pages: MyMailPages }>({ key, pages: FIRST_PAGE })
  const pages = paging.key === key ? paging.pages : FIRST_PAGE
  const token = pageToken(pages)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [reading, setReading] = useState(false)
  const [tick, setTick] = useState(0)
  const reread = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (on === false || on === undefined) return
    let live = true
    setReading(true)
    const words = q.trim()
    io.list({ view, ...(words ? { q: words } : {}), pageToken: token })
      .then((a) => {
        if (!live) return
        setFailure(null)
        setAnswer(a.ok ? { kind: 'page', page: a } : { kind: 'refused', refusal: a })
      })
      .catch((e: unknown) => {
        if (live) setFailure(recoveryFailureFromError(e, W.notRead))
      })
      .finally(() => {
        if (live) setReading(false)
      })
    return () => {
      live = false
    }
  }, [io, on, view, q, token, tick])

  // The search box: typed words go to the URL after a pause, or at once on Enter; a link's words fill the box.
  const [words, setWords] = useState(q)
  const sent = useRef(q)
  useEffect(() => {
    if (q === sent.current) return
    sent.current = q
    setWords(q)
  }, [q])
  const send = useCallback(
    (next: string) => {
      sent.current = next
      onQ(next)
    },
    [onQ],
  )
  useEffect(() => {
    if (words === sent.current) return
    const t = window.setTimeout(() => send(words), 400)
    return () => window.clearTimeout(t)
  }, [words, send])

  const [showFolded, setShowFolded] = useState(false)
  const [readerRow, setReader] = useState<MyMailRow | null>(null)
  const [readKey, setReadKey] = useState(0)
  const [picker, setPicker] = useState<{ threadId: string; address: string } | null>(null)
  const [who, setWho] = useState<Contact | null>(null)
  const [busyThread, setBusyThread] = useState<string | null>(null)
  // One tag or untag at a time: a second press in the same moment waits on the first, not on the next render.
  const busy = useRef(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<Readonly<Record<string, { ok: MyMailTagOk; chip: MyMailJobChip | null }>>>({})

  const changed = () => {
    reread()
    setReadKey((k) => k + 1)
    onChanged?.()
  }

  const tagOnto = async (threadId: string, job: MyMailJobRef, chip: MyMailJobChip | null) => {
    if (busy.current) return
    busy.current = true
    setBusyThread(threadId)
    setProblem(null)
    try {
      const a = await io.tag({ threadId, job })
      if (!a.ok) {
        setProblem(a.words)
        return
      }
      setDone((d) => ({ ...d, [threadId]: { ok: a, chip } }))
      showToast(taggedWords(a, chip), 'success')
      if (a.unknownSender) setWho(unknownSenderContact(a.unknownSender))
      changed()
    } catch (e) {
      setProblem(formatErrorMessage(e, W.notTagged))
    } finally {
      busy.current = false
      setBusyThread(null)
    }
  }

  const untag = async (threadId: string) => {
    if (busy.current) return
    const yes = await confirm({ message: MY_MAIL_READER_WORDS.untagAsk, confirmLabel: MY_MAIL_READER_WORDS.untag, danger: true })
    if (!yes || busy.current) return
    busy.current = true
    setBusyThread(threadId)
    setProblem(null)
    try {
      const a = await io.untag({ threadId })
      if (!a.ok) {
        setProblem(a.words)
        return
      }
      setDone((d) => Object.fromEntries(Object.entries(d).filter(([t]) => t !== threadId)))
      showToast(untaggedWords(a), 'success')
      changed()
    } catch (e) {
      setProblem(formatErrorMessage(e, MY_MAIL_READER_WORDS.notUntagged))
    } finally {
      busy.current = false
      setBusyThread(null)
    }
  }

  const yes = (row: Pick<MyMailRow, 'threadId'>, guess: MyMailJobChip) => void tagOnto(row.threadId, { kind: guess.kind, id: guess.id }, guess)
  const pick = (row: Pick<MyMailRow, 'threadId' | 'who'>) => setPicker({ threadId: row.threadId, address: row.who.address })
  const openThread = (contactId: string, messageId: string | null) => {
    setReader(null)
    onOpenThread(contactId, messageId)
  }
  const clearSearch = () => {
    setWords('')
    send('')
  }

  if (on === false) {
    return (
      <section aria-label="My email" data-testid="my-mail-tab" style={{ display: 'grid', gap: '0.6rem' }}>
        <RefusalLine words={MY_MAIL_REFUSAL_WORDS.off} error="off" />
      </section>
    )
  }

  const page = answer?.kind === 'page' ? answer.page : null
  const shown = page ? viewRows(page.rows, view) : null
  const empty = MY_MAIL_WORDS.empty(view, q)
  const emptyPress = q.trim() ? { onPress: clearSearch } : view === 'tagged' ? { onPress: () => onView('toTag') } : { to: MY_MAIL_SETTINGS_HREF }
  const row = (r: MyMailRow, dim = false) => (
    <MyMailListRow
      key={r.gmailId}
      row={r}
      phone={phone}
      nowIso={nowIso}
      busy={busyThread === r.threadId}
      dim={dim}
      onOpen={() => setReader(r)}
      onYes={() => r.guess && yes(r, r.guess)}
      onPick={() => pick(r)}
    />
  )

  return (
    <section aria-label="My email" data-testid="my-mail-tab" style={{ display: 'grid', gap: '0.6rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div role="group" aria-label={W.views} style={{ display: 'inline-flex', gap: '0.3rem' }}>
          {MY_MAIL_VIEWS.map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => onView(v)} style={chipButton(view === v)}>
              {MY_MAIL_WORDS.views[v]}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={words}
          onChange={(e) => setWords(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send(words)
          }}
          aria-label={W.search}
          placeholder={W.searchHint}
          data-testid="my-mail-search"
          style={{ flex: '1 1 180px', minWidth: 0, maxWidth: 420, padding: '0.4rem 0.7rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontSize: '0.875rem' }}
        />
      </div>

      {page ? (
        <p data-my-mail-words style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {MY_MAIL_WORDS.card(page.address)}{' '}
          <Link to={helpGuideHref(MY_MAIL_GUIDE, MY_MAIL_GUIDE_READS)} style={{ color: 'var(--text-link)', fontWeight: 600 }}>
            {W.whatItReads}
          </Link>
        </p>
      ) : null}

      {problem && !readerRow ? (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
          {problem}
        </div>
      ) : null}

      {failure ? <OfflineRetryPanel failure={failure} onRetry={reread} surface="my-email" idempotent busy={reading} offlineMessage={W.offline} /> : null}
      {!failure && answer?.kind === 'refused' ? <RefusalLine words={answer.refusal.words} error={answer.refusal.error} /> : null}
      {!failure && !answer && (reading || on === undefined) ? <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>{W.reading}</p> : null}

      {!failure && page && shown ? (
        <div data-testid="my-mail-list" style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
          {shown.rows.length === 0 ? <EmptyState {...emptyWordsWithPress(empty, emptyPress)} compact /> : <div style={{ marginTop: -1 }}>{shown.rows.map((r) => row(r))}</div>}
          {shown.folded.length > 0 ? (
            <>
              <div data-my-mail-fold style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', padding: '0.5rem 0.7rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                <span aria-hidden>·</span>
                <span>{MY_MAIL_WORDS.fold(shown.folded.length)}</span>
                <button type="button" aria-expanded={showFolded} onClick={() => setShowFolded((s) => !s)} style={{ ...quietPress, marginLeft: 'auto' }}>
                  {showFolded ? W.hide : W.show}
                </button>
              </div>
              {showFolded ? shown.folded.map((r) => row(r, true)) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {!failure && page && (pages.length > 1 || page.nextPageToken) ? (
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', fontSize: '0.85rem' }}>
          {pages.length > 1 ? (
            <button type="button" onClick={() => setPaging({ key, pages: newerPage(pages) })} style={quietPress}>
              {W.newer}
            </button>
          ) : null}
          {page.nextPageToken ? (
            <button type="button" onClick={() => page.nextPageToken && setPaging({ key, pages: olderPage(pages, page.nextPageToken) })} style={quietPress}>
              {W.older}
            </button>
          ) : null}
        </div>
      ) : null}

      {readerRow ? (
        <MyMailReader
          io={io}
          row={readerRow}
          address={page?.address ?? ''}
          phone={phone}
          readKey={readKey}
          done={done[readerRow.threadId] ?? null}
          busy={busyThread === readerRow.threadId}
          problem={problem}
          onYes={(guess) => yes(readerRow, guess)}
          onPick={() => pick(readerRow)}
          onUntag={() => void untag(readerRow.threadId)}
          lineContact={lineContact}
          onOpenThread={openThread}
          onClose={() => {
            setReader(null)
            setProblem(null)
          }}
        />
      ) : null}
      {picker ? (
        <JobPickerWindow
          title={MY_MAIL_READER_WORDS.pickTitle}
          theirs={jobs.theirs(picker.address)}
          searchJobs={jobs.search}
          onPick={(jobKey) => {
            const p = picker
            setPicker(null)
            const ref = jobRefOf(jobKey)
            if (!ref) return
            const tile = jobs.theirs(p.address).find((t) => t.key === jobKey)
            void tagOnto(p.threadId, ref, tile ? { ...ref, key: tile.key, num: tile.num, name: tile.name } : null)
          }}
          onClose={() => setPicker(null)}
        />
      ) : null}
      {who ? (
        <WhoIsThisWindow
          contact={who}
          writes={writes}
          onNamed={() => {
            setWho(null)
            changed()
          }}
          onClose={() => setWho(null)}
        />
      ) : null}
    </section>
  )
}
