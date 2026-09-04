import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2750',
  date: '2026-09-04',
  title: 'Debit cards: name, mark, and link each card in one place',
  kind: 'feature',
  highlights: [
    'Banking → Sorting → Nicknames → Debit cards is now one row per card: nickname, whether it is a person’s card or a company card, and the person who carries it. It replaces the separate Debit card nicknames and User Card Link screens.',
    'Linking a person fills them in on the card’s past purchases and every new one, so their fuel reaches Wheels and Review. A "Nobody yet" filter shows the cards still to link.',
    'Company cards — GPS, charging, subscriptions — are management tools, not fuel. Wheels sets their purchases aside and lists them, and the cards it names with no person are doors straight to their row.',
  ],
}

export default note
