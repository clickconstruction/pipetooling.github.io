import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5135',
  date: '2026-10-09',
  title: 'GC mode: send a trade its papers from its window',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A trade partner’s window has tabs: About, Documents and Their portal. Documents lists its papers, the missing ones first.',
    'Send each paper from its row: pick the day it is due, add a line, and read the email as they will get it. Follow up chases the day.',
    'The W-9 goes out to sign. Insurance is asked for by email, and Record their insurance files the certificate they send back.',
    'The master agreement waits for the new Master Services Agreement in the Contract Book.',
  ],
}

export default note
