import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3472',
  date: '2026-09-15',
  title: 'My email schedule shows field-report emails and your digests',
  kind: 'feature',
  highlights: [
    'Settings → My email schedule lists a Field reports row: whether reports email you the moment they are filed, and whose — every report anyone files, or reports from the people the office picked.',
    'A Job report digest row spells out each recurring digest you are on — its days, time, which jobs, all users or your team, and whether costs are included — and the week-grid chip now says the same.',
    'Devs get a Field report emails card on Settings → Email streams with every recipient and a × to stop theirs.',
  ],
}

export default note
