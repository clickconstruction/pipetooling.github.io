import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6076',
  date: '2026-10-29',
  title: 'Phone first: how far along each stage is, with a precise number',
  kind: 'feature',
  highlights: [
    'A field report on a job with stages asks How far along is each stage? Every stage is in view with its own number. The open stage takes a quick pick, a −5 or +5, or a number you type on the keypad.',
    'Update % done opens as a sheet from the bottom of the phone, from the My Schedule card or from the bar’s % done while clocked in. A one-stage job takes the same control for the whole job, with Not now and Save at the foot.',
    'Leave Report’s percent now opens on the job’s number instead of 0, and says so under the field. An untouched Save files that number, never 0.',
  ],
  roles: ['subcontractor', 'helpers', 'superintendent', 'master_technician', 'primary', 'assistant', 'controller', 'dev'],
}

export default note
