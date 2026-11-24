import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8453',
  date: '2026-11-24',
  title: 'Bills sent: By day paid says what a day’s figure leaves out',
  kind: 'fix',
  highlights: [
    'The words under the month now say that a bank deposit counts once it is put on a bill or a job.',
    'Until then the Dashboard’s Money in bar shows the deposit and By day paid does not. That is why a day can be less here than on the Dashboard.',
    'The printed month says the same.',
  ],
}

export default note
