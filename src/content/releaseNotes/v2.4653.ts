import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4653',
  date: '2026-10-06',
  title: 'Lien desk: set the last day of work by hand',
  kind: 'feature',
  highlights: [
    'Every job on the Lien desk now has a Last day of work line above its months, saying where the day came from: clock hours, the day the job was created, or a person. A job with no clock hours used to be dated from its creation with no way to say better.',
    'Press Change to set the day by hand with a line on why. The lien months, the deadlines, the timeline, the GC run and the affidavit all follow it. The record keeps who set it and when.',
    'Clock hours and pay are never changed. A day earlier than the last clock day is refused. The same line sits in Edit Job under Our contract on this job.',
  ],
}

export default note
