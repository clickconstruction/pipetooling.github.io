import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5896',
  date: '2026-10-26',
  title: 'Customer reviews: the page a customer opens after a paid job',
  kind: 'feature',
  highlights: [
    'A new customer page asks how we did on a paid job: one to five stars, a sentence in their words, Send. It reads in the customer’s language and posts nothing anywhere; the review comes to the office.',
    'At five stars the page asks them to put it on Google with our own review link, their words copied for the paste. At fewer stars it asks what we could have done better and promises a call from the office. The same Google ask shows to everyone who answers, which is what Google’s rules allow.',
    'A review lands in the customer’s thread in Messages as the app’s own line, with a star for a good one and a warning mark for a low one, and What customers see shows the page before and after Send.',
    'This release lays the groundwork: the page, the table and the function. The text that carries the link, the morning’s offer on Today’s sends and the office’s view of a review come in the next releases.',
  ],
}

export default note
