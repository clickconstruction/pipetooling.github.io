import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6365',
  date: '2026-11-02',
  title: 'Job photos: a camera on the Pipeline row adds a photo with its words and browses the job’s photos',
  kind: 'feature',
  highlights: [
    'Every Pipeline row has a camera icon right after the Job folder icon. It opens a Job photos window on what is there: the job’s photos by day, newest first, with the words under each. On a phone the card’s ⋯ menu has a Photos line.',
    'Add a photo is the first tile. Pick one or several, type what each shows, tap the stage it shows, and press Add 2 photos to the job. The words are how you find it later; the search box over the grid reads them, the person and the stage.',
    'A tile opens the photo at full size with its words as the title, who took it, when, and where it is in Drive. The office and the taker can change the words later.',
    'A job photo is quiet: it files no report and pushes nobody. Leave report stays the press for news the office should hear now. The guide add a photo to a job and find it later says which to use when.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'helpers', 'subcontractor'],
}

export default note
