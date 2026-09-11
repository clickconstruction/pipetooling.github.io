import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3338',
  date: '2026-09-11',
  title: 'Email yourself a sample test report',
  kind: 'feature',
  highlights: [
    'Settings → What customers see → Test report (sample) has an ✉ Email me row: pick any of the four sample reports and the real email — subject, body, pay-link paragraph, PDF attached — lands in your own inbox with a [Sample] prefix.',
    'Nothing is stored and no job is touched, so send one any time you change the letterhead, the certifier, the wording or the email template. Devs only.',
  ],
}

export default note
