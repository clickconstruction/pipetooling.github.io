import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2932',
  date: '2026-09-06',
  title: 'Watch a job: an email when the sub reports',
  kind: 'feature',
  highlights: [
    'Every job group on Jobs → Subs → Work has a bell — Watching · 2. Open it to see who hears when the sub reports: assigned superintendents by default, plus anyone you subscribe, each with three switches — progress, done, dates.',
    'The email goes out as it happens and reads like the feed: "Behar Kraja · 50% along on their part", "… says their work is done — call it in for inspection", "… picked Sep 22 → Sep 23". One template, at most one email an hour per job and kind, with the note quoted and an Open Jobs → Subs button.',
    'Settings → My email schedule lists the jobs you watch with the same switches and Stop watching.',
  ],
}

export default note
