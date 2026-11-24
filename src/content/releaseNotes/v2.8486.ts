import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8486',
  date: '2026-11-24',
  title: 'Send a paper: a copy out with a person named under a company is found',
  kind: 'fix',
  highlights: [
    'On Documents → Agreements, Send a paper now asks before a second copy when the paper is out with a person you put under that company by Add to a list. Before, it looked at the company alone and made a second copy with no question.',
    'The window names who has the paper and the day it went, with Send it to them again and Send a second copy to someone else, as for any company.',
    'Escape now closes the paper list, Who is it with? and the window that says a paper is already out. Nothing is sent or written by closing.',
  ],
}

export default note
