import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6353',
  date: '2026-11-02',
  title: 'Rest on a job number on the Development page and a card shows the job',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Rest your pointer on a blue job number such as JP1091, anywhere on a Development page, and a card floats off the pointer with the job’s full name, its address and its details: the customer, the stage, the crew, the last work day, the money and the bid it came from. Move away and the card goes.',
    'The number is still the press it was: a press opens the job. Reaching the number with the Tab key shows the card too, and Escape closes it.',
    'On a phone, press and hold the number for half a second, then lift your finger, to see the card. Tap anywhere else to close it. A plain tap still opens the job.',
    'An estimator’s card shows no money, as the page does.',
  ],
}

export default note
