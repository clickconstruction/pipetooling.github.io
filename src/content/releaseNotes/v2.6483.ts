import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6483',
  date: '2026-11-04',
  title: 'A teammate can see their own logbook',
  kind: 'feature',
  highlights: [
    'A logbook has a new press for the office: Show this logbook to the teammate it belongs to. The strip under its name says who can see it, since when and who pressed. Stop showing takes it back.',
    'A teammate who has been shown it finds My logbook in the gear menu: the next license in each trade, how far along they are, who signs, and their hours week by week. They can print the summary sheet. They cannot edit a license or see anyone else’s.',
    'The Licenses tab says which teammates can see theirs.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary', 'helpers', 'superintendent'],
}

export default note
