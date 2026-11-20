/**
 * A `StartChecksIo` that keeps its rows in memory, for the render smokes of Before we start (punch list #382). It
 * writes the way the tables do where a test would notice: a row's job is its stage line's, one live yes a bullet, a
 * yes taken back stays as a row, and a day they gave is added and never changed. Nothing here talks to a database.
 */
import { NO_START_ROWS, type StageLine, type StartCheckRows, type StartSettingsRow, type StartTemplateRow } from '../lib/startChecks/startCheckRows'
import type { StartChecksIo } from '../lib/startChecks/startChecksIo'

export type MemoryStart = {
  lines: StageLine[]
  rows: StartCheckRows
  site: StartSettingsRow | null
  job: StartSettingsRow | null
  templates: StartTemplateRow[]
  gcContact: string | null
  onDesk: boolean
  /** Every write, by name, in the order it was made. */
  calls: string[]
  /** The next write fails with this reason, once. */
  failNext: string | null
}

export function memoryStart(over: Partial<MemoryStart> = {}): MemoryStart {
  return { lines: [], rows: { ...NO_START_ROWS }, site: null, job: null, templates: [], gcContact: 'Ray Ortiz', onDesk: true, calls: [], failNext: null, ...over }
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
    onDesk: async () => db.onDesk,
    readLines: async () => db.lines.map((l) => ({ ...l })),
    readRows: async () => ({ ...db.rows }),
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
      put({ bullets: db.rows.bullets.map((b) => (b.id === bulletId ? { ...b, ...(patch.words !== undefined ? { words: patch.words } : {}), ...(patch.wantsPhoto !== undefined ? { wants_photo: patch.wantsPhoto } : {}), ...(patch.shownToGc !== undefined ? { shown_to_gc: patch.shownToGc } : {}), ...(patch.byDay !== undefined ? { by_day: patch.byDay } : {}) } : b)) })
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
    setNotice: async (home, days) => {
      write('setNotice')
      if ('developmentId' in home) db.site = { id: db.site?.id ?? id('s'), development_id: home.developmentId, job_id: null, notice_days: days, shows_on_gc_page: false }
      else db.job = { id: db.job?.id ?? id('s'), development_id: null, job_id: home.jobId, notice_days: days, shows_on_gc_page: db.job?.shows_on_gc_page ?? false }
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
