import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6557',
  date: '2026-11-06',
  title: 'Machines on the fleet board: a card per excavator, drill or skid steer with its template, its gauges, its label and where it is',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'People → Vehicles grows a Machines board above the trucks. Add a machine names it the way the crew says it, E-12, picks its template (small, medium or large excavator, skid steer, directional drill, trencher, compactor, trailer), and mints the code for its label.',
    'Each card says where the machine is: on a job or in the yard. Put on a job and Hand off move it between jobs, and Back to the yard brings it home. Trucks keep their own board; a machine never shows among them.',
    'Gauges opens the machine’s own list: what it holds, whether it is a tank, a sight glass, a dipstick or a dial, and where on the machine to read it, starting from the template’s. Print the label prints the QR code the crew will scan.',
    'A rented machine carries who it is from, the agreement number and when it is due back, amber the day before and red once it is over. The card’s checks, hours and days on jobs fill in once the pre-use check ships on the phone, next.',
  ],
}

export default note
