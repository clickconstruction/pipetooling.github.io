import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3578',
  date: '2026-09-17',
  title: 'Payroll: every payment can say which send paid it',
  kind: 'infra',
  highlights: [
    'A recorded payment now has a place for its source — the Cash App transaction, the Mercury transfer, a client paying the person directly, or other — so the Payments view can show the real channel instead of guessing from the memo (coming in the next release).',
    'Groundwork for backfilling past payments from the Cash App export: one send that covered several weeks, or one payment that merged two sends, can now be recorded as it happened.',
    'Nothing changes on screen in this release.',
  ],
}

export default note
