import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8442',
  date: '2026-11-24',
  title: 'Bills sent: a part-paid bill’s record draws its cents small',
  kind: 'fix',
  highlights: [
    'On a part-paid bill’s record, the line under the amount says what is still out. Its cents are now smaller than its dollars, as on every other amount on the page.',
  ],
}

export default note
