/**
 * Messages, residential R7 (PR 3): the sort card for one person above their thread, as `useNewLaneThreadSlots.tsx` puts
 * it in the window's `aboveLines` slot. It reads that person once (`newLaneCardIo.ts`), asks the lane's own rule
 * whether they need sorting (`laneRowFor`), and runs each press: says what it did, reads the card again and asks the
 * window to read the thread again. *A new customer* (v2.5795) goes through `makeCustomer` with the contact's address and
 * number, the sender's name and the box's kind. *A notice, not a person* (punch list #223 PR 1, v2.6202) goes through
 * `markNotice`; once the thread is done by that press, the slot draws the undo strip in the card's place, *Marked a
 * notice · Not a notice after all*, through `unmarkNotice`. *Bid it?* (PR 3, v2.6222): *Start a bid* names the sender
 * as the customer first (or makes them, `makeCustomerRecord` then `name`), then `startBid`, then opens the Bid Board on
 * the bid through `openBid`; *Not for us* and *Keep it* go through `answerInvitation`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Contact } from '../../lib/contacts/kernel'
import { pressProblem } from '../../lib/followUp/followUpIo'
import { bidCustomerChoices, jobChoices, rosterChoices, whoGuesses, type BidPick, type WhoGuess, type WhoKnown } from '../../lib/followUp/newLane'
import type { NewLaneCardIo, NewLaneCardRows } from '../../lib/followUp/newLaneCardIo'
import { hasTargets, INVITATION_WORDS, laneJobs, laneRowFor, namedWords, rulePick, startedBidWords, tiedWords } from '../../lib/followUp/newLaneRows'
import { samePerson } from '../../lib/followUp/customerLink'
import { hasToast } from '../../lib/followUp/queue'
import { NOTICE_LINES } from '../../lib/emailIn/leftOutSenders'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import type { AboveLinesActs } from '../gc/messages/threadSlots'
import { Btn } from '../gc/gcUi'
import { NewLaneCard } from './NewLaneCard'

/** What the undo strip says once the sender is back in New. */
export const NOTICE_UNDONE = 'The sender is back in New. Their next mail lands again.'

/** What a press says: its words, and whether it landed. */
export type Say = (words: string, tone: 'success' | 'error') => void

