import { useEffect, useMemo, useRef, useState } from 'react'

import { COMPANY_EMAIL_FROM_LABEL } from '../../lib/customerEmailFrom'
import { parseCcEmails, toggleCcEmailInText } from '../../lib/gcStatementCc'
import {
  RECIPIENT_GROUP_LABELS,
  ccAddRefusal,
  filterRecipientPeople,
  lockedCopyEmail,
  personForEmail,
  recipientReadback,
  recipientRowsForLine,
  replyTakers,
  typedAddressOffer,
  withTypedAddress,
  type RecipientGroup,
  type RecipientPerson,
  type RecipientUser,
} from '../../lib/gcStatementRecipients'

type Line = 'to' | 'cc' | 'reply'

/**
 * The statement email's header, read like the email it becomes (v2.4262):
 * From · To · Cc · Reply to · Subject, each person a named token with the
 * address beside it, and one menu under whichever line opened it — the GC's
 * people first, then the office; a dot where one is picked (To, Reply to), a
 * tick where several can be (Cc); a whole address typed in the search box
 * gets a *Use …* row. The sender's copy that the reply choice adds at send
 * shows on the Cc line, held, so what will happen is what is drawn. The
 * state is the parent's — one To address, the Cc as text, a reply-to user
 * id — exactly what the send functions take.
 */
