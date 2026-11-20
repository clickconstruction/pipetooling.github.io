/**
 * What customers owe us before a stage starts (punch list #382, PR 6): the Dashboard's Needs you line. It is the
 * Schedule look's banner, one line for the whole company: the answers owed on every stage whose day to decide is
 * near (`stagesToAsk`), site by site. The count is the look's own, read through the same rows and the same rules, so
 * the line and the banner can never disagree. The press opens the first site's Schedule look, or the job's window
 * for a job on no site. It asks nobody: a person sends the ask. Pure; `startAnswersOwedIo.ts` reads.
 */
import { answersOwed, countWords, stagesToAsk, type Site } from '../startChecks/startChecks'
import { contactName, noticeFor, stageFromRows, type StageLine, type StartCheckRows, type StartSettingsRow } from '../startChecks/startCheckRows'
import { isZzTestJob } from '../jobs/zzTestJobSweep'

/** A job that holds an open bullet on them, as the read hands it. */
export type StartOwedJob = { id: string; label: string; name: string; developmentId: string | null; developmentName: string | null; address: string | null; gcContact: string | null; gcName: string | null; customerName: string | null }

export type StartOwedSources = {
  jobs: readonly StartOwedJob[]
  lines: readonly StageLine[]
  rows: StartCheckRows
  settings: readonly StartSettingsRow[]
}

export type StartOwedSite = {
  /** The site's id, or the job's for a job on no site. */
  key: string
  developmentId: string | null
  /** The job to open when the stage is on no site. */
  jobId: string
  name: string
  contact: string
  answers: number
  stages: number
}

export type StartAnswersOwed = { sites: StartOwedSite[]; answers: number; stages: number }

/**
 * The sources without ZZ test jobs, for every seat that hides them (punch list #61): a walk's test job owes the office
 * nothing. The rule is the Pipeline's own, the job's name or its customer's. The same object when there is none.
 */
export function withoutZzTestStartJobs(sources: StartOwedSources): StartOwedSources {
  const isZz = (j: StartOwedJob) => isZzTestJob({ job_name: j.name, customer_name: j.customerName })
  return sources.jobs.some(isZz) ? { ...sources, jobs: sources.jobs.filter((j) => !isZz(j)) } : sources
}

/** A site's key: its development, or the job itself when it is on none. */
export const startOwedSiteKey = (job: Pick<StartOwedJob, 'id' | 'developmentId'>): string => job.developmentId ?? `job:${job.id}`

/**
 * The answers owed, site by site, the most first. `farSites` holds the keys of the sites far from the shop, for the
 * default notice. A site whose day to decide is not near owes nothing yet and is left out.
 */
export function startAnswersOwed(sources: StartOwedSources, today: string, farSites: ReadonlySet<string> = new Set(), dayOf: (iso: string) => string = (iso) => iso.slice(0, 10)): StartAnswersOwed {
  const bySite = new Map<string, StartOwedJob[]>()
  for (const job of sources.jobs) bySite.set(startOwedSiteKey(job), [...(bySite.get(startOwedSiteKey(job)) ?? []), job])
  const sites: StartOwedSite[] = []
  for (const [key, jobs] of bySite) {
    const first = jobs[0]
    if (!first) continue
    const jobIds = new Set(jobs.map((j) => j.id))
    const notice = noticeFor({
      onSite: !!first.developmentId,
      site: sources.settings.find((s) => s.development_id != null && s.development_id === first.developmentId) ?? null,
      job: sources.settings.find((s) => s.job_id === first.id) ?? null,
      far: farSites.has(key),
    })
    const named = jobs.find((j) => (j.gcContact ?? '').trim()) ?? first
    const site: Site = { noticeDays: notice.days, contact: contactName({ gcContact: named.gcContact, gc: named.gcName, customer: named.customerName }) }
    const stages = sources.lines.filter((l) => jobIds.has(l.jobId)).map((line) => stageFromRows(line, sources.rows, { jobLabel: '', part: '', dayOf }))
    const answers = answersOwed(stages, site, today)
    if (!answers) continue
    sites.push({ key, developmentId: first.developmentId, jobId: first.id, name: (first.developmentName ?? '').trim() || first.name || first.label, contact: site.contact, answers, stages: stagesToAsk(stages, site, today).length })
  }
  sites.sort((a, b) => b.answers - a.answers || a.name.localeCompare(b.name))
  return { sites, answers: sites.reduce((n, s) => n + s.answers, 0), stages: sites.reduce((n, s) => n + s.stages, 0) }
}

/** The sites that read the default notice, so their distance must be known: every site with no number of its own. */
export function sitesOnDefaultNotice(sources: StartOwedSources): Array<{ key: string; address: string }> {
  const out = new Map<string, string>()
  for (const job of sources.jobs) {
    const key = startOwedSiteKey(job)
    const own = job.developmentId ? sources.settings.some((s) => s.development_id === job.developmentId && s.notice_days != null) : sources.settings.some((s) => s.job_id === job.id && s.notice_days != null)
    const address = (job.address ?? '').trim()
    if (!own && address && !out.has(key)) out.set(key, address)
  }
  return [...out].map(([key, address]) => ({ key, address }))
}

/** The line's title: *Ray owes us 6 answers on 2 stages*, or the count across sites when there is more than one. */
export function startOwedTitle(d: StartAnswersOwed): string {
  const tail = `${countWords(d.answers, 'answer', 'answers')} on ${countWords(d.stages, 'stage', 'stages')}`
  const one = d.sites.length === 1 ? d.sites[0] : null
  // The contact can be *the customer* when nobody is named, and a line never opens lower case (the walk, 2026-11-20).
  const line = one ? `${one.contact} owes us ${tail}` : `Customers owe us ${tail}`
  return line.charAt(0).toUpperCase() + line.slice(1)
}

/** Under the title: the site, how many more, and what the press does. */
export function startOwedDetail(d: StartAnswersOwed): string {
  const first = d.sites[0]
  if (!first) return ''
  const more = d.sites.length - 1
  const where = more <= 0 ? `${first.name}.` : `${first.name} and ${countWords(more, 'more site', 'more sites')}.`
  return `${where} Each is something that must be true before a stage starts. Ask before the day we decide.`
}

/** The press: it opens the list. It asks nobody. */
export const START_OWED_ACTION = 'Open the list'

/** The first site's Schedule look, or the Pipeline with the job's window open for a job on no site: its list is on Documents. */
export function startOwedHref(site: Pick<StartOwedSite, 'developmentId' | 'jobId'> | null | undefined): string {
  if (!site) return '/jobs?tab=stages'
  return site.developmentId ? `/developments/${encodeURIComponent(site.developmentId)}?look=schedule` : `/jobs?tab=stages&jobDetail=${encodeURIComponent(site.jobId)}`
}
