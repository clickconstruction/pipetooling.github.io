import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3367',
  date: '2026-09-12',
  title: 'Jobs keep their labor baseline',
  kind: 'feature',
  highlights: [
    'When a job bills, what it took — recorded hours, wages, people, materials, price — is kept as its baseline, with hours per $1k of price and, when the bid had a count sheet, hours per fixture. Every billed job to date was back-filled.',
    'The Costs tab’s baseline strip shows what was kept and offers Keep as baseline mid-job; Keep again ↻ takes it fresh.',
    'Bids → Labor gains a Jobs baseline tile: the median hours per $1k across billed jobs and what that implies for this bid’s value — the book’s answer for a bid with no count sheet.',
  ],
}

export default note
