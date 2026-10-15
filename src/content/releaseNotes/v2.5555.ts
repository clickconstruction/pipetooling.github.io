import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5555',
  date: '2026-10-15',
  title: 'Customers and Trade partners: By step reads as bands, in the Project Board’s colours',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'By step on Customers and on Trade partners is one structure now instead of two. The tiles and the lane headings are gone. In their place, one band per part of the flow, in the Project Board’s own colour for it, with every step of that part as a row inside.',
    'Each band says how many customers or companies are in it, which jobs, how many are late or lapsed, and a dot per company. Under each step: whose move it is, the watches, and the usual time. Each job sits on its own line.',
    'One line above the bands says who needs a hand today, who waits on someone else, who is over usual, and who is off the flow. When someone is late it turns into a banner with their name.',
    'The job and seat pickers sit on the same row as By step and By company, with their arrows inside the pill.',
  ],
}

export default note
