/**
 * GC mode, the real build, Owner Billing's O2b: bill day across every job, moved word for word from the GC mode
 * prototype (branch spike/gc-mode, `gcOwnerBillingDay.ts`).
 */
import { sentBackOpen } from './building'
import { partnerById } from './lookups'
import type { OwnerPayApp } from './ownerBilling'
import { appCertified, missingTradeWaivers, nextOwnerBillDay, owedDrawWords, ownerAllBilled, ownerPayApp, ownerPayAppHasWork, ownerPayAppsSent, tradeWaiverChecks, tradesOwingUnconditional } from './ownerBilling'
import type { GcProject, GcState, OwnerPayAppSent } from './types'
import { money } from './words'

export interface BillDayNote {
  /** Amber: worth reading before it goes. Grey: for the record. */
  tone: 'amber' | 'grey'
  words: string
}

export interface BillDayJob {
  project: GcProject
  /** The draft as it would go today. */
  app: OwnerPayApp
  /** Something to bill: new work since the last bill. */
  ready: boolean
  /** The bill already sent for this bill day, if it went. */
  sent: OwnerPayAppSent | null
  /** Every line is billed: closeout and the final pay application take over. */
  allBilled: boolean
  notes: BillDayNote[]
}

export interface BillDay {
  /** The bill day: the 25th. */
  on: string
  jobs: BillDayJob[]
  /** What the ready ones ask, added up. */
  readyTotal: number
}

/** Bill day across every job that is ours: each job's draft, its notes, and whether it went. */
export function billDay(state: GcState): BillDay {
  const on = nextOwnerBillDay(state.today)
  const jobs = state.projects
    .filter((p) => p.stage === 'buyout' || p.stage === 'building')
    .map((project): BillDayJob => {
      const app = ownerPayApp(state, project)
      const sentApps = ownerPayAppsSent(project)
      const last = sentApps[sentApps.length - 1]
      const sent = last && last.periodTo === on ? last : null
      const allBilled = ownerAllBilled(state, project)
      const ready = !sent && !allBilled && ownerPayAppHasWork(app) && app.due > 0.5
      const notes: BillDayNote[] = []
      if (ready) {
        if (!app.started) notes.push({ tone: 'amber', words: 'We have not pressed Start on this job yet.' })
        if (last && last.paidOn === null && appCertified(last) === null) {
          notes.push({ tone: 'amber', words: `Pay application ${last.number} still waits on ${project.architect} to certify.` })
        }
        const checks = tradeWaiverChecks(state, project, Object.fromEntries(app.lines.map((l) => [l.id, l.doneToDate])))
        for (const c of missingTradeWaivers(checks)) {
          notes.push({ tone: 'amber', words: `${c.company} has not given a waiver for ${money(c.missing)} of their work on this bill.` })
        }
        for (const c of tradesOwingUnconditional(checks)) {
          notes.push({ tone: 'amber', words: `${c.company} still owes the unconditional waiver for ${owedDrawWords(c.owedUnconditional)}.` })
        }
        for (const pkg of project.packages) {
          if (!pkg.sow || !sentBackOpen(pkg.sow)) continue
          const invite = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
          const company = (invite ? partnerById(state, invite.partnerId)?.company : undefined) ?? pkg.trade
          notes.push({ tone: 'grey', words: `We sent ${company}'s pay application back, so ${pkg.trade} bills what we see.` })
        }
      }
      return { project, app, ready, sent, allBilled, notes }
    })
  return { on, jobs, readyTotal: jobs.filter((j) => j.ready).reduce((t, j) => t + j.app.due, 0) }
}
