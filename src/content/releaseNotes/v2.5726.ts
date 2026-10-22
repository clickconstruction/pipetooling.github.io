import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5726',
  date: '2026-10-22',
  title: 'Messages: the company’s own number and inbox never become a Who is this? row',
  kind: 'feature',
  highlights: [
    'A text between two of the company’s own numbers used to make a Who is this? row for each of them. The readers now leave the company’s own numbers and addresses out, as the email reader already did for its own inbox.',
    'The one exception is the walk kit, the test customer a session sets up to run the Messages loop end to end on the company’s own inbox and number. While it is set up, a text or an email from that inbox or number lands on the walk kit’s thread alone, and nothing else moves.',
    'Nothing changes for customers, trades or teammates: their texts and emails land as before.',
  ],
}

export default note
