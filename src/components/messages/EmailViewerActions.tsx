/**
 * Messages, the email viewer's action row (v2.6509): the presses the kernel (`emailViewerActions.ts`) offers on a line
 * besides cut 4b's change order, drawn in the message window's first slot before Copy, Print and Share. **Start a bid**
 * opens its panel under the tools, the New lane's *Bid it?* card's own pieces (the bid's name, the contact's customer
 * or the customers the sender may be, or a new customer made by the press), then `start_bid_from_message` and the Bid
 * Board on the bid. **Put it on a bid…** opens the window's job picker over the open bids alone; the pick ties the
 * line through the Tied to row's own writer and writes one line on the bid's log, so the bid's history says it came in
 * from here too. **Open the bid** opens the bid the line is on.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Contact } from '../../lib/contacts/kernel'
import { samePerson } from '../../lib/followUp/customerLink'
import { bidCustomerChoices, companyFromDomain, senderFacts, START_BID_WORDS, type BidCustomerChoice, type WhoKnown } from '../../lib/followUp/newLane'
import { startedBidWords } from '../../lib/followUp/newLaneRows'
import type { Invitation } from '../../lib/emailIn/invitation'
import { putOnBidLogLine, putOnBidWords, startBidName, VIEWER_PRESS_WORDS, type ViewerPress } from '../../lib/messages/emailViewerActions'
import type { EmailViewerIo } from '../../lib/messages/emailViewerActionsIo'
import { jobRefOf } from '../../lib/messages/jobKeys'
import type { JobTile } from '../../lib/messages/jobTiles'
import type { ThreadMessage } from '../../lib/messages/thread'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { formatErrorMessage } from '../../utils/errorHandling'
import { Btn, input } from '../gc/gcUi'
import { JobPickerWindow } from '../gc/messages/JobPickerWindow'
import { useOpenThread } from '../gc/messages/openThread'

export interface EmailViewerActionsProps {
  message: ThreadMessage
  /** What the reader read from the line, when it is an invitation to bid. */
  invitation: Invitation | null
  /** The kernel's presses for this line, cut 4b's change order left to its own hook. */
  presses: readonly Exclude<ViewerPress, 'change_order'>[]
  io: EmailViewerIo
  me: { id: string }
  say: (words: string, tone: 'success' | 'error') => void
  /** The thread read again after a write, so the Tied to row updates in place. */
  reread: () => void
  /** Where Start a bid and Open the bid land: the Bid Board on the bid, the thread closed. */
  openBid: (bidId: string) => void
  /** A smoke's clock. */
  nowIso?: string
}

