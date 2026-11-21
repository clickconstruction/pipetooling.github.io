/**
 * Before we start (punch list #382, PR 4): one job's stages with their lists, read for a person on the job's desk.
 * The stage lines, our days, the rows, the settings, the company's lists and who we ask come in together, and
 * `stageFromRows` reads each line against its own. A press writes through the io and reads again, so the list a
 * person sees is what the database holds. A person who is not on the desk gets no rows and no screen. A desk check
 * that fails is not a no: the desk stays unknown, with the failure, until Retry asks again. A press that fails
 * throws, so the value or the row that made it says why where it stands.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Site, Stage } from '../lib/startChecks/startChecks'
import {
  NO_START_ROWS,
  contactName,
  noticeFor,
  stageFromRows,
  type Notice,
  type StageLine,
  type StartCheckRows,
  type StartSettingsRow,
  type StartTemplateRow,
  type UsReading,
  type StartBulletRow,
} from '../lib/startChecks/startCheckRows'
import { supabaseStartChecksIo, type StartChecksIo } from '../lib/startChecks/startChecksIo'
import { supabaseStartReadersIo, type ReaderJob, type StartReadersIo } from '../lib/startChecks/startCheckReadersIo'
import { useStartCheckReads } from './useStartCheckReads'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../lib/offlineRecoveryState'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'

const NO_LINES: readonly StageLine[] = []
const NO_BULLETS: readonly StartBulletRow[] = []

export type StartChecksJob = {
  id: string
  /** The job as the app prints it: its number. */
  label: string
  developmentId: string | null
  bidId: string | null
  /** The job's address: a bullet of ours that reads the city's permits reads them here. */
  address?: string | null
  /** The GC on the job, and the customer: who we ask when the bid names no contact. */
  gcName: string | null
  customerName: string | null
}

type Loaded = {
  jobId: string
  lines: StageLine[]
  rows: StartCheckRows
  settings: { site: StartSettingsRow | null; job: StartSettingsRow | null }
  templates: StartTemplateRow[]
  gcContact: string | null
}

export interface JobStartChecksRead {
  /** True once the database says this person is on the job's desk. Null while it is asked, and when the asking failed. */
  onDesk: boolean | null
  loading: boolean
  failure: OfflineRecoveryLastError | null
  lines: StageLine[]
  /** One stage a line, in the job's order. */
  stages: Stage[]
  rows: StartCheckRows
  site: Site
  notice: Notice
  templates: StartTemplateRow[]
  settings: { site: StartSettingsRow | null; job: StartSettingsRow | null }
  reload: () => void
  /** Run a write, then read again. The write's failure is thrown to the caller. A failure of the read after it is not: it lands in `failure`. */
  press: (write: (io: StartChecksIo) => Promise<void>) => Promise<void>
  io: StartChecksIo
}

/**
 * `readers` reads the app for a bullet of ours. Left out, the real one runs beside the real io, and none beside a
 * test's in-memory io. `readUs` is a reader handed in whole, which wins.
 */
export function useJobStartChecks(job: StartChecksJob, options: { io?: StartChecksIo; far?: boolean; readUs?: (row: StartBulletRow) => UsReading | null; readers?: StartReadersIo | null; role?: string | null; todayYmd?: string } = {}): JobStartChecksRead {
  const io = options.io ?? supabaseStartChecksIo
  const readers = options.readers !== undefined ? options.readers : options.io ? null : supabaseStartReadersIo
  const [onDesk, setOnDesk] = useState<boolean | null>(null)
  // The desk check is out: the first one, or one asked again after it failed.
  const [asking, setAsking] = useState(true)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [loading, setLoading] = useState(false)
  const [gen, setGen] = useState(0)
  const [deskGen, setDeskGen] = useState(0)

  // Another job's failure is not this job's.
  useEffect(() => setFailure(null), [io, job.id])

  useEffect(() => {
    let live = true
    setOnDesk(null)
    setAsking(true)
    io.onDesk(job.id).then(
      (yes) => {
        if (!live) return
        setOnDesk(yes)
        if (!yes) setFailure(null)
        setAsking(false)
      },
      (e: unknown) => {
        if (!live) return
        // A check that failed is not a no. The desk stays unknown, and the section says why and offers Retry.
        setFailure(recoveryFailureFromError(e, 'The list could not be read.'))
        setAsking(false)
      },
    )
    return () => {
      live = false
    }
  }, [io, job.id, deskGen])

  const read = useCallback(async (): Promise<Loaded> => {
    const [lines, rows, settings, templates, gcContact] = await Promise.all([
      io.readLines(job.id),
      io.readRows([job.id]),
      io.readSettings({ jobId: job.id, developmentId: job.developmentId }),
      io.readTemplates(),
      job.bidId ? io.readGcContact(job.bidId).catch(() => null) : Promise.resolve(null),
    ])
    return { jobId: job.id, lines, rows, settings, templates, gcContact }
  }, [io, job.id, job.developmentId, job.bidId])

  useEffect(() => {
    if (onDesk !== true) return
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
        setFailure(recoveryFailureFromError(e, 'The list could not be read.'))
        setLoading(false)
      },
    )
    return () => {
      live = false
    }
  }, [onDesk, read, gen])

  // Retry asks again for what failed: the desk check while the desk is unknown, the list once it is known.
  const reload = useCallback(() => (onDesk === true ? setGen((g) => g + 1) : setDeskGen((g) => g + 1)), [onDesk])
  const press = useCallback(
    async (write: (io: StartChecksIo) => Promise<void>) => {
      await write(io)
      // Read again in place, so the row moves when the write has landed and not before. The write is kept by now, so
      // a read that fails here is a read that failed and never a press that failed: it is not thrown. The section
      // draws its retry panel in place of a list that is out of date, and no caller says the press was lost.
      try {
        const next = await read()
        setLoaded(next)
        setFailure(null)
      } catch (e) {
        setFailure(recoveryFailureFromError(e, 'The list could not be read.'))
      }
    },
    [io, read],
  )

  const mine = loaded && loaded.jobId === job.id ? loaded : null
  const far = options.far ?? false
  const readerJobs = useMemo<ReaderJob[]>(() => [{ id: job.id, bidId: job.bidId, address: job.address ?? null, developmentId: job.developmentId }], [job.id, job.bidId, job.address, job.developmentId])
  const appReads = useStartCheckReads({ io: readers, jobs: readerJobs, lines: mine?.lines ?? NO_LINES, bullets: mine?.rows.bullets ?? NO_BULLETS, role: options.role ?? null, todayYmd: options.todayYmd ?? '' })
  const readUs = options.readUs ?? appReads
  const notice = useMemo(() => noticeFor({ onSite: !!job.developmentId, site: mine?.settings.site ?? null, job: mine?.settings.job ?? null, far }), [job.developmentId, mine, far])
  const site = useMemo<Site>(() => ({ noticeDays: notice.days, contact: contactName({ gcContact: mine?.gcContact, gc: job.gcName, customer: job.customerName }) }), [notice.days, mine, job.gcName, job.customerName])
  const stages = useMemo(
    () => (mine ? mine.lines.map((line) => stageFromRows(line, mine.rows, { jobLabel: job.label, part: '', dayOf: calendarYmdInAppTzFromIso, readUs })) : []),
    [mine, job.label, readUs],
  )

  return {
    onDesk,
    loading: asking || loading,
    failure,
    lines: mine?.lines ?? [],
    stages,
    rows: mine?.rows ?? NO_START_ROWS,
    site,
    notice,
    templates: mine?.templates ?? [],
    settings: mine?.settings ?? { site: null, job: null },
    reload,
    press,
    io,
  }
}
