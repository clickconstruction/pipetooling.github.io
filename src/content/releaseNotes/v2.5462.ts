import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5462',
  date: '2026-10-13',
  title: 'Messages: tick a job to save every photo to Drive as it comes in',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Open a message that came with a picture and is tied to a job. Under Attachments, tick Save every photo on this job to Drive as it comes in.',
    'The tick is for the whole job, starts off on every job, and says the day it went on.',
    'Nothing is copied yet. The copying starts in a later update.',
    'A picture on a text that the app could not copy now says Quo still has it, not Gmail.',
  ],
}

export default note
