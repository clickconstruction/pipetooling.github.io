/**
 * The labels as a CSV (punch list #294, v2.6800): one row per live cage or box, for Brother's P-touch Editor, which
 * merges a CSV into a saved label template and prints the run on tape. The stencil, the kind, the place, the where-note,
 * the code as a person reads it, the address as a person types it, and the address the QR carries, with its scheme. Pure.
 */
import { csvEscapeField } from '../bids/bidCsvExport'
import { boxAddressWords, boxCodeWords, boxUrl, labelPrintName, labelPrintNames } from './labels'
import { compareLabels, type Container } from './onSite'

export const LABELS_CSV_COLUMNS = ['Stencil', 'Kind', 'Place', 'Where', 'Code', 'Address', 'QR'] as const

export type LabelsCsvRow = { stencil: string; kind: string; place: string; where: string; code: string; address: string; qr: string }

/** Every live cage, box or pile, never Unsorted, in stencil order. */
export function labelsCsvRows(containers: ReadonlyArray<Container>, places: ReadonlyArray<{ id: string; name: string }>): LabelsCsvRow[] {
  const placeName = new Map(places.map((p) => [p.id, p.name] as const))
  // The Stencil cell is what the label prints (v2.7195): the letters and number alone, as the app's own strip.
  const names = labelPrintNames(containers.filter((c) => c.kind !== 'unsorted'))
  return containers
    .filter((c) => !c.retiredAt && c.kind !== 'unsorted')
    .sort((a, b) => compareLabels(a.label, b.label))
    .map((c) => ({
      stencil: labelPrintName(names, c),
      kind: c.kind,
      place: (c.locationId && placeName.get(c.locationId)) || '',
      where: c.where,
      code: boxCodeWords(c.id),
      address: boxAddressWords(c.id),
      qr: boxUrl(c.id),
    }))
}

/** The file's text: a header row, then one row per box, every cell escaped, CRLF line ends as spreadsheets expect. */
export function labelsCsvText(rows: ReadonlyArray<LabelsCsvRow>): string {
  const head = LABELS_CSV_COLUMNS.map(csvEscapeField).join(',')
  const body = rows.map((r) => [r.stencil, r.kind, r.place, r.where, r.code, r.address, r.qr].map(csvEscapeField).join(','))
  return [head, ...body].join('\r\n') + '\r\n'
}

/** `labels-oak-hollow-building-c-2026-11-09.csv`: the job's words folded, the day. */
export function labelsCsvFileName(jobLabel: string, ymd: string): string {
  const slug = jobLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return `labels${slug ? `-${slug}` : ''}-${ymd}.csv`
}
