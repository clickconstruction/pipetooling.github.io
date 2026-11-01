/**
 * Messages → My email (punch list #230 PR 3): the reader, one mail of the person's own box read whole for this screen
 * and kept nowhere (the mock-up's section 2). A window on a desk and a sheet from the bottom on a phone (`PhoneSheet`).
 * The bar at the top says what the conversation is to the app: the guess with **Yes**, **Another job…** and why; no
 * guess and **Tag…**; *Already in Messages ✓* for a mail a box holds on a job; or, once tagged, the green bar with the
 * job, what the tag put on it, *open the thread ›* and **Untag**. Then how many mails the conversation holds, From, To,
 * Cc and When, the words as the thread's email line draws them (`myMail/reader.ts`'s `readerBody`: the HTML read as
 * text, never drawn as HTML), the files, and the foot: *Reply in Gmail ↗* and *Nothing here replies, archives or marks
 * read.* The presses are the tab's (`MyMailTab`): this window only says what to do.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { MyMailJobChip, MyMailRefusal, MyMailRow, MyMailTagOk } from '../../../lib/myMail/contract'
import { chipWords, MY_MAIL_LIST_WORDS, onTheJobWords } from '../../../lib/myMail/list'
import type { MyMailIo } from '../../../lib/myMail/myMailIo'
import { canUntag, fileWords, fromWords, MY_MAIL_READER_WORDS, partiesWords, readerBody, threadCountWords, type MyMailOpened } from '../../../lib/myMail/reader'
import { gmailThreadHref } from '../../../lib/myMail/tab'
import { fullWhen } from '../../../lib/messages/thread'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../../lib/offlineRecoveryState'
import OfflineRetryPanel from '../../OfflineRetryPanel'
import { PhoneSheet } from '../../PhoneSheet'
import { Btn } from '../../gc/gcUi'
import { chipStyle, mutedSmall } from './myMailStyles'

const W = MY_MAIL_READER_WORDS

export interface MyMailReaderProps {
  io: MyMailIo
  /** The row the person opened: its subject heads the window while the mail is read. */
  row: MyMailRow
  /** The person's own address, for the door to Gmail. */
  address: string
  phone: boolean
  /** Read the mail again when this changes: the tab bumps it after a tag or an untag. */
  readKey: number
  /** This sitting's tag of the conversation: the answer, and the job's chip when the press knew it. */
  done: { ok: MyMailTagOk; chip: MyMailJobChip | null } | null
  /** The conversation is being tagged or untagged. */
  busy: boolean
  /** Why the last tag or untag did not go, in words. */
  problem: string | null
  onYes: (guess: MyMailJobChip) => void
  onPick: () => void
  onUntag: () => void
  /** The person a line sits on, from the page's view of Messages. */
  lineContact: (messageId: string) => string | null
  onOpenThread: (contactId: string, messageId: string | null) => void
  onClose: () => void
}

const barStyle = (background: string): CSSProperties => ({
  display: 'flex',
  gap: '0.45rem',
  alignItems: 'center',
  flexWrap: 'wrap',
  padding: '0.55rem 1rem',
  background,
  borderBottom: '1px solid var(--border)',
  fontSize: '0.85rem',
  flex: 'none',
})

/** What the conversation is to the app, with its presses. */
function Bar({ mail, done, busy, phone, contactId, lineId, onYes, onPick, onUntag, onOpenThread }: Pick<MyMailReaderProps, 'done' | 'busy' | 'phone' | 'onYes' | 'onPick' | 'onUntag' | 'onOpenThread'> & { mail: MyMailOpened; contactId: string | null; lineId: string | null }) {
  const presses = (nodes: ReactNode) => (busy ? <span style={mutedSmall}>{MY_MAIL_LIST_WORDS.tagging}</span> : nodes)
  const thread = contactId ? (
    <Btn kind="quiet" onClick={() => onOpenThread(contactId, lineId)}>
      {W.openThread}
    </Btn>
  ) : null
  if (mail.tagged || done) {
    const chip = mail.tagged ?? done?.chip ?? null
    const untag = mail.tagged ? canUntag(mail) : true
    return (
      <div data-my-mail-bar="tagged" style={barStyle('var(--bg-green-tint)')}>
        <span style={{ fontWeight: 700, color: 'var(--text-green-700)' }}>{W.on}</span>
        <span style={chipStyle(chip, true)}>{chip ? chipWords(chip) : W.onTheJob}</span>
        {done ? <span style={mutedSmall}>{onTheJobWords(done.ok)}</span> : null}
        {thread}
        {untag
          ? presses(
              <Btn kind="quiet" onClick={onUntag}>
                {W.untag}
              </Btn>,
            )
          : null}
      </div>
    )
  }
  if (mail.inMessages?.jobKey) {
    return (
      <div data-my-mail-bar="in-messages" style={barStyle('var(--bg-subtle)')}>
        <span style={{ fontWeight: 700 }}>{W.inMessages}</span>
        <span style={mutedSmall}>{W.inMessagesWhy}</span>
        {thread}
        {presses(<Btn onClick={onPick}>{W.tagTheRest}</Btn>)}
      </div>
    )
  }
  const guess = mail.guess
  if (guess) {
    return (
      <div data-my-mail-bar="guess" style={barStyle('var(--bg-blue-tint)')}>
        {phone ? null : <span>{W.tagOnto}</span>}
        <span style={chipStyle(guess)}>
          {chipWords(guess)}
          {phone ? '?' : ''}
        </span>
        {presses(
          <>
            <Btn kind="primary" onClick={() => onYes(guess)} title={guess.why}>
              {W.yes}
            </Btn>
            <Btn onClick={onPick}>{W.another}</Btn>
          </>,
        )}
        <span style={mutedSmall}>{guess.why}</span>
      </div>
    )
  }
  return (
    <div data-my-mail-bar="tag" style={barStyle('var(--bg-blue-tint)')}>
      <span>{W.tagOntoAJob}</span>
      {presses(
        <Btn kind="primary" onClick={onPick}>
          {W.tag}
        </Btn>,
      )}
    </div>
  )
}

