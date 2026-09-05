import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2852',
  date: '2026-09-05',
  title: 'Every "% done" says where it came from, and every profit number says what it leaves out',
  kind: 'fix',
  highlights: [
    'Job Summary, the job activity header and Job Detail now show a small badge beside the % — "crew report Aug 27", "set by office" or "fully collected" — so a 100% that came from paid invoices is never mistaken for what the crew reported.',
    'The field report form opens on the job\'s current % ("Currently 30% — move to update") instead of 0. Leave the slider alone and the report keeps the job where it is; move it and the job follows.',
    'Job Detail\'s profit band is labeled "Margin before team labor" with a footnote on what is left out; the charges chart\'s green line now reads "cash position" — and says "before team labor" when wages are hidden from the viewer; Job Summary\'s Gross and True profit headers spell out their formulas on hover.',
    'Crew P&L\'s "Billing" column is now "Billed (gross)": the job\'s total bill credited by hours worked — not cash collected, not revenue before overhead.',
  ],
}

export default note
