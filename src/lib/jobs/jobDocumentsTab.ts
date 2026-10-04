/**
 * The job window's Documents tab (v2.4491): the pure pieces. The pay applications come from
 * `lib/aiaPayApplications.ts`; this file is the job's own folder links.
 */

export type JobDocumentFolderLink = { label: string; url: string }

type BillFields = {
  id: string
  status: string
  amount: number | string | null
  sequence_order: number
  sent_to_customer_at: string | null
  billed_at: string | null
  hosted_invoice_url: string | null
}

export type JobDocumentBillRow = {
  id: string
  /** "Bill 2": its place among the job's bills, drafts counted, starting at 1 (`sequence_order` starts at 0). */
  title: string
  amount: number
  /** "Paid" · "Sent 09/30/2026" · "Billed 09/30/2026" · "Billed". */
  words: string
  paid: boolean
  /** The customer's hosted Stripe page, when the bill has one. */
  hostedUrl: string
}

const mdY = (ymd: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  return m ? `${m[2]}/${m[3]}/${m[1]}` : ''
}

/**
 * The job's bills that went out, in their own order: billed and paid, never a draft. `dayOf`
 * turns a timestamp into its calendar day in the app's time zone.
 */
export function jobDocumentBillRows(invoices: ReadonlyArray<BillFields>, dayOf: (iso: string) => string): JobDocumentBillRow[] {
  const inOrder = invoices.slice().sort((a, b) => a.sequence_order - b.sequence_order)
  return inOrder
    .map((inv, i) => ({ inv, place: i + 1 }))
    .filter(({ inv }) => inv.status === 'billed' || inv.status === 'paid')
    .map(({ inv, place }) => {
      const sent = mdY((inv.sent_to_customer_at ?? '').trim() ? dayOf(inv.sent_to_customer_at!) : '')
      const billed = mdY((inv.billed_at ?? '').trim() ? dayOf(inv.billed_at!) : '')
      const paid = inv.status === 'paid'
      return {
        id: inv.id,
        title: `Bill ${place}`,
        amount: Number(inv.amount) || 0,
        words: paid ? 'Paid' : sent ? `Sent ${sent}` : billed ? `Billed ${billed}` : 'Billed',
        paid,
        hostedUrl: webLink(inv.hosted_invoice_url),
      }
    })
}

type JobFolderFields = {
  google_drive_link?: string | null
  job_plans_link?: string | null
  job_pictures_link?: string | null
}

/** A link as the page may open it: a web address, or nothing. */
function webLink(raw: string | null | undefined): string {
  const s = (raw ?? '').trim()
  return /^https?:\/\/\S+$/i.test(s) ? s : ''
}

/** The job's folder links that are set, in the order the Edit tab lists them. */
export function jobDocumentFolderLinks(job: JobFolderFields): JobDocumentFolderLink[] {
  const all: JobDocumentFolderLink[] = [
    { label: 'Job folder', url: webLink(job.google_drive_link) },
    { label: 'Plans', url: webLink(job.job_plans_link) },
    { label: 'Pictures', url: webLink(job.job_pictures_link) },
  ]
  return all.filter((l) => l.url)
}
