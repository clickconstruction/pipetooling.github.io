import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8098',
  date: '2026-11-20',
  title: 'The app loads a smaller first file: the Job window and the job form load when they are opened',
  kind: 'infra',
  highlights: [
    'The file every visit loads first is 40% smaller. It no longer carries the Job window and the job form.',
    'Those windows load a moment after the app has drawn, so a job still opens as fast as before.',
    'On a slow connection a first open may show Opening the job for a moment.',
    'This is the first step of work to stop updates from failing to go live as the app grows.',
  ],
}

export default note
