/**
 * Text the customer… (punch list #345, named *Text it…* until #394): a painted map's link, texted to the job's customer from the
 * company's number. Pure. The sheet's press opens the customer's own box on Text
 * (`ContractTextDoor` over `JobCustomerBox`), with these words in it, tied to the job. Nothing is
 * sent in the press: the box's send window is the confirm, and its holds say why a text cannot go.
 *
 * The office team writes to a customer, as everywhere in Messages (`jobBoxOffered`). A tech who
 * painted a map texts it from their own phone, to whoever they pick (`paintedMapOwnTextHref`). A
 * text from the company goes to a job's customer, so a map on a development or on no job has
 * nobody to text, and the press says so.
 */

/** What the share sheet draws for Text the customer…. */
export type PaintedMapTextDoor =
  /** Not the office team: no row at all. */
  | { kind: 'hidden' }
  /** The office, and the map is on a job: the press. */
  | { kind: 'offered'; jobId: string }
  /** The office, and the map is on no job: the press is dead and says why. */
  | { kind: 'no-job'; words: string }

export const PAINTED_MAP_TEXT_WORDS = {
  /** Since punch list #394 the press names who gets it, and its second line whose number it goes from. */
  press: 'Text the customer…',
  pressSub: 'From the company’s number',
  head: 'Text the map’s link',
  /** Said on the press itself, which keeps its place and is dead: the other ways are on the sheet beside it. */
  noJob: 'This map is on no job.',
  opening: 'Opening the job…',
  jobGone: 'The job could not be opened, so the text cannot go from here. Copy the link.',
} as const

export function paintedMapTextDoor(input: { office: boolean; jobId: string | null | undefined }): PaintedMapTextDoor {
  if (!input.office) return { kind: 'hidden' }
  const jobId = input.jobId?.trim() ?? ''
  return jobId ? { kind: 'offered', jobId } : { kind: 'no-job', words: PAINTED_MAP_TEXT_WORDS.noJob }
}

/**
 * The words the box opens with, the link last so a phone turns it into a press. The map's name is
 * the painter's own words and the only thing said about it: a text carries no more than the page.
 */
export function paintedMapTextWords(mapName: string | null | undefined, url: string): string {
  const name = (mapName ?? '').trim().replace(/\s+/g, ' ')
  return name ? `Here is a map for you, ${name}. Open it here: ${url}` : `Here is a map for you. Open it here: ${url}`
}

/** The job as the customer's box needs it. */
export type PaintedMapTextJob = { id: string; name: string; status: string | null; customerId: string | null }

/** The job's row as the box names it: its name, else its number, else *this job*. */
export function paintedMapTextJob(row: { id: string; job_name?: string | null; hcp_number?: string | null; status?: string | null; customer_id?: string | null }): PaintedMapTextJob {
  return {
    id: row.id,
    name: row.job_name?.trim() || (row.hcp_number?.trim() ? `Job ${row.hcp_number.trim()}` : 'this job'),
    status: row.status ?? null,
    customerId: row.customer_id ?? null,
  }
}
