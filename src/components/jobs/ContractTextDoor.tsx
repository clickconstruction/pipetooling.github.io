/**
 * The Contract window's text door through the company number (punch list #125 PR 5, v2.6700): **Text the link** in the
 * Nudge group, **Text link** on the signed rail and the rail's phone-only **Text the link** open this in place of an `sms:`
 * on the person's own phone. It is the customer's box (`JobCustomerBox` over `ReplyBox`) on Text, tied to the job, with
 * the agreement's words and the link filled, under a head that names the act; the box's send window is the confirm, and
 * its holds (Send texts off, STOP, a prospect not asked, texts paused) say why in the box's own words. Nothing is sent
 * in the press. **Copy link** sits in the head for when the text cannot go.
 *
 * The window's number (`typedPhone`) decides who the box texts (`contractTextDoor.ts`): on the contact, the box leads
 * with it; not on the contact, the owner's chip (2026-11-08, question 5) adds it as a text channel in one tap
 * (`addContactPhone`), with the numbers already on file offered beside it. Nothing is added by a read.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { firstName, type Contact, type ContactChannel } from '../../lib/contacts/kernel'
import { addNumberChipWords, addNumberNote, contactLeadingWith, numberAddedWords, textDoorNumber, textOnFileWords } from '../../lib/jobs/contractTextDoor'
import { NO_CUSTOMER_WORDS } from '../../lib/messages/jobBox'
import { addContactPhone, loadCustomerContact } from '../../lib/messages/messagesIo'
import type { ReplyIo } from '../../lib/messages/replyIo'
import type { QuickRepliesIo } from '../../lib/quickReplies/quickRepliesIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { JobCustomerBox } from './JobCustomerBox'

export interface ContractTextDoorProps {
  /** The head: *Text the signing link*, *Text the signed agreement*. */
  title: string
  jobId: string
  jobName: string
  jobStatus: string | null
  /** The job's customer. Null: the job has none yet, and the door says so. */
  customerId: string | null
  /** The window's number: typed in the rail, or the job's customer phone. '' lets the box pick theirs. */
  typedPhone: string
  /** The words the box opens with, the link in them. */
  words: string
  onClose: () => void
  /** The text went: the window reads again. */
  onSent?: () => void
  /** Copy link, for when the text cannot go; left out, the head has no copy press. */
  onCopyLink?: () => void
  /** For a smoke: the customer's contact, the add, and the box's sends and quick replies. */
  load?: (customerId: string) => Promise<Contact>
  addNumber?: (contactId: string, value: string) => Promise<ContactChannel>
  io?: ReplyIo
  quickIo?: QuickRepliesIo
}

const quiet: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }
const panel: CSSProperties = { border: '1.5px solid var(--text-orange-700)', borderRadius: 10, background: 'var(--surface)', padding: '0.5rem 0.65rem', display: 'grid', gap: 6 }
const headRow: CSSProperties = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' }
const headWords: CSSProperties = { fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-orange-700)' }
const quietPress: CSSProperties = { background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.75rem', color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer' }
const chip: CSSProperties = { padding: '0.3rem 0.7rem', borderRadius: 999, border: '1px solid var(--border-orange)', background: 'var(--bg-orange-tint)', color: 'var(--text-orange-700)', font: 'inherit', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }

export function ContractTextDoor({ title, jobId, jobName, jobStatus, customerId, typedPhone, words, onClose, onSent, onCopyLink, load = loadCustomerContact, addNumber = addContactPhone, io, quickIo }: ContractTextDoorProps) {
  const { showToast } = useToastContext()
  const [read, setRead] = useState<{ customerId: string; contact: Contact | null; problem: string | null } | null>(null)
  /** The channel the box leads with: the typed number once it is on the contact, or a number on file the person chose. */
  const [lead, setLead] = useState<ContactChannel | null>(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!customerId) return
    let live = true
    setLead(null)
    load(customerId).then(
      (contact) => live && setRead({ customerId, contact, problem: null }),
      (e: unknown) => live && setRead({ customerId, contact: null, problem: formatErrorMessage(e, 'Their messages could not be opened.') }),
    )
    return () => {
      live = false
    }
  }, [customerId, load])

  const got = read && read.customerId === customerId ? read : null
  const contact = got?.contact ?? null
  const number = useMemo(() => (contact ? textDoorNumber(contact, typedPhone) : null), [contact, typedPhone])
  const leadId = lead?.id ?? (number?.kind === 'onFile' ? number.channel.id : null)
  const boxContact = useMemo(() => (contact ? contactLeadingWith(contact, leadId) : null), [contact, leadId])
  const loadForBox = useCallback(async () => {
    if (!boxContact) throw new Error('Their messages could not be opened.')
    return boxContact
  }, [boxContact])

  const add = async () => {
    if (!contact || number?.kind !== 'notOnFile' || adding) return
    setAdding(true)
    try {
      const channel = await addNumber(contact.id, number.typed)
      setRead({ customerId: contact.customerId ?? customerId ?? '', contact: { ...contact, channels: [...contact.channels.filter((ch) => ch.id !== channel.id), channel] }, problem: null })
      setLead(channel)
      showToast(numberAddedWords(firstName(contact) || contact.name, number.typed), 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'The number was not added.'), 'error')
    } finally {
      setAdding(false)
    }
  }

  const head = (
    <div style={headRow}>
      <span style={headWords}>{title}</span>
      <span style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline' }}>
        {onCopyLink ? (
          <button type="button" style={quietPress} onClick={onCopyLink} data-testid="contract-text-door-copy">
            Copy link
          </button>
        ) : null}
        <button type="button" onClick={onClose} aria-label="Close the text" title="Close the text" style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: '0.875rem', cursor: 'pointer', padding: '0 4px' }}>
          ✕
        </button>
      </span>
    </div>
  )

  let body: React.ReactNode
  if (!customerId) body = <p role="status" style={quiet}>{NO_CUSTOMER_WORDS}</p>
  else if (!got) body = <p style={quiet}>Opening their messages…</p>
  else if (!contact || !number) body = <p role="alert" style={{ ...quiet, color: 'var(--text-red-700)' }}>{got.problem ?? 'Their messages could not be opened.'}</p>
  else if (number.kind === 'notOnFile' && !lead) {
    const first = firstName(contact) || contact.name
    body = (
      <div style={{ display: 'grid', gap: 6 }} data-testid="contract-text-door-add">
        <p style={quiet}>{addNumberNote(first, number.typed)}</p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" style={{ ...chip, opacity: adding ? 0.6 : 1 }} disabled={adding} onClick={() => void add()}>
            {adding ? 'Adding…' : addNumberChipWords(first, number.typed)}
          </button>
          {number.onFile.map((ch) => (
            <button key={ch.id} type="button" style={quietPress} onClick={() => setLead(ch)}>
              {textOnFileWords(ch)}
            </button>
          ))}
        </div>
      </div>
    )
  } else {
    body = <JobCustomerBox kind="text" jobId={jobId} jobName={jobName} customerId={customerId} jobStatus={jobStatus} startWords={words} load={loadForBox} onSent={onSent} io={io} quickIo={quickIo} />
  }

  return (
    <div style={panel} data-testid="contract-text-door">
      {head}
      {body}
    </div>
  )
}
