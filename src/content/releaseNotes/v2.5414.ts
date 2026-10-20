import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5414',
  date: '2026-10-12',
  title: 'Price requests: a supply house’s email finds the request it answers, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'An email from a supply house can land on the price request it answers. It matches by our link, then by the bid number, then by the house’s one open request.',
    'A link from another house’s request is refused, so a forwarded link never puts a price on the wrong house.',
    'Under the email, the request page can show what it answered, that pricing is attached and how many lines it has.',
    'Nothing on screen changes yet.',
  ],
}

export default note
