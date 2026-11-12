import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6992',
  date: '2026-11-12',
  title: 'An agent on the dev seat can price a bid’s count rows',
  kind: 'feature',
  highlights: [
    'A dev’s agent can now set the price of each counted fixture the way the Pricing tab does, on the price book the tab opens the bid on.',
    'When a bid still prices from a shared price book, the agent first takes the bid’s own copy, so the shared book never changes.',
    'A bid that was already sent needs the agent to say it is revising, just as the Pricing tab asks for its Revise button.',
    'Before anything changes the agent reads a plan in words: each price before and after, and the bid’s priced total before and after.',
  ],
}

export default note
