/**
 * Cut 3's reply box at the foot of the thread window, with punch list #140 PR 4's ask from the URL: `?nudge=text|email`
 * (`useThreadWindow`) opens the box with the step's reminder already written and the send window open, so Waiting on
 * them's Nudge and the flow's *Text Greg* are one read and one press. The box resolves the words itself from the reads
 * it already makes (`ReplyBox`'s `nudge`); this only hands it the ask, so a job's box or a sheet's never reads the URL.
 */
import type { Contact } from '../../../../lib/contacts/kernel'
import { useThreadWindow } from '../useThreadWindow'
import { ReplyBox } from './ReplyBox'

export function NudgedReplyBox({ contact }: { contact: Contact }) {
  const { nudge } = useThreadWindow()
  return <ReplyBox contact={contact} nudge={nudge} />
}
