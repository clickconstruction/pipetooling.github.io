import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3494',
  date: '2026-09-15',
  title: 'New Sub Labor: the Date of Labor box looks like something you can change',
  kind: 'fix',
  highlights: [
    'The date on step 1 of New Sub Labor now carries a small calendar mark on its right edge, sits to the left like a field instead of centred like a result, and lights up on hover — it was reading as a printed value, so people did not know it could be changed.',
    'Tabbing to it now shows a focus ring. It had none, because the ring was landing on the invisible picker laid over the box.',
    'Nothing about the date changed: it still opens on today, still shows the short MM/DD/YY form, and still means the day the labor happened.',
  ],
}

export default note
