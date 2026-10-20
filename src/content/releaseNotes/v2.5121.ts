import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5121',
  date: '2026-10-09',
  title: 'GC mode: pay a trade’s draws while we build, for a dev',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A job we are building on GC projects has a Draws button. Each trade with a signed statement of work shows what it billed, what we paid and what we hold.',
    'Approve a pay application, approve it for less or send it back. Then mark it paid and record their unconditional waiver.',
    'Record a pay application that came by email, charge a trade back, and send a change the customer signed to its trade.',
    'The trade is emailed only with the window’s tick on, and the tick starts off. Only a dev sees it while GC mode is built.',
  ],
}

export default note