export function MyMailReader({ io, row, address, phone, readKey, done, busy, problem, onYes, onPick, onUntag, lineContact, onOpenThread, onClose }: MyMailReaderProps) {
  const [mail, setMail] = useState<MyMailOpened | null>(null)
  const [refusal, setRefusal] = useState<MyMailRefusal | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [reading, setReading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let live = true
    setReading(true)
    io.open({ gmailId: row.gmailId })
      .then((answer) => {
        if (!live) return
        setFailure(null)
        if (answer.ok) {
          setMail(answer.mail)
          setRefusal(null)
        } else setRefusal(answer)
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
  }, [io, row.gmailId, readKey, tick])

  const subject = mail?.subject ?? row.subject
  const lineId = mail?.tagged?.messageId ?? mail?.inMessages?.messageId ?? null
  const contactId = done?.ok.contactId ?? (lineId ? lineContact(lineId) : null)

  return (
    <PhoneSheet label={subject} title={subject} width={720} dataAttrs={{ 'data-my-mail-reader': row.gmailId }} onClose={onClose}>
      {mail ? <Bar mail={mail} done={done} busy={busy} phone={phone} contactId={contactId} lineId={lineId} onYes={onYes} onPick={onPick} onUntag={onUntag} onOpenThread={onOpenThread} /> : null}
      {problem ? (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem', padding: '0.45rem 1rem 0', flex: 'none' }}>
          {problem}
        </div>
      ) : null}
      <div style={{ padding: '0.8rem 1rem', overflowY: 'auto', display: 'grid', gap: '0.75rem', alignContent: 'start' }}>
        {failure ? <OfflineRetryPanel failure={failure} onRetry={() => setTick((t) => t + 1)} surface="my-email-reader" idempotent busy={reading} offlineMessage={W.offline} /> : null}
        {refusal && !failure ? (
          <p data-my-mail-refusal={refusal.error} style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {refusal.words}
          </p>
        ) : null}
        {!mail && reading && !failure ? <p style={{ ...mutedSmall, margin: 0, fontSize: '0.85rem' }}>{W.reading}</p> : null}
        {mail ? (
          <>
            <span style={{ ...mutedSmall, justifySelf: 'start', border: '1px solid var(--border-strong)', borderRadius: 999, padding: '0.1rem 0.6rem' }}>{threadCountWords(mail.threadCount)}</span>
            <dl style={{ display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr)', gap: '0.2rem 0.75rem', margin: 0, fontSize: '0.85rem' }}>
              <dt style={{ color: 'var(--text-muted)' }}>{W.from}</dt>
              <dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{fromWords(mail, address)}</dd>
              {mail.to.length > 0 ? (
                <>
                  <dt style={{ color: 'var(--text-muted)' }}>{W.to}</dt>
                  <dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{partiesWords(mail.to)}</dd>
                </>
              ) : null}
              {mail.cc.length > 0 ? (
                <>
                  <dt style={{ color: 'var(--text-muted)' }}>{W.cc}</dt>
                  <dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{partiesWords(mail.cc)}</dd>
                </>
              ) : null}
              <dt style={{ color: 'var(--text-muted)' }}>{W.when}</dt>
              <dd style={{ margin: 0 }}>{fullWhen(mail.at)}</dd>
            </dl>
            <div data-my-mail-body style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: '0.9rem', lineHeight: 1.5 }}>
              {readerBody(mail)}
            </div>
            {mail.fileList.length > 0 ? (
              <div role="group" aria-label={W.files} style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {mail.fileList.map((f, i) => (
                  <span key={`${f.name}-${i}`} data-my-mail-file style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)' }}>
                    📎 {fileWords(f)}
                  </span>
                ))}
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'baseline', borderTop: '1px solid var(--border)', paddingTop: '0.6rem', ...mutedSmall, fontSize: '0.8rem' }}>
              <a href={gmailThreadHref(address, mail.threadId)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', fontWeight: 600, textDecoration: 'none' }}>
                {W.replyInGmail}
              </a>
              <span>{W.nothingHere}</span>
            </div>
          </>
        ) : null}
      </div>
    </PhoneSheet>
  )
}
