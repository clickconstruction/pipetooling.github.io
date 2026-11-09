import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6790',
  date: '2026-11-09',
  title: 'The dev seat sets up a job',
  kind: 'feature',
  highlights: [
    'A dev’s agent can now make a job from the MCP seat the way New Job makes one: plan first, read the row as it will land, then apply. The customer’s email and phone fill the job’s when left out, the address is saved in Title Case, and the job starts at Working on the Pipeline, where a new job starts.',
    'The plan says who the job belongs to and why, names any live job on the customer already wearing the name, and lists what a bill will still need. Nothing the signed-in dev could not do on the screen: the row goes in under the same rules the form writes under.',
    'Updating a job and billing it from the seat are the next two steps of this road.',
  ],
}

export default note
