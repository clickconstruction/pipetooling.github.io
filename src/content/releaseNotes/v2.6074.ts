import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6074',
  date: '2026-10-29',
  title: 'Offline in the field, part 1: the rules of the queue the phone will keep',
  kind: 'infra',
  highlights: [
    'The first of five parts. Nothing changes on screen yet: this part writes the rules the phone will follow when a press cannot reach the office, so the next parts can build the queue and the bar on them.',
    'Four presses will be able to wait on the phone with the moment they were pressed: clock in, clock out, a job note and a field report. A payment, a bill, a card split, a text or an email to a customer, and a signature never will.',
    'The rules: presses go out in the order pressed; the phone tries again after 5, 10, 20 and 30 seconds and then every 30 seconds, and at once when the signal returns; a press the office refuses keeps the reason and a door while the rest still go; a press still waiting the next morning needs a person; every press carries its own id, so one that lands twice counts once.',
  ],
  roles: ['dev'],
}

export default note
