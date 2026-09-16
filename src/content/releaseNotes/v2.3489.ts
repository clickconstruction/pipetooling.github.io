import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3489',
  date: '2026-09-15',
  title: 'The smoke suite reads the app as it is named today',
  kind: 'fix',
  highlights: [
    'The automated end-to-end check that loads the real site after every deploy had been failing on renamed labels, not on anything broken — it still looked for "Weekly movement", "Data & migration" and a Job Summary tile that no longer exists.',
    'Every label it checks was rebuilt against the running app, and the four Settings tabs it never covered are now included, so a red run means a real problem again.',
  ],
}

export default note
