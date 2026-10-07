/**
 * GC mode, the real build, the schedule's PR 1b: sending the customer their schedule (G-94), moved word for word from the GC mode prototype
 * (branch spike/gc-mode, `gcCustomerScheduleSend.ts`). The letter reads the late finish and waits for Owner Billing's lift (O2).
 */
import type { ScheduleSend } from './types'
import type { GcProject } from '../types'

/** The letter as it would go today: who to, the subject, and the lines. */
export interface ScheduleLetter {
  to: string
  subject: string
  lines: string[]
}

/** The letter as a printable page: the portal's paper look, light, one paragraph a line. */
export function customerScheduleHtml(letter: ScheduleLetter): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(letter.subject)}</title><style>body{font:14px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#16283c;background:#fff;max-width:42rem;margin:2rem auto;padding:0 1rem}h1{font-size:1.15rem;margin:0 0 .25rem}p{margin:.45rem 0}.to{color:#555;margin-bottom:1rem}</style></head><body><h1>${esc(letter.subject)}</h1><div class="to">To ${esc(letter.to)}</div>${letter.lines.map((l) => `<p>${esc(l)}</p>`).join('')}</body></html>`
}

/** The record of a send, as it is kept on the project. */
export function scheduleSendRecord(project: GcProject, letter: ScheduleLetter, by: string, today: string): ScheduleSend {
  return { id: `${project.id}-ssend-${(project.scheduleSends ?? []).length + 1}`, on: today, by, to: letter.to, subject: letter.subject, lines: letter.lines }
}

/** Every send, newest first. */
export function scheduleSends(project: GcProject): ScheduleSend[] {
  return [...(project.scheduleSends ?? [])].reverse()
}