/** The card for one person: their read, their lane row, and the presses. Draws nothing until they need sorting. */
export function NewLaneSlot({
  contact,
  acts,
  io,
  say,
  reread,
  me,
  nowIso,
  openBid,
}: {
  contact: Contact
  acts: AboveLinesActs
  io: NewLaneCardIo
  say: Say
  reread: () => void
  /** Who is pressing: a press on themselves takes it rather than handing it. */
  me: { id: string; name: string }
  /** Now, for a smoke; the clock otherwise. */
  nowIso?: string
  /** Where *Start a bid* lands once the bid is made (v2.6222): the Bid Board on it. Unset: the card says so and stays. */
  openBid?: (bidId: string) => void
}) {
  // One clock for the card's life: its words ("today at 8:41 AM") and the day the conversation is read on.
  const [now] = useState(() => nowIso ?? new Date().toISOString())
  const [read, setRead] = useState<NewLaneCardRows | null>(null)
  const [known, setKnown] = useState<WhoKnown | null>(null)
  const [busy, setBusy] = useState(false)
  const jobKeys = contact.jobIds.join(',')

  const load = useCallback(async () => {
    try {
      setRead(await io.loadCard(contact.id, jobKeys ? jobKeys.split(',') : [], now))
    } catch {
      // The card waits for a read that works; the thread itself still draws.
    }
  }, [io, contact.id, jobKeys, now])
  useEffect(() => {
    void load()
  }, [load])

  const row = useMemo(
    () => (read ? laneRowFor(contact, { conversation: read.contact, lines: read.lines, active: read.active }, calendarYmdInAppTzFromIso(now), now) : null),
    [read, contact, now],
  )

  // The records a guess may be, once a line, for *Who is this?* and for *Bid it?*'s customers (v2.6222); the contact's
  // channels give the address or the number behind a name (v2.5795).
  const whoLine = row?.sort === 'who' || row?.sort === 'bid' ? row.messageId : null
  const whoFrom = row?.who ?? ''
  const whoSaid = row?.body ?? ''
  const channelsKey = contact.channels.map((ch) => `${ch.kind}:${ch.value}`).join('|')
  const channels = useMemo(() => channelsKey.split('|').filter(Boolean).map((s) => ({ kind: s.slice(0, s.indexOf(':')) as 'phone' | 'email', value: s.slice(s.indexOf(':') + 1) })), [channelsKey])
  useEffect(() => {
    if (!whoLine) return
    let live = true
    io.loadKnown({ who: whoFrom, body: whoSaid, channels })
      .then((k) => {
        if (live) setKnown(k)
      })
      .catch(() => {
        if (live) setKnown({})
      })
    return () => {
      live = false
    }
  }, [io, whoLine, whoFrom, whoSaid, channels])

  // The card draws *Who is this?* itself while it asks who (spike): the window's header drops its own button meanwhile.
  const asksWho = row?.sort === 'who'
  const whoDrawn = acts.whoDrawn
  useEffect(() => {
    whoDrawn?.(asksWho)
    return () => whoDrawn?.(false)
  }, [asksWho, whoDrawn])

  // Bid it? (v2.6222): the contact's own customer, else the customers the sender may be, once they are read.
  const ownId = contact.customerId ?? null
  const ownName = contact.company.trim() || contact.name
  const own = useMemo(() => (ownId ? { id: ownId, name: ownName } : null), [ownId, ownName])
  const bidChoices = useMemo(() => (row?.sort !== 'bid' ? null : own ? bidCustomerChoices({ who: row.who, body: row.body, channels }, {}, own) : known ? bidCustomerChoices({ who: row.who, body: row.body, channels }, known, null) : null), [row, own, known, channels])

  if (!read) return null

  const run = async <T,>(press: () => Promise<T>, words: string | ((out: T) => string), after?: (out: T) => void) => {
    setBusy(true)
    try {
      const out = await press()
      say(typeof words === 'string' ? words : words(out), 'success')
      reread()
      after?.(out)
      await load()
    } catch (e) {
      say(pressProblem(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  // Marked a notice from this thread (v2.6202): no sort card, the undo strip in its place while the thread is done.
  if (!row) {
    const marked = read.notice ?? []
    if (marked.length === 0 || read.contact?.state !== 'done') return null
    const domain = marked.find((n) => n.kind === 'domain')
    const line = domain ? NOTICE_LINES.marked(domain.value, 'domain') : NOTICE_LINES.marked(marked[0]!.value, 'address')
    return (
      <section
        aria-label="Marked a notice"
        data-new-lane-notice
        style={{ margin: '0.5rem 0.9rem 0', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-subtle)', padding: '0.5rem 0.75rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-600)' }}
      >
        <span style={{ flex: 1, minWidth: 180, overflowWrap: 'anywhere' }}>{line.replace(/\.$/, '')} · their next mail stays in Gmail.</span>
        <Btn kind="quiet" onClick={() => void run(() => io.unmarkNotice(contact.id), NOTICE_UNDONE)} disabled={busy}>
          Not a notice after all
        </Btn>
      </section>
    )
  }

  const lastOut = read.lines.find((l) => l.direction === 'out')
  const pick = rulePick({ kind: contact.kind, answeredLastBy: lastOut?.who_user_id ?? null, team: read.team, seats: read.seats })
  const jobs = jobChoices(row, laneJobs(row.jobIds, read.tiles, read.active))
  const nameOf = (userId: string) => read.team.find((t) => t.id === userId)?.name ?? 'Someone'
  const email = channels.find((ch) => ch.kind === 'email')?.value ?? null
  const phone = channels.find((ch) => ch.kind === 'phone')?.value ?? null

  // Start a bid (v2.6222): the sender named as the customer first, when they are not yet, the customer made when the
  // card's field says so; then the bid through `startBid`, and the Bid Board on it.
  const startBid = (p: BidPick) =>
    void run(
      async () => {
        const senderName = whoGuesses({ ...row, channels }, row.mailbox, known ?? {}).find((g) => g.name)?.name ?? null
        let customerId: string
        if ('makes' in p) {
          customerId = await io.makeCustomerRecord(contact.id, { customerName: p.makes.customerName, personName: senderName, email, phone, customerType: 'commercial' }, { userId: me.id }, calendarYmdInAppTzFromIso(now))
          const person = senderName && !samePerson(senderName, p.makes.customerName) ? senderName : null
          await io.name(contact.id, { kind: 'customer', label: p.makes.customerName, words: '', record: { table: 'customers', id: customerId }, newPerson: person !== null, name: person })
        } else {
          customerId = p.choice.customerId
          if (p.choice.guess && contact.kind === 'unknown') await io.name(contact.id, p.choice.guess)
        }
        const inv = row.invitation
        return { ...(await io.startBid(row.messageId, { customerId, projectName: p.projectName, dueDate: inv?.due?.date ?? null, dueTime: inv?.due?.time ?? null, links: inv?.portal ? [inv.portal.url] : [] })), project: p.projectName }
      },
      (out) => startedBidWords({ bidNumber: out.bidNumber, project: out.project, customer: out.customer }),
      (out) => {
        if (out.bidId) openBid?.(out.bidId)
      },
    )

  return (
    <NewLaneCard
      key={`${row.messageId}:${jobs.map((j) => j.id).join(',')}`}
      row={row}
      channels={channels}
      guesses={row.sort === 'who' ? (known ? whoGuesses({ ...row, channels }, row.mailbox, known) : null) : undefined}
      roster={rosterChoices(known?.roster ?? [])}
      jobs={jobs}
      people={row.sort === 'has' ? hasTargets(row, read.team, pick) : []}
      bidChoices={bidChoices}
      ownCustomer={own !== null}
      onStartBid={startBid}
      onNotForUs={(reason) => void run(() => io.answerInvitation(row.messageId, 'not_for_us', reason), INVITATION_WORDS.notForUs)}
      onKeep={() => void run(() => io.answerInvitation(row.messageId, 'kept', null), INVITATION_WORDS.kept)}
      busy={busy}
      onName={(g: WhoGuess) =>
        void run(
          () =>
            g.notice
              ? io.markNotice(contact.id, g.notice.scope)
              : g.makesRecord
              ? io.makeRecord(
                  contact.id,
                  {
                    table: g.makesRecord.table,
                    name: g.makesRecord.name,
                    personName: g.name,
                    email: channels.find((ch) => ch.kind === 'email')?.value ?? null,
                    phone: channels.find((ch) => ch.kind === 'phone')?.value ?? null,
                    trade: g.makesRecord.trade || null,
                  },
                  { userId: me.id },
                )
              : g.makes
              ? io.makeCustomer(
                  contact.id,
                  {
                    customerName: g.makes.customerName,
                    personName: g.name,
                    email: channels.find((ch) => ch.kind === 'email')?.value ?? null,
                    phone: channels.find((ch) => ch.kind === 'phone')?.value ?? null,
                    customerType: g.makes.customerType,
                  },
                  { userId: me.id },
                  calendarYmdInAppTzFromIso(now),
                )
              : io.name(contact.id, g),
          namedWords(g),
          (holder) => {
            if (typeof holder === 'string' && holder !== contact.id) acts.showContact(holder)
          },
        )
      }
      onSomeoneElse={acts.openWho}
      onTie={(jobKey) => {
        const job = jobs.find((j) => j.id === jobKey)
        void run(() => io.tie(row.messageId, jobKey), tiedWords({ number: job?.number ?? 'the job' }, !job?.isDefault))
      }}
      onHand={(userId) => {
        const to = userId === me.id ? me.name : nameOf(userId)
        void run(() => (userId === me.id ? io.takeIt(contact.id) : io.handTo(contact.id, userId)), hasToast(me.name, contact.name, to))
      }}
    />
  )
}
