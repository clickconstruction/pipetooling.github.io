import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5428',
  date: '2026-10-12',
  title: 'Messages: a place for two inboxes and two numbers, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Each call, text and email can now say which inbox it came through: the team’s or bids@.',
    'A customer who texts STOP to one of our numbers can be stopped on that number alone.',
    'Settings has a place for both inboxes. It starts empty, and nothing changes until it is filled in.',
  ],
}

export default note
