import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7822',
  date: '2026-11-18',
  title: 'Stages onto the job: the rule for bringing a won bid’s stages across',
  kind: 'feature',
  highlights: [
    'The app can now work out a won bid’s price as the job’s stage lines: Rough In, Top Out, Trim Set and Final, adding up to the cent.',
    'The dollars follow the company’s own split, or the bid’s schedule of values when it has one. The hours for each stage come from the bid’s Labor tab.',
    'Nothing on screen changes yet. The window that offers the stages on New Job comes next.',
  ],
}

export default note
