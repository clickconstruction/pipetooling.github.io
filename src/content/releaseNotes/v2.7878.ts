import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7878',
  date: '2026-11-18',
  title: 'Prospects on a phone: the lit tab is in view, and Closed permits open on a list that holds some',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'estimator'],
  highlights: [
    'On a phone the row of tabs on Prospects now slides to the one you are on. Before, opening Permits, Hiring or Subs showed Customers and Jobs to GC with nothing lit.',
    'Permits, Closed now opens on the first chip that holds a permit. A city whose closed permits all had a plumber used to open on an empty Passed list.',
    'An empty Closed chip now says what fills it. It no longer says the filters hide permits when no filter is set.',
    'On a phone the month’s count under the skim draws as two rows of three, so investigating reads whole.',
  ],
}

export default note
