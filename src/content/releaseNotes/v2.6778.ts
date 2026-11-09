import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6778',
  date: '2026-11-09',
  title: 'The labor book falls back by size band, never every size',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'When fewer than three kept baselines sit within a quarter to four times a job’s price, the book widens to the job’s size band: under $10k, $10k to $100k, $100k to $1M, over $1M. It no longer reads every size, so a $350 repair never prices a $500k build.',
    'The award block, the Costs strip, the Needs you deck and Bids → Labor name the band they read: “from 7 projects in the $100k–$1M band”. A band with fewer than three says so and the pick moves on to a typed figure.',
    'The guide “give a project its hours baseline at award” names the bands.',
  ],
}

export default note