export function StatementRecipientHeader({
  people,
  users,
  me,
  accountManId,
  toEmail,
  onToChange,
  ccText,
  onCcTextChange,
  replyToUserId,
  onReplyToChange,
  subject,
  onSubjectChange,
  scheduled,
  disabled,
}: {
  /** Everyone the menu offers (`buildRecipientPeople`). */
  people: readonly RecipientPerson[]
  users: readonly RecipientUser[]
  /** The signed-in sender; null while the session is unknown (then the reply line is not drawn). */
  me: RecipientUser | null
  accountManId: string | null
  toEmail: string
  onToChange: (email: string) => void
  ccText: string
  onCcTextChange: (text: string) => void
  replyToUserId: string
  onReplyToChange: (userId: string) => void
  subject: string
  onSubjectChange: (subject: string) => void
  scheduled: boolean
  disabled?: boolean
}) {
  const [open, setOpen] = useState<Line | null>(null)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [typed, setTyped] = useState<string[]>([])
  const searchRef = useRef<HTMLInputElement | null>(null)

  const menuPeople = useMemo(() => typed.reduce<RecipientPerson[]>((acc, e) => withTypedAddress(acc, e), [...people]), [people, typed])
  const cc = parseCcEmails(ccText, toEmail)
  const takers = useMemo(() => (me ? replyTakers(users, me.id) : []), [users, me])
  const replyPerson = useMemo(() => (scheduled ? me : (takers.find((u) => u.id === replyToUserId) ?? me)), [scheduled, me, takers, replyToUserId])
  const locked = me ? lockedCopyEmail({ sender: me, replyToPerson: replyPerson, toEmail, ccEmails: cc.emails }) : null
  const toPerson = personForEmail(menuPeople, toEmail)
  const ccPeople = cc.emails.map((e) => personForEmail(menuPeople, e)).filter((p): p is RecipientPerson => p != null)
  const replyIsMe = !me || !replyPerson || replyPerson.id === me.id

  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(null)
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open])

  const toggleLine = (line: Line) => {
    setNotice(null)
    setQuery('')
    setOpen((cur) => (cur === line ? null : line))
  }
  const pick = (line: Line, person: RecipientPerson) => {
    setNotice(null)
    if (line === 'to') {
      onToChange(person.email)
      if (cc.emails.includes(person.email)) onCcTextChange(toggleCcEmailInText(ccText, person.email))
      setOpen(null)
      return
    }
    if (line === 'cc') {
      if (cc.emails.includes(person.email)) {
        onCcTextChange(toggleCcEmailInText(ccText, person.email))
        return
      }
      const refusal = ccAddRefusal(cc.emails.length)
      if (refusal) {
        setNotice(refusal)
        return
      }
      onCcTextChange(toggleCcEmailInText(ccText, person.email))
      setQuery('')
      return
    }
    if (person.userId) {
      onReplyToChange(person.userId)
      setOpen(null)
    }
  }
  const takeTyped = (line: Line, email: string) => {
    setTyped((cur) => (cur.includes(email) ? cur : [...cur, email]))
    pick(line, { email, name: email, group: 'typed' })
  }

  const renderMenu = (line: 'to' | 'cc') => {
    const rows = recipientRowsForLine(line, filterRecipientPeople(menuPeople, query), { toEmail, ccEmails: cc.emails, lockedCopyEmail: locked })
    const offer = typedAddressOffer(menuPeople, query)
    const groups: RecipientGroup[] = ['gc', 'office', 'typed']
    const gcName = people.find((p) => p.group === 'gc')?.name ?? 'the GC'
    const multi = line === 'cc'
    return (
      <div className="rcpMenu" role="listbox" aria-label={line === 'to' ? 'Who gets the statement' : 'Who is copied'} aria-multiselectable={multi}>
        <div className="rcpMenuTop">
          <input
            ref={searchRef}
            id={`rcp-search-${line}`}
            className="rcpSearch"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setNotice(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && offer) {
                e.preventDefault()
                takeTyped(line, offer)
              }
            }}
            placeholder="Search a name or type an address"
            aria-label="Search a name or type an address"
            autoComplete="off"
            disabled={disabled}
          />
          <button type="button" className="rcpDone" onClick={() => setOpen(null)}>
            Done
          </button>
        </div>
        {groups.map((g) => {
          const inGroup = rows.filter((r) => r.person.group === g)
          if (!inGroup.length) return null
          return (
            <div key={g}>
              <div className="rcpGroup">{RECIPIENT_GROUP_LABELS[g](gcName)}</div>
              {inGroup.map(({ person, picked, held }) => (
                <button
                  key={person.email}
                  type="button"
                  role="option"
                  aria-selected={picked}
                  className={`rcpRow${picked ? ' on' : ''}`}
                  disabled={disabled || held != null}
                  onClick={() => pick(line, person)}
                  title={held ?? undefined}
                  aria-label={`${person.tag === 'you' ? `${person.name} (you)` : person.name}, ${person.email}${held ? `, ${held}` : person.tag && person.tag !== 'you' ? `, ${person.tag}` : ''}`}
                >
                  <span className={`rcpMark ${multi ? 'check' : 'radio'}${picked ? ' on' : ''}`} aria-hidden="true">
                    {picked && multi ? '✓' : ''}
                  </span>
                  <span className="rcpWho">
                    <b>{person.tag === 'you' ? `${person.name} (you)` : person.name}</b>
                    <span className="rcpAddr">{person.email}</span>
                  </span>
                  {held ? <span className="rcpTag">{held}</span> : person.tag && person.tag !== 'you' ? <span className={`rcpTag${person.tag === 'account man' ? ' strong' : ''}`}>{person.tag}</span> : <span />}
                </button>
              ))}
            </div>
          )
        })}
        {offer ? (
          <div>
            <div className="rcpGroup">Any address</div>
            <button type="button" role="option" aria-selected={false} className="rcpRow" onClick={() => takeTyped(line, offer)} disabled={disabled} aria-label={`Use ${offer}`}>
              <span className={`rcpMark ${multi ? 'check' : 'radio'}`} aria-hidden="true" />
              <span className="rcpWho">
                <b>Use {offer}</b>
              </span>
              <span className="rcpTag">typed</span>
            </button>
          </div>
        ) : null}
        {!rows.length && !offer ? <div className="rcpNone">No one by that name. Type a whole address to use it.</div> : null}
        {notice ? (
          <div className="rcpNone" role="status">
            {notice}
          </div>
        ) : null}
      </div>
    )
  }

  const renderReplyMenu = () => {
    if (!me) return null
    return (
      <div className="rcpMenu" role="listbox" aria-label="Who takes the reply">
        <div className="rcpGroup">Who takes the reply</div>
        {takers.map((u) => {
          const picked = (replyPerson?.id ?? me.id) === u.id
          const isMe = u.id === me.id
          return (
            <button
              key={u.id}
              type="button"
              role="option"
              aria-selected={picked}
              className={`rcpRow${picked ? ' on' : ''}`}
              disabled={disabled}
              onClick={() => {
                onReplyToChange(u.id)
                setOpen(null)
              }}
              aria-label={`${isMe ? `${u.name} (you)` : u.name}: ${isMe ? 'their reply comes to you' : `their reply goes to ${u.name}, you get a copy`}${u.id === accountManId ? ', account man' : ''}`}
            >
              <span className={`rcpMark radio${picked ? ' on' : ''}`} aria-hidden="true" />
              <span className="rcpWho">
                <b>{isMe ? `${u.name} (you)` : u.name}</b>
                <span className="rcpNote">{isMe ? 'Their reply comes to you.' : `Their reply goes to ${u.name}. You get a copy.`}</span>
              </span>
              {u.id === accountManId ? <span className="rcpTag strong">account man</span> : <span />}
            </button>
          )
        })}
      </div>
    )
  }

  const readback = recipientReadback({
    toName: toPerson?.name ?? null,
    replyToName: replyPerson?.name ?? me?.name ?? '',
    replyIsMe,
    ccNames: ccPeople.map((p) => p.name),
    copiesMe: locked != null,
    scheduled,
  })
  const replyLabel = replyPerson ? (replyPerson.id === me?.id ? `${replyPerson.name} (you)` : replyPerson.name) : ''

  return (
    <div>
      <div className="rcpHdr">
        <div className="rcpLine">
          <span className="rcpKey">From</span>
          <span className="rcpVal rcpFrom">
            {COMPANY_EMAIL_FROM_LABEL.replace(/\s*<.*$/, '')} <span className="rcpHint">· the name the GC sees</span>
          </span>
        </div>
        <div className="rcpLine">
          <span className="rcpKey" id="rcp-to-label">
            To
          </span>
          <span className="rcpVal" aria-labelledby="rcp-to-label">
            {toPerson ? (
              <span className="rcpTok">
                <span className="rcpTokName">{toPerson.tag === 'you' ? `${toPerson.name} (you)` : toPerson.name}</span>
                {toPerson.name !== toPerson.email ? <span className="rcpTokAddr">{toPerson.email}</span> : null}
                <button type="button" className="rcpTokX" onClick={() => onToChange('')} disabled={disabled} aria-label={`Remove ${toPerson.name} from To`}>
                  ×
                </button>
              </span>
            ) : null}
            <button type="button" className="rcpAdd" onClick={() => toggleLine('to')} disabled={disabled} aria-expanded={open === 'to'}>
              {toPerson ? 'Change' : '+ Pick who gets it'}
            </button>
          </span>
          {open === 'to' ? renderMenu('to') : null}
        </div>
        <div className="rcpLine">
          <span className="rcpKey" id="rcp-cc-label">
            Cc
          </span>
          <span className="rcpVal" aria-labelledby="rcp-cc-label">
            {ccPeople.map((p) => (
              <span key={p.email} className="rcpTok">
                <span className="rcpTokName">{p.tag === 'you' ? `${p.name} (you)` : p.name}</span>
                {p.name !== p.email ? <span className="rcpTokAddr">{p.email}</span> : null}
                <button type="button" className="rcpTokX" onClick={() => onCcTextChange(toggleCcEmailInText(ccText, p.email))} disabled={disabled} aria-label={`Remove ${p.name} from Cc`}>
                  ×
                </button>
              </span>
            ))}
            {locked && me ? (
              <>
                <span className="rcpTok held" title={`You are copied because replies go to ${replyPerson?.name ?? ''}.`}>
                  <span className="rcpTokName">{me.name} (you)</span>
                </span>
                <span className="rcpHint">copied, since replies go to {replyPerson?.name ?? ''}</span>
              </>
            ) : null}
            <button type="button" className="rcpAdd" onClick={() => toggleLine('cc')} disabled={disabled} aria-expanded={open === 'cc'}>
              + Add
            </button>
          </span>
          {open === 'cc' ? renderMenu('cc') : null}
        </div>
        {me && takers.length > 1 ? (
          <div className={`rcpLine${scheduled ? ' off' : ''}`}>
            <span className="rcpKey">Reply to</span>
            <span className="rcpVal">
              <button type="button" className="rcpTok rcpOpener" onClick={() => toggleLine('reply')} disabled={disabled || scheduled} aria-expanded={open === 'reply'} aria-label={`Reply to: ${replyLabel}`}>
                <span className="rcpTokName">{replyLabel}</span>
                {replyPerson?.id === accountManId ? <span className="rcpTokAddr rcpTokWord">account man</span> : null}
                <span className="rcpCaret" aria-hidden="true">
                  ▾
                </span>
              </button>
              {scheduled ? <span className="rcpHint">A scheduled send replies to whoever scheduled it.</span> : null}
            </span>
            {open === 'reply' && !scheduled ? renderReplyMenu() : null}
          </div>
        ) : null}
        <div className={`rcpLine${scheduled ? ' off' : ''}`}>
          <label className="rcpKey" htmlFor="gc-email-subject">
            Subject
          </label>
          <span className="rcpVal">
            <input id="gc-email-subject" className="rcpSubject" type="text" value={subject} onChange={(e) => onSubjectChange(e.target.value)} disabled={disabled || scheduled} />
            {scheduled ? <span className="rcpHint">Scheduled sends use the standard subject.</span> : null}
          </span>
        </div>
      </div>
      <p className="rcpReadback" role="status" data-testid="rcp-readback">
        {readback}
      </p>
    </div>
  )
}
