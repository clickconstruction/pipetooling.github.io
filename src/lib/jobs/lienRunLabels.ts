import { csvEscapeField } from '../bids/bidCsvExport'
import { runAddressLines, type RunMailing } from './lienRunPaper'
import type { RunEnvelope } from './runEnvelopes'

/**
 * The run's addresses for a certified-mail label service (v2.4977, the owner's "Do 1"): one row per
 * envelope that goes out on paper, in the columns the vendor's batch template asks for (Certified
 * Mail Labels: Name, Address Line 1, City, State and Zip required; Company, Address Line 2, Phone
 * and a custom column optional). The vendor pairs columns once on upload, so the header names are
 * a convenience, not a contract. Held envelopes and anything that goes by email or by hand are left
 * out. Pure: the mailing in, rows and a CSV out.
 */
export const RUN_LABEL_HEADERS = ['Company', 'Name', 'Address Line 1', 'Address Line 2', 'City', 'State', 'Zip', 'Phone', 'Reference'] as const

export type RunLabelRow = {
  envelope: number
  name: string
  line1: string
  line2: string
  city: string
  state: string
  zip: string
  /** "Envelope 3 · 898, 813, 915" — the sheet's number and the jobs inside, for the vendor's custom column. */
  reference: string
}

const CITY_STATE_ZIP = /^(.*?),?\s+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/

/** "SAN ANTONIO, TX 78230" → city, state, ZIP; a line that is not that shape is the city alone. */
export function splitCityStateZip(line: string): { city: string; state: string; zip: string } {
  const m = line.trim().match(CITY_STATE_ZIP)
  if (!m) return { city: line.trim(), state: '', zip: '' }
  return { city: m[1]!.replace(/,$/, '').trim(), state: m[2]!.toUpperCase(), zip: m[3]! }
}

const STATE_ZIP_ONLY = /^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/

export function runLabelRow(env: Pick<RunEnvelope, 'n' | 'name' | 'address' | 'contents'>): RunLabelRow {
  const lines = runAddressLines(env.address)
  const last = lines.length > 1 ? lines[lines.length - 1]! : ''
  let street = lines.length > 1 ? lines.slice(0, -1) : lines
  let { city, state, zip } = splitCityStateZip(last)
  // "311 E Illinois Ave. Palatine, Il 60067" — typed with no comma before the city, so the last part is only the
  // state and ZIP: the city is the last word of the line before it. A city of two words needs the comma on the customer.
  const stateZip = last.trim().match(STATE_ZIP_ONLY)
  if (stateZip && street.length > 0) {
    const prev = street[street.length - 1]!.trim()
    const cut = prev.lastIndexOf(' ')
    if (cut > 0) {
      city = prev.slice(cut + 1)
      state = stateZip[1]!.toUpperCase()
      zip = stateZip[2]!
      street = [...street.slice(0, -1), prev.slice(0, cut)]
    }
  }
  const jobs = [...new Set(env.contents.map((c) => c.notice.jobNumber))]
  return {
    envelope: env.n,
    name: env.name.trim(),
    line1: street[0] ?? '',
    line2: street.slice(1).join(', '),
    city,
    state,
    zip,
    reference: `Envelope ${env.n} · ${jobs.join(', ')}`,
  }
}

/** The envelopes a label service can print for: the ones that go out, on paper. */
export function runLabelRows(mailing: Pick<RunMailing, 'mailed'>): RunLabelRow[] {
  return mailing.mailed.filter((env) => env.method === 'certified_mail' || env.method === 'traceable_courier').map(runLabelRow)
}

/** The CSV the office uploads: the vendor's columns, a BOM so Excel reads the accents, one row per envelope. */
export function runLabelCsv(rows: ReadonlyArray<RunLabelRow>): string {
  const head = RUN_LABEL_HEADERS.join(',')
  const body = rows.map((r) => ['', r.name, r.line1, r.line2, r.city, r.state, r.zip, '', r.reference].map(csvEscapeField).join(','))
  return `﻿${[head, ...body].join('\r\n')}\r\n`
}

/** "certified-labels_2026-10-08.csv" */
export function runLabelFilename(todayYmd: string): string {
  return `certified-labels_${todayYmd}.csv`
}

/** The toast after the save. */
export function runLabelSavedWords(count: number): string {
  return count === 0 ? 'No envelope goes out on paper, so there is nothing to save.' : `Saved ${count} ${count === 1 ? 'address' : 'addresses'} for the label service. Upload the file as a batch.`
}
