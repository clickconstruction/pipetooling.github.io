import type { OwnerPacket, OwnerPacketPayment } from './ownerRecords'

/**
 * The papers for an owner's records request (v2.4544, pure): the cover note, the statement
 * for the property, and the acknowledgment the owner signs. DRAFT wording until counsel
 * approves it (`OWNER_RECORDS_WORDING_APPROVED` in `ownerRecords.ts`). Everything a person
 * typed is escaped; nothing here reads the clock or the network.
 */

export type OwnerRecordsDocFacts = {
  company: string
  /** Who the packet is for, as it will be addressed. */
  owner: string
  /** The property, as the records name it. */
  address: string
  /** The day the statement was drawn, YYYY-MM-DD. */
  asOfYmd: string
  /** The day they asked, YYYY-MM-DD; null before the request is on file. */
  requestedOnYmd: string | null
}

export type OwnerRecordsDocFormat = {
  day: (ymd: string) => string
  /** A recorded-at instant as a date and a time on the company's clock. */
  dateTime: (iso: string) => string
  money: (n: number) => string
}

export function ownerCoverNoteLines(f: OwnerRecordsDocFacts, fmt: OwnerRecordsDocFormat): string[] {
  return [
    f.requestedOnYmd ? `You asked us in writing on ${fmt.day(f.requestedOnYmd)} for our records on ${f.address}. They are enclosed.` : `You asked us in writing for our records on ${f.address}. They are enclosed.`,
    `This statement comes from our business records as of ${fmt.day(f.asOfYmd)}.`,
    'It lists each job at this property, each bill, and each payment we received on those bills.',
    'It is not legal advice, and it says nothing about anyone else.',
    `${f.company} keeps every right it has, including its lien rights.`,
  ]
}

export const OWNER_ACKNOWLEDGMENT_TITLE = 'Acknowledgment of a records request'

export function ownerAcknowledgmentLines(f: OwnerRecordsDocFacts, fmt: OwnerRecordsDocFormat): string[] {
  return [
    `I am an owner of the property at ${f.address}.`,
    `I asked ${f.company} in writing for its records on work at this property.`,
    `${f.company} is giving me these records because I asked. They come from its business records as of ${fmt.day(f.asOfYmd)}.`,
    'The records are not legal advice.',
    `${f.company} gives up none of its rights by giving me these records, including its lien rights.`,
    `I will not hold ${f.company} responsible for how I use these records.`,
  ]
}

