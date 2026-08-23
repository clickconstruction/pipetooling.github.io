import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2203',
  date: '2026-08-23',
  title: 'Pricing Workbench: a leaner page, and prices that say who sees them',
  kind: 'feature',
  highlights: [
    'Every price card now ends in a bar that answers "who sees this?" — ★ The price on their letter, On their letter · alternate, or Only you see this — and the bar\'s links offer, stop offering, or move the ★. The GC chips up top count what each GC gets ("gets 2 prices").',
    'The numbers strip and the solver are one compact card; on a solve the card outlines amber and Apply / Discard sit right beside the numbers.',
    'The viewed price wears a blue "Viewing" tab and the customer-facing one a green "★ Submittal" tab (side by side when they\'re the same card); the explainer bar moved behind the ⓘ next to the bid name.',
    'Also: Old/New pills sit top-right by the Send to strip, "＋ Add GC" and "＋ Add price" are compact, light mode got a real page ground so cards and lines finally separate.',
  ],
}

export default note
