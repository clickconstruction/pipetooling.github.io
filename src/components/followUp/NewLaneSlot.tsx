/**
 * Messages, residential R7 (PR 3): the sort card for one person above their thread, as `useNewLaneThreadSlots.tsx` puts
 * it in the window's `aboveLines` slot. It reads that person once (`newLaneCardIo.ts`), asks the lane's own rule
 * whether they need sorting (`laneRowFor`), and runs each press: says what it did, reads the card again and asks the
 * window to read the thread again. *A new customer* (v2.5795) goes through `makeCustomer` with the contact's address and
 * number, the sender's name and the box's kind.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Contact } from '../../lib/contacts/kernel'
import { pressProblem } from '../../lib/followUp/followUpIo'
import { jobChoices, rosterChoices, whoGuesses, type WhoGuess, type WhoKnown } from '../../lib/followUp/newLane'
import type { NewLaneCardIo, NewLaneCardRows } from '../../lib/followUp/newLaneCardIo'
import { hasTargets, laneJobs, laneRowFor, namedWords, rulePick, tiedWords } from '../../lib/followUp/newLaneRows'
import { hasToast } from '../../lib/followUp/queue'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import type { AboveLinesActs } from '../gc/messages/threadSlots'
import { NewLaneCard } from './NewLaneCard'

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

  // The records a guess may be, once a line, for *Who is this?*; the contact's channels give the address or the number
  // behind a name (v2.5795).
  const whoLine = row?.sort === 'who' ? row.messageId : null
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

  if (!row || !read) return null

  const run = async (press: () => Promise<unknown>, words: string, after?: (out: unknown) => void) => {
    setBusy(true)
    try {
      const out = await press()
      say(words, 'success')
      reread()
      after?.(out)
      await load()
    } catch (e) {
      say(pressProblem(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const lastOut = read.lines.find((l) => l.direction === 'out')
  const pick = rulePick({ kind: contact.kind, answeredLastBy: lastOut?.who_user_id ?? null, team: read.team, seats: read.seats })
  const jobs = jobChoices(row, laneJobs(row.jobIds, read.tiles, read.active))
  const nameOf = (userId: string) => read.team.find((t) => t.id === userId)?.name ?? 'Someone'

  return (
    <NewLaneCard
      key={`${row.messageId}:${jobs.map((j) => j.id).join(',')}`}
      row={row}
      channels={channels}
      guesses={row.sort === 'who' ? (known ? whoGuesses({ ...row, channels }, row.mailbox, known) : null) : undefined}
      roster={rosterChoices(known?.roster ?? [])}
      jobs={jobs}
      people={row.sort === 'has' ? hasTargets(row, read.team, pick) : []}
      busy={busy}
      onName={(g: WhoGuess) =>
        void run(
          () =>
            g.makesRecord
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