/** "Sep 14, 2026 · recorded Sep 14, 3:00 PM · Check 1042": when it was paid, when we wrote it down, and how. */
export function ownerPaymentWhen(p: OwnerPacketPayment, fmt: OwnerRecordsDocFormat): string {
  const parts = [p.paidOn ? fmt.day(p.paidOn) : 'no paid date']
  if (p.recordedAt) parts.push(`recorded ${fmt.dateTime(p.recordedAt)}`)
  const how = [p.type, p.reference].filter(Boolean).join(' ')
  if (how) parts.push(how)
  return parts.join(' · ')
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const PAGE_CSS = `
  @page { size: letter; margin: 0.9in; }
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; line-height: 1.5; color: #111; }
  h1 { font-size: 14pt; margin: 0 0 0.6em; }
  h2 { font-size: 12pt; margin: 1.4em 0 0.3em; }
  p { margin: 0 0 0.6em; }
  table { width: 100%; border-collapse: collapse; margin: 0.3em 0 0.8em; }
  th, td { text-align: left; padding: 3px 6px; border-bottom: 1px solid #bbb; vertical-align: top; font-size: 10.5pt; }
  td.n, th.n { text-align: right; white-space: nowrap; }
  tr.pay td { color: #333; font-size: 10pt; border-bottom: 1px dotted #ccc; padding-left: 22px; }
  tr.sum td { font-weight: 700; border-top: 2px solid #111; border-bottom: none; }
  .muted { color: #555; }
  .sign { margin-top: 2.2em; display: grid; grid-template-columns: 1fr 1fr; gap: 1.6em 2em; }
  .line { border-top: 1px solid #111; padding-top: 3px; font-size: 9.5pt; color: #333; }
  .break { page-break-before: always; }
`

function doc(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PAGE_CSS}</style></head><body>${body}</body></html>`
}

function paymentRows(pays: ReadonlyArray<OwnerPacketPayment>, fmt: OwnerRecordsDocFormat): string {
  return pays.map((p) => `<tr class="pay"><td>Payment · ${esc(ownerPaymentWhen(p, fmt))}</td><td class="n">${esc(fmt.money(p.amount))}</td></tr>`).join('')
}

/** The cover note, then the statement: a summary of the property, then each job with its bills and their payments. */
export function ownerPacketHtml(packet: OwnerPacket, f: OwnerRecordsDocFacts, fmt: OwnerRecordsDocFormat): string {
  const cover = `<p>${esc(fmt.day(f.asOfYmd))}</p><p>${esc(f.owner)}<br>${esc(f.address)}</p>${ownerCoverNoteLines(f, fmt).map((l) => `<p>${esc(l)}</p>`).join('')}<p>${esc(f.company)}</p>`
  const summary = `<h1 class="break">Statement for ${esc(f.address)}</h1><p class="muted">As of ${esc(fmt.day(f.asOfYmd))}</p>
    <table><thead><tr><th>Job</th><th class="n">Job total</th><th class="n">Paid</th><th class="n">Still owed</th></tr></thead><tbody>
    ${packet.jobs.map((j) => `<tr><td>${esc(j.number)} · ${esc(j.name)}</td><td class="n">${esc(fmt.money(j.total))}</td><td class="n">${esc(fmt.money(j.paid))}</td><td class="n">${esc(fmt.money(j.owed))}</td></tr>`).join('')}
    <tr class="sum"><td>This property</td><td class="n">${esc(fmt.money(packet.total))}</td><td class="n">${esc(fmt.money(packet.paid))}</td><td class="n">${esc(fmt.money(packet.owed))}</td></tr>
    </tbody></table>`
  const jobs = packet.jobs
    .map((j) => {
      const bills = j.bills
        .map((b) => `<tr><td>${esc(b.label)}${b.billedOn ? ` · billed ${esc(fmt.day(b.billedOn))}` : ''}</td><td class="n">${esc(fmt.money(b.amount))}</td></tr>${paymentRows(b.payments, fmt)}<tr><td class="muted">Open on ${esc(b.label.toLowerCase())}</td><td class="n">${esc(fmt.money(b.open))}</td></tr>`)
        .join('')
      const loose = j.loosePayments.length ? `<tr><td class="muted">Payments on the job that name no bill</td><td></td></tr>${paymentRows(j.loosePayments, fmt)}` : ''
      const none = !j.bills.length && !j.loosePayments.length ? '<tr><td class="muted">No bill has gone out on this job yet.</td><td></td></tr>' : ''
      return `<h2>${esc(j.number)} · ${esc(j.name)}</h2><p class="muted">${esc(j.address)}${j.gcName ? ` · billed to ${esc(j.gcName)}` : ''}</p>
        <table><tbody><tr><td>Job total</td><td class="n">${esc(fmt.money(j.total))}</td></tr>${none}${bills}${loose}<tr><td>Paid on this job</td><td class="n">${esc(fmt.money(j.paid))}</td></tr><tr class="sum"><td>Still owed on this job</td><td class="n">${esc(fmt.money(j.owed))}</td></tr></tbody></table>`
    })
    .join('')
  return doc(`Records for ${f.address}`, `${cover}${summary}${jobs}`)
}

/** One page for the owner to sign. */
export function ownerAcknowledgmentHtml(f: OwnerRecordsDocFacts, fmt: OwnerRecordsDocFormat): string {
  const lines = ownerAcknowledgmentLines(f, fmt)
  return doc(
    OWNER_ACKNOWLEDGMENT_TITLE,
    `<h1>${esc(OWNER_ACKNOWLEDGMENT_TITLE)}</h1><p class="muted">${esc(f.address)}</p><ol>${lines.map((l) => `<li><p>${esc(l)}</p></li>`).join('')}</ol>
     <div class="sign"><div class="line">Signature</div><div class="line">Date</div><div class="line">Printed name</div><div class="line">Phone or email</div></div>`,
  )
}
