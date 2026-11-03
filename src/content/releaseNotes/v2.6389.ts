import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6389',
  date: '2026-11-02',
  title: 'Job Summary’s header says what each number is for: to date or at 100%, a Heading for tile, Burn in words, and a billed-in-full flag',
  kind: 'feature',
  highlights: [
    'Every tile’s second line now says which moment its figure belongs to. While any shown job is in progress, Revenue, Gross profit, Overhead charged and True profit read “to date”, and a Revenue tile over one job says the rule itself: “to date · 40% of $32,600”.',
    'A seventh tile, Heading for, carries the projected true margin at 100% over the in-progress jobs, the number the totals row already held, so “to date” and “at completion” never share a tile. The column is named Proj. true margin · at 100%.',
    'Burn reads “94% spent · 40% done” instead of two bare percents. A job whose invoices add up to the contract while its % is under 100 gets a red “billed in full” chip on its % cell, a chip in the strip, and a sentence under the search that reads the margin both ways.',
    'While you search, the chips about the whole window (sessions awaiting approval, overhead in flight, overhead on jobs off the list) fold into one line that names the window. Press it to open them.',
  ],
  roles: ['dev', 'master_technician', 'controller'],
}

export default note
