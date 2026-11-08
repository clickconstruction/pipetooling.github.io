/**
 * Messages → My email, the door on the bid (punch list #263 PR A, v2.6730): above the box of a thread narrowed to a job
 * (`OpenThread.jobFilter`, which is how the Bid Board opens a GC's thread on a bid), the person's own mail with the
 * thread's person that is not on that job yet, with **Yes** on each (`MyMailJobLine`). The addresses are the person's
 * email channels; the job is the tile the filter names. Nothing while the thread shows every job. Drawn through cut
 * 1's slots (`threadSlots.tsx`); after Yes the page reads the thread again, so the tagged lines show.
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Contact } from '../../lib/contacts/kernel'
import { jobRefOf } from '../../lib/messages/jobKeys'
import type { JobDoorIo } from '../../lib/myMail/jobDoorIo'
import type { ThreadSlots } from '../gc/messages/threadSlots'
import { useOpenThread } from '../gc/messages/openThread'
import { useMessagesReread } from '../gc/messages/useMessagesReread'
import { useThreadWindow } from '../gc/messages/useThreadWindow'
import { MyMailJobLine } from './myMail/MyMailJobLine'

export type MyMailJobLineThreadSlots = Pick<ThreadSlots, 'aboveBox'>

/** The line itself, a component so it reads the open thread under the window's provider. */
export function MyMailThreadJobLine({ contact, io }: { contact: Contact; io?: JobDoorIo }) {
  const open = useOpenThread()
  const reread = useMessagesReread()
  const { openThread, closeThread } = useThreadWindow()
  const navigate = useNavigate()
  const jobKey = open?.jobFilter ?? null
  const tile = jobKey ? open?.tiles[jobKey] : undefined
  const ref = jobKey ? jobRefOf(jobKey) : null
  const addresses = useMemo(() => contact.channels.filter((ch) => ch.kind === 'email').map((ch) => ch.value), [contact.channels])
  if (!open || !jobKey || !tile || !ref) return null
  return (
    <MyMailJobLine
      job={{ ...ref, key: jobKey, num: tile.num, name: tile.name }}
      who={contact.name}
      addresses={addresses}
      narrow={open.foldBox === true}
      nowIso={open.nowIso}
      io={io}
      onTagged={reread}
      onOpenThread={(contactId) => {
        if (contactId !== contact.id) openThread(contactId, null)
      }}
      onOpenHref={(href) => {
        closeThread()
        navigate(href)
      }}
    />
  )
}

export function useMyMailJobLineThreadSlots(io?: JobDoorIo): MyMailJobLineThreadSlots {
  return useMemo<MyMailJobLineThreadSlots>(() => ({ aboveBox: (c) => <MyMailThreadJobLine key={`my-mail-job:${c.id}`} contact={c} io={io} /> }), [io])
}
