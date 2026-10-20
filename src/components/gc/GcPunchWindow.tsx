import { useEffect } from 'react'
import { Card, Why } from './gcUi'
import { GcPunchList, type PunchWrites } from './GcPunchList'
import { partnerById } from '../../lib/gc/lookups'
import type { GcProject, GcState } from '../../lib/gc/types'

/**
 * GC mode, the real build, the Building lane's U3b-ii: the Punch list window, one list per trade we hired with a signed
 * statement of work, on a job being built (the plan: to-dos/gc-mode/mockups/building-u3b.md on branch spike/gc-mode).
 * Its gate is Building's alone, with no money gate, since at Building's door the punch list goes to the schedule's team
 * while Closeout stays the money team's. Closeout shows the same lists under each trade's steps.
 */
export function GcPunchWindow({
  state,
  project,
  writes,
  busy = null,
  problem = null,
  onClose,
}: {
  /** The board with the job's punch list laid over it (`withPunch`). */
  state: GcState
  project: GcProject
  writes: PunchWrites
  busy?: string | null
  problem?: string | null
  onClose: () => void
}) {
  const trades = project.packages.flatMap((pkg) => {
    const partnerId = pkg.invites.find((i) => i.id === pkg.awardedInviteId)?.partnerId
    const partner = partnerId ? partnerById(state, partnerId) : undefined
    return pkg.sow?.status === 'signed' && !pkg.selfPerform && partner ? [{ pkg, company: partner.company }] : []
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(0.75rem + var(--app-top-chrome, 0px)) 0.75rem 0.75rem' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${project.name}: Punch list`}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(860px, 100%)', maxHeight: 'min(94vh, 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-strong)' }}
      >
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{project.name} · Punch list</div>
            <div data-punch-lede style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              What is left to fix on each trade we hired.
            </div>
          </div>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>
            ×
          </button>
        </div>
        <div style={{ padding: '0.8rem 1rem', overflowY: 'auto', display: 'grid', gap: '0.9rem' }}>
          {problem && (
            <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
              {problem}
            </div>
          )}
          <Why>
            Near the end of a trade's work, our superintendent walks it and lists what is left to fix. The trade fixes each item and tells us. We check it
            on the job, or send it back with what is still wrong. We accept their work once every item is checked.
          </Why>
          {trades.length === 0 && <Card>No trade we hire has a signed statement of work on this job yet.</Card>}
          {trades.map(({ pkg, company }) => (
            <Card key={pkg.id}>
              <div data-punch-trade={pkg.id}>
                <strong>{pkg.trade}</strong> <span style={{ color: 'var(--text-muted)' }}>{company}</span>
                <GcPunchList project={project} pkg={pkg} company={company} writes={writes} busy={busy} />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
