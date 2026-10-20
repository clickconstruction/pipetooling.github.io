import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5420',
  date: '2026-10-12',
  title: 'Messages: a sub’s flow on a job, from the work order to their pay, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A sub has a flow of their own now: asked, said yes, on site, done and paid.',
    'Each step reads what the app already keeps: the work order and the sub sheet.',
    'A sub who turns the work down ends that job’s flow.',
    'Nothing on screen changes yet. The sub’s lines on the sheet come next.',
  ],
}

export default note
