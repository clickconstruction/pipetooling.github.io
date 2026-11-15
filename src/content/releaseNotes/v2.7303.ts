import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7303',
  date: '2026-11-15',
  title: 'Materials on site: retire every box on a job with one press',
  kind: 'feature',
  highlights: [
    'When a job is done, press Retire 2 empty boxes under the job’s boxes on Jobs → Materials. The press counts the empty boxes and retires them all at once.',
    'A box with parts in it stays, and the line beside the press names it with what it holds. Move the parts or mark them used, then press again.',
    'The window lists what goes and what stays before anything happens. The toast after carries Undo for one minute, which brings every retired box back.',
    'A retired box keeps its stickers and its history, as it always has.',
  ],
}

export default note
