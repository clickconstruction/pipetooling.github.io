/**
 * Before we start (punch list #382, PR 4): one job's stages with their lists, read for a person on the job's desk.
 * The stage lines, our days, the rows, the settings, the company's lists and who we ask come in together, and
 * `stageFromRows` reads each line against its own. A press writes through the io and reads again, so the list a
 * person sees is what the database holds. A person who is not on the desk gets no rows and no screen. A press that
 * fails throws, so the value or the row that made it says why where it stands.
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
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../lib/offlineRecoveryState'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'

export type StartChecksJob = {
  id: string
  /** The job as the app prints it: its number. */
  label: string
  developmentId: string | null
  bidId: string | null
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
  /** False until the database says this person is on the job's desk. Null while it is asked. */
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
  /** Run a write, then read again. The write's failure is thrown to the caller. */
  press: (write: (io: StartChecksIo) => Promise<void>) => Promise<void>
  io: StartChecksIo
}

export function useJobStartChecks(job: StartChecksJob, options: { io?: StartChecksIo; far?: boolean; readUs?: (row: StartBulletRow) => UsReading | null } = {}): JobStartChecksRead {
  const io = options.io ?? supabaseStartChecksIo
  const [onDesk, setOnDesk] = useState<boolean | null>(null)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [loading, setLoading] = useState(false)
  const [gen, setGen] = useState(0)

  useEffect(() => {
    let live = true
    setOnDesk(null)
    io.onDesk(job.id).then(
      (yes) => live && setOnDesk(yes),
      () => live && setOnDesk(false),
    )
    return () => {
      live = false
    }
  }, [io, job.id])

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

  const reload = useCallback(() => setGen((g) => g + 1), [])
  const press = useCallback(
    async (write: (io: StartChecksIo) => Promise<void>) => {
      await write(io)
      // Read again in place, so the row moves when the write has landed and not before.
      setLoaded(await read())
    },
    [io, read],
  )

  const mine = loaded && loaded.jobId === job.id ? loaded : null
  const far = options.far ?? false
  const readUs = options.readUs
  const notice = useMemo(() => noticeFor({ onSite: !!job.developmentId, site: mine?.settings.site ?? null, job: mine?.settings.job ?? null, far }), [job.developmentId, mine, far])
  const site = useMemo<Site>(() => ({ noticeDays: notice.days, contact: contactName({ gcContact: mine?.gcContact, gc: job.gcName, customer: job.customerName }) }), [notice.days, mine, job.gcName, job.customerName])
  const stages = useMemo(
    () => (mine ? mine.lines.map((line) => stageFromRows(line, mine.rows, { jobLabel: job.label, part: '', dayOf: calendarYmdInAppTzFromIso, readUs })) : []),
    [mine, job.label, readUs],
  )

  return {
    onDesk,
    loading: onDesk === null || loading,
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
