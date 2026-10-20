import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5593',
  date: '2026-10-16',
  title: 'Schedule: booking a job’s first visit asks before it texts the customer, and shows the receipt with the call to make',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'When you save a job’s first visit, a Tell the customer sheet opens before anything goes: the office’s Booked line filled with the day, the window and the tech, the number it goes to, and the words in a box you can change. Send text to Dana sends it from the company number; Skip sends nothing. Nothing goes on its own.',
    'After the send, the receipt: the words as they went, the time, and Call Dana to talk it through? with what to say. One press dials; the call lands in the customer’s thread when it ends.',
    'When no text can go, the sheet says why: no customer on the job, no number on file, STOP, or texts off. Later visits stay yours to text from the thread.',
    'The quick replies gain a blank for the tech coming, filled from the block. The office writes the Booked line in the quick replies editor; until then the app uses its own words.',
  ],
}

export default note
