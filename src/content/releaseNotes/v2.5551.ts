import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5551',
  date: '2026-10-15',
  title: 'People: the roster takes each person’s number from their account',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Most of the roster had no number on file, so a teammate’s text still came in as a number nobody has named. A roster row with no phone now takes the phone on the account it is linked to.',
    'That happened once for everyone on the roster, and it keeps happening: a person who adds a number to their account fills their roster row, and a roster row that gains an account takes the account’s number.',
    'A number typed on the roster is never written over. People with no account and no number still come through Who is this?, where One of our own team fills it in.',
  ],
}

export default note
