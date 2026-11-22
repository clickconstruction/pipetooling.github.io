import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8240',
  date: '2026-11-21',
  title: 'Send a paper: Send email waits until the address is checked',
  kind: 'fix',
  highlights: [
    'When you type someone who is in no list, Send email now waits for the app to check whose address it is.',
    'A quick press can no longer send a paper to an address that belongs to someone on your roster.',
    'If the app already keeps the address, the window names who holds it and asks you to press Send email again.',
    'If the check fails, nothing is sent and the window says why.',
  ],
}

export default note
