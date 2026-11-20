/**
 * Before we start (punch list #382, PR 5): every stage ahead on one site, for the Schedule look. The site's jobs
 * are asked one by one whether this person is on the desk, and only those jobs are read: their stage lines, our
 * days, the rows, the site's notice and the company's lists. Each line becomes a `Stage` with the job it is on. A
 * press writes through the io and reads again. A site where this person is on no job's desk, or where no job has a
 * stage line, has no look.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabaseStartReadersIo, type ReaderJob, type StartReadersIo } from '../lib/startChecks/startCheckReadersIo'
import { useStartCheckReads } from './useStartCheckReads'
import type { Site, Stage } from '../lib/startChecks/startChecks'
import { NO_START_ROWS, noticeFor, stageFromRows, type Notice, type StageLine, type StartCheckRows, type StartSettingsRow, type StartTemplateRow } from '../lib/startChecks/startCheckRows'
import { supabaseStartChecksIo, type StartChecksIo } from '../lib/startChecks/startChecksIo'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../lib/offlineRecoveryState'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'

/** A job of the site, as the look names it. */
export type SiteStartJob = { id: string; label: string; part: string; bidId?: string | null; address?: string | null }

const NO_LINES: readonly StageLine[] = []

type Loaded = { key: string; deskJobIds: string[]; lines: StageLine[]; rows: StartCheckRows; site: StartSettingsRow | null; templates: StartTemplateRow[] }

export interface SiteStartChecksRead {
  /** The look has something to show: this person is on a desk here, and a job has a stage line. */
  shows: boolean
  loading: boolean
  failure: OfflineRecoveryLastError | null
  /** One stage a stage line, in the jobs' order, with its line beside it. */
  stages: Array<{ stage: Stage; line: StageLine }>
  rows: StartCheckRows
  site: Site
  notice: Notice
  templates: StartTemplateRow[]
  reload: () => void
  press: (write: (io: StartChecksIo) => Promise<void>) => Promise<void>
  io: StartChecksIo
}

export function useSiteStartChecks(args: { developmentId: string; jobs: readonly SiteStartJob[]; contact: string; far: boolean; enabled: boolean; io?: StartChecksIo; readers?: StartReadersIo | null; role?: string | null; todayYmd?: string }): SiteStartChecksRead {
  const io = args.io ?? supabaseStartChecksIo
  const { developmentId, jobs, enabled } = args
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [loading, setLoading] = useState(false)
  const [gen, setGen] = useState(0)
  const jobKey = useMemo(() => jobs.map((j) => j.id).join(','), [jobs])
  const key = enabled && jobKey ? `${developmentId}|${jobKey}` : ''

  const read = useCallback(async (): Promise<Loaded> => {
    const ids = jobKey ? jobKey.split(',') : []
    const desk = await Promise.all(ids.map((id) => io.onDesk(id).catch(() => false)))
    const deskJobIds = ids.filter((_, i) => desk[i])
    if (!deskJobIds.length) return { key: `${developmentId}|${jobKey}`, deskJobIds, lines: [], rows: NO_START_ROWS, site: null, templates: [] }
    const [lineLists, rows, settings, templates] = await Promise.all([
      Promise.all(deskJobIds.map((id) => io.readLines(id))),
      io.readRows(deskJobIds),
      io.readSettings({ jobId: deskJobIds[0] as string, developmentId }),
      io.readTemplates(),
    ])
    return { key: `${developmentId}|${jobKey}`, deskJobIds, lines: lineLists.flat(), rows, site: settings.site, templates }
  }, [io, developmentId, jobKey])

  useEffect(() => {
    if (!key) return
    let live = true
    setLoading(true)
    read().then(
      (next) => {
        if (!live) return
        setLoaded(next)
        setFailure(null)
        setLoading(false)
      },
      (e: unknown) => {
        if (!live) return
        setFailure(recoveryFailureFromError(e, 'The schedule could not be read.'))
        setLoading(false)
      },
    )
    return () => {
      live = false
    }
  }, [key, read, gen])

  const reload = useCallback(() => setGen((g) => g + 1), [])
  const press = useCallback(
    async (write: (w: StartChecksIo) => Promise<void>) => {
      await write(io)
      // The write is kept by now, so a read that fails here is a read that failed and never a press that failed: it
      // is not thrown. The look draws its retry panel in place of cards that are out of date.
      try {
        const next = await read()
        setLoaded(next)
        setFailure(null)
      } catch (e) {
        setFailure(recoveryFailureFromError(e, 'The schedule could not be read.'))
      }
    },
    [io, read],
  )

  const mine = loaded && loaded.key === key ? loaded : null
  const notice = useMemo(() => noticeFor({ onSite: true, site: mine?.site ?? null, job: null, far: args.far }), [mine, args.far])
  const site = useMemo<Site>(() => ({ noticeDays: notice.days, contact: args.contact }), [notice.days, args.contact])
  // What the app reads for a bullet of ours: the real reads beside the real io, none beside a test's in-memory one.
  const readers = args.readers !== undefined ? args.readers : args.io ? null : supabaseStartReadersIo
  const readerJobs = useMemo<ReaderJob[]>(() => jobs.map((j) => ({ id: j.id, bidId: j.bidId ?? null, address: j.address ?? null, developmentId })), [jobs, developmentId])
  const readUs = useStartCheckReads({ io: readers, jobs: readerJobs, lines: mine?.lines ?? NO_LINES, bullets: mine?.rows.bullets ?? NO_START_ROWS.bullets, role: args.role ?? null, todayYmd: args.todayYmd ?? '' })
  const stages = useMemo(() => {
    if (!mine) return []
    const jobOf = new Map(jobs.map((j) => [j.id, j]))
    return mine.lines.map((line) => {
      const job = jobOf.get(line.jobId)
      return { line, stage: stageFromRows(line, mine.rows, { jobLabel: job?.label ?? '', part: job?.part ?? '', dayOf: calendarYmdInAppTzFromIso, readUs }) }
    })
  }, [mine, jobs, readUs])

  return { shows: stages.length > 0 || (!!failure && !!key), loading: !!key && (loading || (!mine && !failure)), failure, stages, rows: mine?.rows ?? NO_START_ROWS, site, notice, templates: mine?.templates ?? [], reload, press, io }
}
