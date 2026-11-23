/**
 * A `StartChecksIo` that keeps its rows in memory, for the render smokes of Before we start (punch list #382). It
 * writes the way the tables do where a test would notice: a row's job is its stage line's, one live yes a bullet, a
 * yes taken back stays as a row, and a day they gave is added and never changed. Nothing here talks to a database.
 */
import { NO_START_ROWS, type StageLine, type StartCheckRows, type StartSettingsRow, type StartTemplateRow } from '../lib/startChecks/startCheckRows'
import type { ArrivalAsk, StartChecksIo } from '../lib/startChecks/startChecksIo'

export type MemoryStart = {
  lines: StageLine[]
  rows: StartCheckRows
  site: StartSettingsRow | null
  job: StartSettingsRow | null
  templates: StartTemplateRow[]
  gcContact: string | null
  onDesk: boolean
  /** What the crew is asked on arrival, and what it answered. */
  arrival?: ArrivalAsk | null
  arrived?: { fixtureId: string; notAsTold: string[]; shown: string[] }
  /** When set, the desk covers these jobs alone. */
  deskJobs?: string[]
  /** The next desk check fails with this error, once. */
  failDesk?: unknown
  /** Every write, by name, in the order it was made. */
  calls: string[]
  /** The next write fails with this reason, once. */
  failNext: string | null
  /** Who the one door says pressed Go or Hold. */
  decider: string
  /** The day the one door stamps. */
  today: string
}

export function memoryStart(over: Partial<MemoryStart> = {}): MemoryStart {
  return { lines: [], rows: { ...NO_START_ROWS }, site: null, job: null, templates: [], gcContact: 'Ray Ortiz', onDesk: true, calls: [], failNext: null, decider: 'Dana', today: '2026-11-17', ...over }
}

let seq = 0
const id = (p: string) => `${p}-${++seq}`
const now = () => new Date(Date.UTC(2026, 10, 17, 15, 0, ++seq)).toISOString()

