import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6886',
  date: '2026-11-10',
  title: 'Link a customer to its names on permits',
  kind: 'feature',
  highlights: [
    'Our names for customers do not match the names a city lists. Under a GC’s card in a bid, and on the customer’s own page, Find their names on permits now suggests names that may be them, each with its reasons.',
    'The strongest reason is a permit on an address you bid to them. Then how alike the names are: one begins the other, one letter apart, or a shared word. Compare puts ours beside the city’s and marks what they share.',
    'Two presses on a name: Same company, or Not them. A No is kept, so the name is not offered again. A search reaches every name on permits. On Builders, a Looks like a customer chip lists every look-alike in one place.',
    'The Read back press on Builders is switched off for now. Older records would slow the Permits tab down, so its reads are being made faster first.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
