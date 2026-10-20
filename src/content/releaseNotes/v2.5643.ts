import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5643',
  date: '2026-10-19',
  title: 'Type /estimate to put a customer’s estimate in a message',
  kind: 'feature',
  highlights: [
    'In a text or an email to a customer, type /estimate, /quote or /price. The list shows that customer’s sent estimates first, then the approved ones.',
    'Pick one and a line about it goes in the box with its amount and a link to it. A quick reply with {estimate} in it fills in the same link.',
    'The app makes that link just for this message, so the link in the customer’s estimate email keeps working. A note under the box says so.',
  ],
}

export default note
