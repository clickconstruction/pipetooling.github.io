/**
 * Messages, cut 1's screens: the presses the Messages view and the thread window make, as the page hands them in. The
 * page runs each through `messagesIo` and reads the view again after it, so a window only says what to do.
 */
import type { ContactKind, ContactRecord } from '../../../lib/contacts/kernel'
import type { JobTile } from '../../../lib/messages/jobTiles'
import type { RecordHit } from '../../../lib/messages/messagesIo'

export interface MessagesWrites {
  /** Who is this?: point the number at a record. Answers the contact that holds the thread now. */
  nameContact: (
    contactId: string,
    target: { record: NonNullable<ContactRecord>; kind: Exclude<ContactKind, 'unknown'>; name?: string | null },
  ) => Promise<string | null>
  /** Tie a line to a job, or untie it (null). */
  tieMessage: (messageId: string, jobKey: string | null) => Promise<void>
  /** Move the star to a job, or take it away (null). */
  setDefaultJob: (contactId: string, jobKey: string | null) => Promise<void>
  /** Put a job on the person's rail. */
  addJob: (contactId: string, jobKey: string) => Promise<void>
  /** Take a job the office tied off the person's rail. */
  removeJob: (contactId: string, jobKey: string) => Promise<void>
  /** The records a name may be, for Who is this?. */
  searchRecords: (words: string) => Promise<RecordHit[]>
  /** The jobs a name or a number may be, for + add a job. */
  searchJobs: (words: string) => Promise<JobTile[]>
}
