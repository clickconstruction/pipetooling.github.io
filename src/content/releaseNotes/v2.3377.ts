import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3377',
  date: '2026-09-13',
  title: 'Sees their customers’ bills by default: say it once on the builder',
  kind: 'feature',
  highlights: [
    'Edit customer has a new box under Pays as GC by default: Sees their customers’ bills by default. Tick it on a builder and every new job that names them as GC starts with the Show … memory on, so Bill Customer’s “Show it on their statement” tick is already ticked when you bill the owner.',
    'It only sets the starting value — untick it on a job, or on one bill, and that stays. Jobs already on the books are not touched.',
    'Done Right Foundation and the repairs on the homes it sends us are the case it was built for; a one-time script (the office runs it) flags Done Right, switches the memory on for its open repair jobs, and lists their unpaid bills on Done Right’s portal without re-sending anything.',
  ],
}

export default note
