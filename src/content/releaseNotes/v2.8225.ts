import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8225',
  date: '2026-11-21',
  title: 'Legal portal: a limit on confirmation emails',
  kind: 'fix',
  highlights: [
    'The law firm’s portal now sends a person three confirmation emails in an hour at most, and a whole firm twenty-four. Before, anyone holding the firm’s link could have the company send them without end.',
    'Past the limit the portal says so in plain words and asks the firm to try again in an hour. Nothing is dropped quietly.',
    'Two presses on Resend the confirmation in the same instant now send one email, and the link in it works.',
    'The confirmation email reads the same, and who may be added is unchanged.',
  ],
}

export default note
