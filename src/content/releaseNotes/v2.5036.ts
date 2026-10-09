import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5036',
  date: '2026-10-09',
  title: 'GC mode: award a trade and see its statement of work, for a dev',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Once a GC job is won, Compare quotes awards a trade to one company’s quote, with the estimator who decided.',
    'A company new to us, declined or past its approved limit cannot be awarded. The reason shows under the button.',
    'The trade’s card then shows its statement of work: the price, our lines beside theirs and what they will not do.',
    'Send to their portal to sign marks it sent. The trade signs it once the portal’s sign screen arrives.',
  ],
}

export default note
