/**
 * First look on a thread (punch list #319 PR 1): the look's card above a person's lines, for anyone a look was asked
 * of. The card reads its own rows and draws nothing while the thread has no open look, so the slot costs one small
 * read a thread. Modelled on the lead's doors (`useLeadDoorThreadSlots`).
 */
import { useMemo } from 'react'
import type { FirstLookThreadIo } from '../../lib/firstLook/threadIo'
import type { ThreadSlots } from '../gc/messages/threadSlots'
import { FirstLookCards } from './FirstLookCards'

export type FirstLookThreadSlots = Pick<ThreadSlots, 'aboveLines'>

export function useFirstLookThreadSlots(io?: FirstLookThreadIo): FirstLookThreadSlots {
  return useMemo<FirstLookThreadSlots>(() => ({ aboveLines: (c) => <FirstLookCards key={`first-looks:${c.id}`} contact={c} io={io} /> }), [io])
}
