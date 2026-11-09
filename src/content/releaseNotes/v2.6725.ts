import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6725',
  date: '2026-11-08',
  title: 'What went names the text that carried the short estimate link',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A sent estimate’s What went card now lists the text that went with the short my.clickplumbing.com/e/ link, with its time and number. Since the text started carrying that link the card had read “No text went with the link” under a text that went.',
    'Texts that went with the earlier share links on the accept page read as this estimate’s too.',
    'When an estimate becomes a job, the texts that carried its short link move onto the job with it, as the emailed link’s texts already did.',
  ],
}

export default note
