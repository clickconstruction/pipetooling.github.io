/**
 * A builder on a GC's own page (punch list #404, step 9): what the page reads out of the customer portal's answer, where
 * each one sits, and the words of its block. A GC is a customer who is the GC on a job with us. The office sends them
 * a builder, about one job or about all their jobs, and it is then on the page they already open.
 *
 * A GC can look only. Sending their picks is step 10, which waits on the owner's yes, so nothing here sends anything
 * but the mark that they opened it.
 *
 * Every word is a placeholder in plain words. A GC reads the builder's name as *Secrecy on your jobs*: *Sub NDA* is the
 * owner's word for it, and the press alone carries it, as the drawing has it.
 *
 * Pure: no React, no supabase.
 */
import { formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'
import { parsePaperDef } from './definition'
import type { PaperDef } from './documentBuilder'

export type CustomerBuilder = {
  sendId: string
  builderKey: string
  /** The job it is about, and that job's label on the page. Both null when it is about all their jobs. */
  aboutJobId: string | null
  aboutJob: string | null
  revision: number
  /** The builder as published. */
  def: PaperDef
  /** The day they last opened it. Null until they do. */
  openedOn: string | null
  opened: boolean
  changed: boolean
}

/** The builders out of the customer portal's answer. A function deployed before this sends none, and the page draws no block. */
export function customerBuildersFrom(raw: unknown): CustomerBuilder[] {
  if (!Array.isArray(raw)) return []
  const out: CustomerBuilder[] = []
  for (const one of raw) {
    if (typeof one !== 'object' || one === null) continue
    const r = one as Record<string, unknown>
    if (typeof r.sendId !== 'string' || !r.sendId || typeof r.builderKey !== 'string' || !r.builderKey || typeof r.revision !== 'number') continue
    // A builder that does not read as a paper is left out, never half drawn on a customer's page.
    const parsed = parsePaperDef(r.contents)
    if (!parsed.ok) continue
    const aboutJobId = typeof r.aboutJobId === 'string' && r.aboutJobId ? r.aboutJobId : null
    out.push({
      sendId: r.sendId,
      builderKey: r.builderKey,
      aboutJobId,
      aboutJob: aboutJobId && typeof r.aboutJob === 'string' && r.aboutJob.trim() ? r.aboutJob.trim() : null,
      revision: r.revision,
      def: parsed.def,
      openedOn: typeof r.openedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.openedOn) ? r.openedOn : null,
      opened: r.opened === true,
      changed: r.changed === true,
    })
  }
  return out
}

/**
 * Where the builders sit on the page: one about all their jobs at the top, and one about a job under that job. A job
 * keeps the order the page lists its jobs in, and a job the page does not list comes after, by its label.
 */
export function placeCustomerBuilders(builders: ReadonlyArray<CustomerBuilder>, jobOrder: ReadonlyArray<string> = []): { top: CustomerBuilder[]; byJob: Array<{ jobId: string; job: string; builders: CustomerBuilder[] }> } {
  const top = builders.filter((b) => b.aboutJobId == null)
  const byJob = new Map<string, { jobId: string; job: string; builders: CustomerBuilder[] }>()
  for (const b of builders) {
    if (b.aboutJobId == null) continue
    const at = byJob.get(b.aboutJobId) ?? { jobId: b.aboutJobId, job: b.aboutJob ?? 'Job', builders: [] }
    at.builders.push(b)
    byJob.set(b.aboutJobId, at)
  }
  const place = (id: string) => {
    const i = jobOrder.indexOf(id)
    return i < 0 ? jobOrder.length : i
  }
  return { top, byJob: [...byJob.values()].sort((a, b) => place(a.jobId) - place(b.jobId) || a.job.localeCompare(b.job)) }
}

export type CustomerBuilderChip = { tone: 'new' | 'changed'; words: string }

/** The words of one builder's block. `company` is our name, as the page's letterhead has it. */
export function customerBuilderWords(builder: Pick<CustomerBuilder, 'aboutJobId' | 'opened' | 'changed' | 'openedOn'>, company: string): { title: string; chip: CustomerBuilderChip | null; says: string; open: string; close: string; fine: string } {
  const jobs = builder.aboutJobId == null ? 'your jobs' : 'this job'
  const us = company.trim() || 'our company'
  const chip: CustomerBuilderChip | null = builder.changed ? { tone: 'changed', words: 'Changed since you opened it' } : !builder.opened ? { tone: 'new', words: 'New' } : null
  const openedLine = builder.openedOn ? `You opened this on ${formatWorkDateYmdMonthDayShort(builder.openedOn)}. ` : ''
  return {
    title: `Secrecy on ${jobs}`,
    chip,
    says: `See how ${us} binds the people it brings onto ${jobs}. Pick a level and read what it asks.`,
    open: 'Open the Sub NDA builder',
    close: 'Close the builder',
    fine: `${openedLine}You can look. Nothing is sent.`,
  }
}
