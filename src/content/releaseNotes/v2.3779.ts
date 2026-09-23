import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3779',
  date: '2026-09-23',
  title: 'The job window on a phone: a bar that knows what is next',
  kind: 'feature',
  highlights: [
    'On a phone the job window carries a bar under the body that stays on screen at any scroll depth: Status ▾, the job’s next verb, and Note. The verb is the same thing the Pipeline row flags — Set % done when a bill went out with no progress, Bill it when a draw is ready, Send bill… when a draft is waiting, else Ready to bill, Move to Working or Mark paid.',
    'Status ▾ opens the Edit tab’s status rail in a sheet, with its rules intact: a send-back asks for its reason, a move to Billed with open money offers the bill line, Paid goes through Record payment.',
    'The status is a chip beside the job’s name, and Job total · Billed · Paid sit as three tiles under the customer. The street view photo folds behind a “street view” link so the customer and the activity come first.',
    'Arrived and Leaving now show only to people on the job’s crew — a team member or someone on one of its schedule blocks. The office keeps Set % complete and Post note.',
  ],
}

export default note
