import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5549',
  date: '2026-10-14',
  title: 'Messages: a text from a number on the roster lands on that teammate',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'When a text comes in from a number the app has never seen, it checks the roster before asking Who is this?. A teammate or a sub whose People record holds that number gets the text in their own thread.',
    'This covers anyone added to the roster, or given a number, after today. Someone whose roster record has no number still comes through Who is this?, where One of our own team writes the number onto their record.',
  ],
}

export default note
