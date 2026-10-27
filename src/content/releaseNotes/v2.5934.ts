import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5934',
  date: '2026-10-26',
  title: 'The rating page becomes the review ask: Google at five stars, a call below',
  kind: 'feature',
  highlights: [
    'The page a {rate} link opens now names the company and the job, and asks with five stars. One tap still saves the answer.',
    'At five stars it asks the customer to put the review on Google, with our own Google link and their words copied for the paste. Below five it asks what we could have done better, and at three stars or fewer it says the office will call. The Google line shows to everyone who answers, which is what Google’s rules allow.',
    'Each answer lands in the customer’s thread in Messages as the app’s own line: a star for a good one and a warning mark for a low one, then their words.',
    'What customers see shows the page three ways, before an answer, after five stars and after two stars. A new guide, ask a customer for a review, walks the whole ask.',
  ],
}

export default note
