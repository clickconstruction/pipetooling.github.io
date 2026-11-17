import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7535',
  date: '2026-11-16',
  title: 'Lien desk: retainage nobody recorded shows on To do and the Board',
  kind: 'feature',
  highlights: [
    'A job whose bills or notes show retainage held, with none recorded, now has a row on To do under Needs you now. It reads Retainage not on the job and says why.',
    'Record the retainage on that row opens the Retainage notices list at the job, where the figure is recorded or the job is answered as having none.',
    'The Board’s Retainage line counts these jobs, and so does the count on the Retainage notices tab.',
    'The Dashboard is unchanged: its lien card still reads notices only.',
  ],
}

export default note
