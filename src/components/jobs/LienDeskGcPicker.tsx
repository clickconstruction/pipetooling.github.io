import { Fragment } from 'react'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { workMonthShort } from '../../lib/jobs/forecastWorkMonths'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { LIEN_DESK_LEAD_DAYS } from '../../lib/jobs/lienDesk'
import { LIEN_GC_PICKER_NOTHING_LEFT, LIEN_GC_PICKER_URGENT_DAYS, lienGcPickerCloseWords, type LienGcPickerOption } from '../../lib/jobs/lienDeskGcPicker'
import { lienBoxHeadStyle as boxHead, lienRowChipStyle as chip } from './lienDeskRowStyles'

/**
 * Put a GC on notice… on a phone (v2.3470; rows v2.3817; its own file since v2.7586, out of `LienDesk.tsx` as it
 * stood): the sheet More opens, one row a GC with unpaid work, the ones with nothing left to claim last. Until
 * v2.7806 it was also a computer's amber door on the title bar with this list as a menu under it; a computer now has
 * the press on the job's own notice (`lienGcNoticePress`) and never draws this. The desk keeps whether it is open; the
 * rows are `buildLienGcPickerOptions`.
 */
export function LienDeskGcPicker({ open, onClose, options, onPick }: { open: boolean; onClose: () => void; options: ReadonlyArray<LienGcPickerOption>; onPick: (gcId: string) => void }) {
  return (
    <div style={{ position: 'relative' }}>
      {open ? (
        <>
          <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 5, background: 'rgba(15, 23, 42, 0.35)' }} />
          <div role="menu" aria-label="GCs with unpaid work" data-lien-gc-picker style={{ position: 'fixed', left: '0.75rem', right: '0.75rem', top: '16vh', zIndex: 6, width: 'auto', maxHeight: '70vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '0.45rem 0.75rem 0.35rem' }}>
              <div style={boxHead}>Put a GC on notice</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>Notices due in the next {LIEN_DESK_LEAD_DAYS} days, most money first. The run covers every unpaid job with the GC, not only these.</div>
            </div>
            {options.map((g, i) => {
              const firstDead = g.nothingToClaim && (i === 0 || !options[i - 1]!.nothingToClaim)
              const closes = lienGcPickerCloseWords(g, formatYmdMonthDay)
              const soon = g.daysLeft != null && g.daysLeft <= LIEN_GC_PICKER_URGENT_DAYS
              return (
                <Fragment key={g.id}>
                  {firstDead ? <div style={{ ...boxHead, padding: '0.35rem 0.75rem 0.25rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>{LIEN_GC_PICKER_NOTHING_LEFT}</div> : null}
                  <button type="button" role="menuitem" data-lien-gc-option={g.id} data-nothing-to-claim={g.nothingToClaim ? 'yes' : 'no'} onClick={() => { onClose(); onPick(g.id) }} title={g.nothingToClaim ? 'Every window on this GC’s jobs here has closed — a run would send no notice; the money is Collections’ now' : undefined} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '2px 0.75rem', width: '100%', padding: '0.45rem 0.75rem', border: 'none', borderTop: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit', fontSize: '0.8125rem', opacity: g.nothingToClaim ? 0.65 : 1 }}>
                    <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</strong>
                    <strong style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: g.nothingToClaim ? 'var(--text-muted)' : undefined }}>{formatUsdNoCents(g.open)}</strong>
                    <span style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '3px 6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      <span>{g.jobs} job{g.jobs === 1 ? '' : 's'}</span>
                      {closes ? <span style={{ color: soon ? 'var(--text-red-600)' : 'var(--text-amber-800)', fontWeight: 600 }}>· {closes}</span> : null}
                      {g.nothingToClaim ? (
                        <>
                          <span style={chip('var(--bg-red-tint)', 'var(--text-red-700)')}>{g.closedMonths.length ? `${g.closedMonths.map(workMonthShort).join(' + ')} window${g.closedMonths.length === 1 ? '' : 's'} closed` : 'every window closed'}</span>
                          <span>the lien is gone · chase it in Collections</span>
                        </>
                      ) : null}
                      {g.needOwner > 0 ? <span style={chip('var(--bg-amber-tint)', 'var(--text-amber-800)')}>{g.jobs === 1 ? 'needs the owner' : `${g.needOwner} need${g.needOwner === 1 ? 's' : ''} the owner`}</span> : null}
                      {g.awaiting > 0 ? <span style={chip('var(--bg-blue-tint)', 'var(--text-blue-700)')}>{g.jobs === 1 ? 'awaiting approval' : `${g.awaiting} awaiting approval`}</span> : null}
                      {g.missed > 0 && !g.nothingToClaim ? <span style={chip('var(--bg-red-tint)', 'var(--text-red-700)')}>{g.missed} missed</span> : null}
                      {g.policy === 'send' ? <span style={chip('var(--bg-subtle)', 'var(--text-muted)')}>rule: send</span> : null}
                    </span>
                  </button>
                </Fragment>
              )
            })}
          </div>
        </>
      ) : null}
    </div>
  )
}