export function EmailViewerActions({ message, invitation, presses, io, me, say, reread, openBid, nowIso }: EmailViewerActionsProps) {
  const thread = useOpenThread()
  const contact = thread?.contact ?? null
  const [panel, setPanel] = useState(false)
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // The bids the picker's search found, for the toast's words: a ref, so a result never redraws the picker's search.
  const found = useRef<readonly JobTile[]>([])

  const bidRef = jobRefOf(message.jobId)
  const theirs = useMemo(() => (thread ? thread.rail.map((k) => thread.tiles[k]).filter((t): t is JobTile => t !== undefined && t.kind === 'bid') : []), [thread])

  const run = async <T,>(press: () => Promise<T>, failed: string, after: (out: T) => void) => {
    setBusy(true)
    setProblem(null)
    try {
      after(await press())
    } catch (e) {
      setProblem(formatErrorMessage(e, failed))
    } finally {
      setBusy(false)
    }
  }

  const searchOpenBids = useCallback(
    async (words: string) => {
      const tiles = await io.searchOpenBids(words)
      found.current = tiles
      return tiles
    },
    [io],
  )

  const putOnBid = (key: string | null) => {
    setPicking(false)
    const ref = jobRefOf(key)
    if (!ref || ref.kind !== 'bid') return
    const tile = theirs.find((t) => t.key === key) ?? found.current.find((t) => t.key === key)
    void run(
      () => io.putOnBid(message.id, ref.id, putOnBidLogLine({ who: message.who, at: message.at, subject: message.subject }, invitation?.kind ?? null)),
      'The email was not put on the bid.',
      () => {
        say(putOnBidWords(tile ? { num: tile.num, name: tile.name } : { num: 'the bid', name: '' }), 'success')
        reread()
      },
    )
  }

  return (
    <>
      {presses.includes('start_bid') && (
        <Btn kind={panel ? 'primary' : 'plain'} disabled={busy || !contact} title={VIEWER_PRESS_WORDS.start_bid.tip} onClick={() => setPanel((p) => !p)}>
          {VIEWER_PRESS_WORDS.start_bid.label}
        </Btn>
      )}
      {presses.includes('put_on_bid') && (
        <Btn disabled={busy} title={VIEWER_PRESS_WORDS.put_on_bid.tip} onClick={() => setPicking(true)}>
          {VIEWER_PRESS_WORDS.put_on_bid.label}
        </Btn>
      )}
      {presses.includes('open_bid') && bidRef && (
        <Btn title={VIEWER_PRESS_WORDS.open_bid.tip} onClick={() => openBid(bidRef.id)}>
          {VIEWER_PRESS_WORDS.open_bid.label}
        </Btn>
      )}
      {(problem || (panel && contact)) && (
        // Its own row under the tools, after Copy, Print and Share, the change order panel's place.
        <div data-start-bid-panel style={{ order: 1, flexBasis: '100%', display: 'grid', gap: '0.5rem', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.875rem' }}>
          {panel && contact && (
            <StartBidPanel
              message={message}
              invitation={invitation}
              contact={contact}
              io={io}
              busy={busy}
              nowIso={nowIso}
              onStart={(pick) =>
                void run(
                  async () => {
                    const customerId = await customerFor(pick, contact, message, io, me, nowIso)
                    const out = await io.startBid(message.id, {
                      customerId,
                      projectName: pick.projectName,
                      dueDate: invitation?.due?.date ?? null,
                      dueTime: invitation?.due?.time ?? null,
                      links: invitation?.portal ? [invitation.portal.url] : [],
                    })
                    return { ...out, project: pick.projectName }
                  },
                  'The bid was not started.',
                  (out) => {
                    setPanel(false)
                    say(startedBidWords({ bidNumber: out.bidNumber, project: out.project, customer: out.customer }), 'success')
                    reread()
                    if (out.bidId) openBid(out.bidId)
                  },
                )
              }
              onCancel={() => {
                setPanel(false)
                setProblem(null)
              }}
            />
          )}
          {problem && (
            <div role="alert" style={{ color: 'var(--text-red-700)' }}>
              {problem}
            </div>
          )}
        </div>
      )}
      {picking && (
        <JobPickerWindow
          title="Put it on a bid"
          theirs={theirs}
          searchJobs={searchOpenBids}
          onPick={putOnBid}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  )
}

/** What *Start a bid* carries: the bid's name and the customer, known or made by the press (the *Bid it?* card's `BidPick`). */
type StartPick = { projectName: string } & ({ choice: BidCustomerChoice } | { makes: { customerName: string } })

/**
 * The customer the bid goes on, as the *Bid it?* card finds them (`NewLaneSlot`'s `startBid`): the sender named as the
 * customer first when they are not yet, or the customer made from the field with the sender as the person at it.
 */
async function customerFor(pick: StartPick, contact: Contact, message: ThreadMessage, io: EmailViewerIo, me: { id: string }, nowIso?: string): Promise<string> {
  const channels = contact.channels.map((ch) => ({ kind: ch.kind, value: ch.value }))
  const senderName = senderFacts({ who: message.who, body: message.body, channels }).name
  const email = channels.find((ch) => ch.kind === 'email')?.value ?? null
  const phone = channels.find((ch) => ch.kind === 'phone')?.value ?? null
  if ('makes' in pick) {
    const today = calendarYmdInAppTzFromIso(nowIso ?? new Date().toISOString())
    const customerId = await io.makeCustomerRecord(contact.id, { customerName: pick.makes.customerName, personName: senderName, email, phone, customerType: 'commercial' }, { userId: me.id }, today)
    const person = senderName && !samePerson(senderName, pick.makes.customerName) ? senderName : null
    await io.name(contact.id, { kind: 'customer', label: pick.makes.customerName, words: '', record: { table: 'customers', id: customerId }, newPerson: person !== null, name: person })
    return customerId
  }
  if (pick.choice.guess && contact.kind === 'unknown') await io.name(contact.id, pick.choice.guess)
  return pick.choice.customerId
}

const FIELD = { display: 'grid', gap: '0.2rem', fontSize: '0.85rem' } as const

/** The *Bid it?* card's bid pieces, under the tools: the bid's name, the customer, and one press per way to start it. */
function StartBidPanel({
  message,
  invitation,
  contact,
  io,
  busy,
  onStart,
  onCancel,
}: {
  message: ThreadMessage
  invitation: Invitation | null
  contact: Contact
  io: EmailViewerIo
  busy: boolean
  nowIso?: string
  onStart: (pick: StartPick) => void
  onCancel: () => void
}) {
  const [project, setProject] = useState(() => startBidName(message, invitation))
  const [typed, setTyped] = useState<string | null>(null)
  const [known, setKnown] = useState<WhoKnown | null>(null)
  const channels = useMemo(() => contact.channels.map((ch) => ({ kind: ch.kind, value: ch.value })), [contact])
  const row = useMemo(() => ({ who: message.who, body: message.body, channels }), [message.who, message.body, channels])
  const ownId = contact.customerId ?? null
  const own = ownId ? { id: ownId, name: contact.company.trim() || contact.name } : null
  // The customers the sender may be, read once the panel opens, the card's way (`loadKnown`); the contact's own needs no read.
  useEffect(() => {
    if (ownId) return
    let live = true
    io.loadKnown(row)
      .then((k) => live && setKnown(k))
      .catch(() => live && setKnown({}))
    return () => {
      live = false
    }
  }, [ownId, io, row])
  const choices = own ? bidCustomerChoices(row, {}, own) : known ? bidCustomerChoices(row, known, null) : null
  const sender = senderFacts(row)
  const newName = typed ?? (companyFromDomain(sender.domain) || sender.name || '')
  const canStart = project.trim() !== ''
  return (
    <>
      <strong>Start a bid from this email</strong>
      <label style={FIELD}>
        <span>Bid</span>
        <input value={project} onChange={(e) => setProject(e.target.value)} placeholder="The project's name" style={input} disabled={busy} />
        <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>The bid's name. It starts with what the email said.</small>
      </label>
      {choices === null ? (
        <div style={{ color: 'var(--text-muted)' }}>Reading who it may be…</div>
      ) : (
        choices.map((c) => (
          <div key={c.customerId} data-start-bid={c.customerId} style={{ display: 'grid', gap: '0.15rem' }}>
            <div>
              <Btn kind="primary" disabled={busy || !canStart} title={c.words} onClick={() => onStart({ projectName: project.trim(), choice: c })}>
                {c.label}
              </Btn>
            </div>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{c.words}</small>
          </div>
        ))
      )}
      {!own && (
        <div data-new-customer style={{ display: 'grid', gap: '0.35rem' }}>
          <label style={FIELD}>
            <span>A new customer</span>
            <input value={newName} onChange={(e) => setTyped(e.target.value)} placeholder="The company, or their name" style={input} disabled={busy} />
            <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>A company? Type its name. The sender stays the person on the thread.</small>
          </label>
          <div>
            <Btn kind="primary" disabled={busy || !canStart || newName.trim() === ''} title={START_BID_WORDS} onClick={() => onStart({ projectName: project.trim(), makes: { customerName: newName.trim() } })}>
              Make the customer and start the bid
            </Btn>
          </div>
        </div>
      )}
      <div>
        <Btn kind="quiet" disabled={busy} onClick={onCancel}>
          Cancel
        </Btn>
      </div>
    </>
  )
}
