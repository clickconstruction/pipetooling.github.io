import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5286',
  date: '2026-10-12',
  title: "Messages: the lines the office writes for a customer's page",
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A daily log can now carry a line for the customer, with its Spanish. It is separate from the superintendent’s own notes, which the customer never sees.',
    'A pay application can carry a line that says what it covers, for the customer’s page. The bill itself still never changes once it went.',
    'A change order can carry its description in Spanish, and a job can name its superintendent for the customer to call.',
    'Nothing changes on screen yet. The customer’s page comes in the next part.',
  ],
}

export default note