export function memoryStartChecksIo(db: MemoryStart): StartChecksIo {
  const write = (name: string) => {
    db.calls.push(name)
    if (db.failNext) {
      const why = db.failNext
      db.failNext = null
      throw new Error(why)
    }
  }
  const put = (rows: Partial<StartCheckRows>) => {
    db.rows = { ...db.rows, ...rows }
  }
  return {
    onDesk: async (jobId) => {
      if (db.failDesk) {
        const why = db.failDesk
        db.failDesk = null
        throw why
      }
      return db.onDesk && (!db.deskJobs || db.deskJobs.includes(jobId))
    },
    readLines: async (jobId) => db.lines.filter((l) => l.jobId === jobId).map((l) => ({ ...l })),
    readRows: async (jobIds) => {
      const mine = <T extends { job_id: string }>(list: T[]) => list.filter((r) => jobIds.includes(r.job_id))
      return { bullets: mine(db.rows.bullets), marks: mine(db.rows.marks), asks: mine(db.rows.asks), theirDays: mine(db.rows.theirDays), decisions: mine(db.rows.decisions), arrivals: mine(db.rows.arrivals) }
    },
    readSettings: async () => ({ site: db.site, job: db.job }),
    readTemplates: async () => db.templates.filter((t) => !t.retired_at),
    readGcContact: async () => db.gcContact,
    addBullets: async (bullets) => {
      write('addBullets')
      put({
        bullets: [
          ...db.rows.bullets,
          ...bullets.map((b) => ({ id: id('b'), job_id: b.jobId, fixture_id: b.fixtureId, sort_order: b.order, words: b.words, waits_on: b.on, wants_photo: b.on === 'them' && b.wantsPhoto, shown_to_gc: b.on === 'them', by_day: null, reads: b.on === 'us' ? (b.reads ?? 'hand') : null, hand_ok: false, hand_ok_at: null, hand_ok_by_name: '', template_id: b.templateId, removed_at: null, created_at: now() })),
        ],
      })
    },
    changeBullet: async (bulletId, patch) => {
      write('changeBullet')
      put({ bullets: db.rows.bullets.map((b) => (b.id === bulletId ? { ...b, ...(patch.words !== undefined ? { words: patch.words } : {}), ...(patch.wantsPhoto !== undefined ? { wants_photo: patch.wantsPhoto } : {}), ...(patch.shownToGc !== undefined ? { shown_to_gc: patch.shownToGc } : {}), ...(patch.byDay !== undefined ? { by_day: patch.byDay } : {}), ...(patch.reads !== undefined ? { reads: patch.reads, ...(patch.reads !== 'hand' ? { hand_ok: false, hand_ok_at: null, hand_ok_by_name: '' } : {}) } : {}) } : b)) })
    },
    removeBullet: async (bulletId) => {
      write('removeBullet')
      put({ bullets: db.rows.bullets.map((b) => (b.id === bulletId ? { ...b, removed_at: now() } : b)) })
    },
    tickByHand: async (bulletId, done, who) => {
      write('tickByHand')
      put({ bullets: db.rows.bullets.map((b) => (b.id === bulletId ? { ...b, hand_ok: done, hand_ok_at: done ? now() : null, hand_ok_by_name: done ? who.name : '' } : b)) })
    },
    sayYes: async (yes, standing) => {
      write('sayYes')
      const marks = db.rows.marks.map((m) => (m.id === standing ? { ...m, taken_back_at: now() } : m))
      put({ marks: [...marks, { id: yes.id ?? id('m'), bullet_id: yes.bulletId, job_id: yes.jobId, know: yes.know, who_name: yes.who, how: yes.how, said_on: yes.day, source: 'office', photo_storage_path: yes.photo?.path ?? null, photo_file_name: yes.photo?.fileName ?? null, taken_back_at: null, created_at: now() }] })
    },
    changeYes: async (markId, patch) => {
      write('changeYes')
      put({ marks: db.rows.marks.map((m) => (m.id === markId ? { ...m, ...(patch.know !== undefined ? { know: patch.know } : {}), ...(patch.who !== undefined ? { who_name: patch.who } : {}), ...(patch.how !== undefined ? { how: patch.how } : {}), ...(patch.day !== undefined ? { said_on: patch.day } : {}) } : m)) })
    },
    takeBackYes: async (markId) => {
      write('takeBackYes')
      put({ marks: db.rows.marks.map((m) => (m.id === markId ? { ...m, taken_back_at: now() } : m)) })
    },
    giveTheirDay: async (day) => {
      write('giveTheirDay')
      put({ theirDays: [...db.rows.theirDays, { id: id('d'), job_id: day.jobId, fixture_id: day.fixtureId, ready_day: day.readyDay, said_on: day.saidOn, who_name: day.who, how: day.how, source: 'office', removed_at: null, created_at: now() }] })
    },
    keepAsk: async (ask) => {
      write('keepAsk')
      const batch = id('batch')
      put({ asks: [...db.rows.asks, ...ask.rows.map((r) => ({ id: id('k'), batch_id: batch, job_id: r.jobId, fixture_id: r.fixtureId, bullet_id: r.bulletId, kind: ask.kind, how: ask.how, to_name: ask.to, asked_on: ask.day, created_at: now() }))] })
    },
    decide: async (fixtureId, kind, openThen, holdUntil) => {
      write('decide')
      const line = db.lines.find((l) => l.fixtureId === fixtureId)
      if (kind === 'hold' && !line?.window) throw new Error('Plan our days for this stage first. A hold moves them.')
      put({ decisions: [...db.rows.decisions, { id: id('g'), job_id: line?.jobId ?? '', fixture_id: fixtureId, kind, decided_on: db.today, open_then: [...openThen], start_then: line?.window?.[0] ?? null, hold_until: holdUntil, by_name: db.decider, taken_back_at: null, created_at: now() }] })
      if (kind === 'hold' && holdUntil && line?.window) {
        const len = Math.round((Date.parse(`${line.window[1]}T12:00:00Z`) - Date.parse(`${line.window[0]}T12:00:00Z`)) / 864e5)
        const end = new Date(Date.parse(`${holdUntil}T12:00:00Z`) + len * 864e5).toISOString().slice(0, 10)
        db.lines = db.lines.map((l) => (l.fixtureId === fixtureId ? { ...l, window: [holdUntil, end] } : l))
      }
    },
    takeBackDecision: async (decisionId) => {
      write('takeBackDecision')
      put({ decisions: db.rows.decisions.map((d) => (d.id === decisionId && !d.taken_back_at ? { ...d, taken_back_at: now() } : d)) })
    },
    setNotice: async (home, days) => {
      write('setNotice')
      if ('developmentId' in home) db.site = { id: db.site?.id ?? id('s'), development_id: home.developmentId, job_id: null, notice_days: days, shows_on_gc_page: false }
      else db.job = { id: db.job?.id ?? id('s'), development_id: null, job_id: home.jobId, notice_days: days, shows_on_gc_page: db.job?.shows_on_gc_page ?? false }
    },
    readArrival: async () => db.arrival ?? null,
    arrive: async (fixtureId, notAsTold, shown) => {
      write('arrive')
      db.arrived = { fixtureId, notAsTold: [...notAsTold], shown: [...shown] }
      db.arrival = null
      return { dispatchRequestId: notAsTold.length ? 'dr-1' : null, pushed: true }
    },
    setShowsOnGcPage: async (jobId, on) => {
      write('setShowsOnGcPage')
      db.job = { id: db.job?.id ?? id('s'), development_id: null, job_id: jobId, notice_days: db.job?.notice_days ?? null, shows_on_gc_page: on }
    },
    setWindow: async (line, start, end) => {
      write('setWindow')
      db.lines = db.lines.map((l) => (l.fixtureId === line.fixtureId ? { ...l, window: [start, end] } : l))
    },
    addTemplate: async (t) => {
      write('addTemplate')
      db.templates = [...db.templates, { id: id('t'), stage_kind: t.kind, sort_order: t.order, words: t.words, waits_on: t.on, wants_photo: t.wantsPhoto, reads: t.reads, retired_at: null }]
    },
    retireTemplate: async (templateId) => {
      write('retireTemplate')
      db.templates = db.templates.map((t) => (t.id === templateId ? { ...t, retired_at: now() } : t))
    },
    uploadPhoto: async (jobId, markId, blob, fileName, takenAt) => {
      write('uploadPhoto')
      return { path: `${jobId}/${markId}-1.jpg`, fileName, bytes: blob.size, takenAt }
    },
    photoUrl: async (path) => `https://photos.test/${path}`,
  }
}
