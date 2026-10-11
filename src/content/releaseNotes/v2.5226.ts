import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5226',
  date: '2026-10-10',
  title: 'GC mode: send a follow up email from Click, after a test copy to yourself',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'On the Follow up sheet a dev can pick From Click Construction and send the email from Click to a trade partner.',
    'It goes to everyone at the company who gets the kinds of email ticked, with their portal link.',
    'Send a test to me sends a copy marked [TEST] to your own email and says who the real one goes to.',
    'Once it goes, it is logged as a nudge on each ask and on the company.',
  ],
}

export default note
