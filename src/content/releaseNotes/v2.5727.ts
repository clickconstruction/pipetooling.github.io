import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5727',
  date: '2026-10-22',
  title: 'Messages: the walk tester’s flag',
  kind: 'infra',
  highlights: [
    'Groundwork for the walk kit, the test that runs the whole Messages loop on the company’s own inbox and number without anyone pressing Send. The kit will sign in as one hidden tester account to press the sends.',
    'The tester has a flag of its own, so it never shows in a roster, a picker or a reminder, and its row is seen only by itself and by devs. Nobody can set the flag from the app; only the kit does.',
    'Nothing changes for anyone today. The tester account does not exist yet.',
  ],
}

export default note
