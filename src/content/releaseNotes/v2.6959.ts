import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6959',
  date: '2026-11-11',
  title: 'Bids and permits: our own plumbing permit reads Ours',
  kind: 'feature',
  highlights: [
    'A plumbing permit under one of our own names now carries an Ours chip in a bid’s window, under This site and in the jobs priced for the GC.',
    'On the Bid Board that bid reads Plumbing permit · ours. It no longer reads another name, and the red news line is gone for it.',
    'The owner or a dev says which names are us on Settings → Company → Our names on plumbing permits. The company name on paper bills counts already.',
    'The chip says whose permit it is. It never marks a bid won.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
