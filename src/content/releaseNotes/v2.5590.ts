import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5590',
  date: '2026-10-16',
  title: 'Job Mode: your bio goes with your first On my way to a customer, and Edit bio picks the lines',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'helpers'],
  highlights: [
    'The first time a customer hears from you, your bio follows your On my way text as a second text: the short resume the office wrote, opened with A little about and your first name. The same customer never gets it again, and a different tech introduces themself once too.',
    'The On my way sheet shows the bio under the orange box when it will go, with a third line under What happens that counts the lines. Not this time sends the line alone. Edit bio opens a window on top where you tick the lines for this customer, starting from your usual picks in Settings; a change there is for this customer only.',
    'The phone never sends the bio’s words. It names the lines, and the company number sends them from the office’s record in the customer’s language; a Spanish reader gets the Spanish lines only.',
    'The office sees the bio in the customer’s thread as the second text after the On my way line.',
  ],
}

export default note
