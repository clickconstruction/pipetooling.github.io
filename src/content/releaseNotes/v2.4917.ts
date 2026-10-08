import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4917',
  date: '2026-10-08',
  title: 'GC mode: ask trade partners for a quote, for a dev',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A dev opens the Ask window from a trade on a GC project’s card, or from Trade partners. It lists each company in the trade not yet asked on the job, those in range ticked.',
    'The window shows the email each company gets, in Spanish for a company that chose Spanish.',
    'Ask saves each ask on the trade. For now no email goes out, and the window says so.',
  ],
}

export default note
