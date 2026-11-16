/**
 * SPIKE ONLY: the list of views on `/spike-sub-labor.html`. One entry per prototype state worth a screenshot.
 * Deleted at wrap-up.
 */
import type { ReactNode } from 'react'
import { RosterView } from './RosterView'
import { JobSubsOwedView } from '../components/jobs/JobSubsOwedBlock'
import { SheetCrewWhoLineView, SheetJobTeamOffer, SheetSameLineWarning } from '../components/jobs/SheetCrewHints'
import { sheetAmountsShown, sheetAmountsView, sheetNamedNotPaidWords } from '../lib/subWorkOrders/sheetAmountsView'
import { sheetParties } from '../lib/subWorkOrders/sheetParties'
import { RideAlongCleanUpWindowView } from '../components/people/RideAlongCleanUpWindow'
import { rideAlongCleanUp } from '../lib/subWorkOrders/rideAlongCleanUp'
import { WhoseSheetWindow } from '../components/people/WhoseSheetWindow'
import { buildJobOwedBlock } from '../lib/people/subOwedBreakdown'
import { crewStepLine, crewStepTitle } from '../lib/subWorkOrders/sheetCrewWords'
import { buildSheetPartiesLookup } from '../lib/subWorkOrders/sheetParties'
import { SPIKE_ROSTER, SPIKE_SHEETS, spikeOwedInputs } from './fixtures'
import { say } from './say'
import { SubPapersWindowView, type SubPapersOpen } from '../components/jobs/SubPapersWindow'
import { paperSheetsFor } from '../lib/subWorkOrders/subPapersInputs'
import type { PaperContext } from '../../supabase/functions/_shared/subPapers'
import { SPIKE_ASSIGNEES, SPIKE_JOB_NAMES, SPIKE_REGISTER, SPIKE_TODAY } from './fixtures'

const PAPER_CTX: PaperContext = { company: { name: 'Your Company Name', lines: ['100 Example Way, Suite 4', '(555) 010-0100'] }, sub: { name: 'Harlan Mechanical', lines: ['22 Foundry Row'] }, today: SPIKE_TODAY, preparedAt: 'Nov 13, 2026 at 2:40 pm', zone: 'Central time' }
const harlanPapers = () => paperSheetsFor('id:harlan', SPIKE_SHEETS.map((x) => x.sheet), SPIKE_ASSIGNEES, SPIKE_JOB_NAMES, SPIKE_ROSTER, { register: SPIKE_REGISTER })
function Papers({ open, send = false, email = 'office@harlan-mechanical.example' as string | null }: { open: SubPapersOpen; send?: boolean; email?: string | null }) {
  return (
    <SubPapersWindowView
      open={open}
      sheets={harlanPapers()}
      ctx={PAPER_CTX}
      contact={{ email, phone: '(555) 010-0142', portalUrl: 'https://example.test/s/harlan' }}
      lastStatement={{ number: 'SA-0051', endedOn: '2026-09-30' }}
      canSend
      startOnSend={send}
      onDownload={say('Downloads the PDF and files a copy')}
      onPrint={say('Opens the PDF to print and files a copy')}
      onSend={say('Sends the papers and files the copies')}
      onClose={say('Closes the window')}
    />
  )
}

const lookup = buildSheetPartiesLookup(SPIKE_ROSTER)
const cedar = (rule: 'payroll' | 'owed') => buildJobOwedBlock(spikeOwedInputs(rule).filter((i) => i.jobId === 'job-cedar'), { rule })
const chips = (names: string[]) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: '0.35rem' }}>
    {names.map((n) => (
      <span key={n} style={{ padding: '0.35rem 0.8rem', borderRadius: 999, fontSize: '0.8125rem', fontWeight: 500, border: '1px solid #2563eb', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' }}>
        ✓ {n}
      </span>
    ))}
  </div>
)
/** The Crew step of the sheet form, with the names picked and the line it now says. */
function CrewStep({ names, rule, team = [], caption }: { names: string[]; rule: 'payroll' | 'owed'; team?: string[]; caption?: string }) {
  const line = crewStepLine(names, lookup, rule)
  return (
    <div style={{ background: 'var(--surface)', padding: '1.2rem', borderRadius: 8, border: '1px solid var(--border)', maxWidth: 400, margin: '0 0 1rem' }}>
      {caption ? <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>{caption}</div> : null}
      <h2 style={{ margin: '0 0 0.6rem', fontSize: '1.2rem' }}>New Sub Labor</h2>
      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{crewStepTitle()} *</div>
      {chips(names)}
      <SheetJobTeamOffer team={team} picked={names} onPick={say('Ticks that person onto the sheet')} />
      {line ? <SheetCrewWhoLineView line={line} onTakeOff={say('Takes that sub off this sheet')} onTakeOffAll={say('Takes the teammates off. The sheet stays the sub’s.')} /> : null}
      <div style={{ padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', color: 'var(--text-faint)' }}>Search for crew</div>
    </div>
  )
}

/** Who reads a sheet's amounts, drawn from `sheetAmountsView`: office all, field their own (Taunya, 2026-11-15). */
function WhoSees() {
  const party = (...ids: string[]) => sheetParties({ assigned_to_name: null }, ids.map((id) => ({ personId: id, personName: null })), lookup)
  const sheets = [
    { label: 'Top-out, Cedar Hollow Clinic', names: 'Harlan Mechanical, with Dana Whitlock named on it', amount: 1800, parties: party('harlan', 'dana') },
    { label: 'Bonus, Mill Street Bakery', names: 'Dana Whitlock, no sub', amount: 450, parties: party('dana') },
    { label: 'Coring, Pine Street Duplex', names: 'Ridgeline Coring LLC and Marlow Tile', amount: 2600, parties: party('ridgeline', 'marlow') },
  ]
  const viewers = [
    { label: 'Office', sub: 'assistant', v: { role: 'assistant', personId: null } },
    { label: 'Harlan Mechanical', sub: 'sub', v: { role: 'subcontractor', personId: 'harlan' } },
    { label: 'Dana Whitlock', sub: 'superintendent', v: { role: 'superintendent', personId: 'dana' } },
    { label: 'Marlow Tile', sub: 'sub', v: { role: 'subcontractor', personId: 'marlow' } },
    { label: 'Owen Farris', sub: 'helper', v: { role: 'helpers', personId: 'owen' } },
  ]
  const cell = { padding: '0.5rem 0.6rem', borderTop: '1px solid var(--border)', fontSize: '0.8125rem', verticalAlign: 'top' } as const
  return (
    <div style={{ maxWidth: 980, overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
        <thead>
          <tr>
            <th style={{ ...cell, borderTop: 'none', textAlign: 'left' }}>Sheet</th>
            {viewers.map((w) => (
              <th key={w.label} style={{ ...cell, borderTop: 'none', textAlign: 'left' }}>
                {w.label}
                <div style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{w.sub}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheets.map((s) => (
            <tr key={s.label}>
              <td style={cell}>
                <b>{s.label}</b>
                <div style={{ color: 'var(--text-muted)' }}>{s.names}</div>
              </td>
              {viewers.map((w) => {
                const view = sheetAmountsView(w.v, s.parties)
                return (
                  <td key={w.label} style={cell}>
                    {sheetAmountsShown(view) ? (
                      <b style={{ fontVariantNumeric: 'tabular-nums' }}>${s.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</b>
                    ) : view === 'named' ? (
                      <span style={{ color: 'var(--text-muted)' }}>Listed, no amounts</span>
                    ) : (
                      <span style={{ color: 'var(--text-faint)' }}>Not listed</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0.6rem 0 0' }}>{sheetNamedNotPaidWords('Harlan Mechanical')}</p>
    </div>
  )
}

/** The clean-up window on made-up sheets: five ready, one held for two subs. */
const rideParty = (...ids: string[]) => sheetParties({ assigned_to_name: null }, ids.map((id) => ({ personId: id, personName: null })), lookup)
const RIDE_ALONGS = rideAlongCleanUp([
  { id: 'r1', label: '2041 Cedar Hollow Clinic', day: '2026-08-25', parties: rideParty('harlan', 'dana', 'owen'), total: 500, open: 0 },
  { id: 'r2', label: '2041 Cedar Hollow Clinic', day: '2026-09-10', parties: rideParty('harlan', 'dana', 'owen'), total: 350, open: 0 },
  { id: 'r3', label: '2057 Ridgeway Builders, Lot 12', day: '2026-09-10', parties: rideParty('harlan', 'dana'), total: 300, open: 0 },
  { id: 'r4', label: '2063 Pine Street Duplex', day: '2026-09-10', parties: rideParty('harlan', 'dana'), total: 700, open: 0 },
  { id: 'r5', label: '2049 Mill Street Bakery', day: '2026-09-17', parties: rideParty('marlow', 'dana', 'owen'), total: 2150, open: 2150 },
  { id: 'r6', label: '2033 Alder Court Remodel', day: '2026-09-12', parties: rideParty('ridgeline', 'marlow', 'dana'), total: 1200, open: 1200 },
])
const RIDE_ALONG_DONE = { done: 4, failed: [{ row: RIDE_ALONGS.ready[4]!, reason: 'Nothing was changed: new row violates row-level security policy for table "people_labor_jobs"' }] }

export type SpikeView = { key: string; title: string; render: () => ReactNode; wide?: boolean; bare?: boolean }

export const SPIKE_VIEWS: SpikeView[] = [
  { key: '346-row', title: '#346 · People → Subs, the row that opens (the old rule, before your pick)', render: () => <RosterView rule="payroll" /> },
  { key: '346-row-owed', title: '#346 · the same page, a teammate’s sheet owed to them', render: () => <RosterView rule="owed" openId="dana" /> },
  { key: '346-switch', title: '#346 · the page with the rule switch', render: () => <RosterView openId={null} /> },
  { key: '346-phone', title: '#346 · on a phone, a card per sub', render: () => <RosterView rule="payroll" narrow openId={null} />, wide: false },
  { key: '346-job', title: '#346 · the job window, Subs on this job', render: () => <div style={{ maxWidth: 680 }}><JobSubsOwedView title="#2041 Cedar Hollow Clinic · subs on this job" block={cedar('payroll')} onOpenSheet={say('Open the sheet')} onOpenPerson={say('Their row on People → Subs')} onShowSheets={say('The pay run searched to this job')} /></div> },
  { key: '346-job-owed', title: '#346 · the job window, a teammate’s sheet owed to them', render: () => <div style={{ maxWidth: 680 }}><JobSubsOwedView title="#2041 Cedar Hollow Clinic · subs on this job" block={cedar('owed')} onOpenSheet={say('Open the sheet')} onOpenPerson={say('Their row on People → Subs')} onShowSheets={say('The pay run searched to this job')} /></div> },
  {
    key: '346-whose',
    title: '#346 · Whose is it…, the band’s window',
    render: () => (
      <WhoseSheetWindow
        group={{ key: 'g', label: 'Pine Street Duplex', jobNumber: '2063', rawAssignedTo: 'Ridgeline Coring LLC | Marlow Tile', reason: 'shared', archivedPersonName: null, sheetIds: ['s-pine-1'], sheetCount: 1, totalBalance: 800 }}
        roster={SPIKE_ROSTER.filter((p) => p.accountRole !== 'superintendent' && p.kind === 'sub').map((p) => ({ id: p.id, name: p.name, benched: false }))}
        suggestion={{ id: 'marlow', name: 'Marlow Tile' }}
        saving={false}
        onAssign={say('Saves through the page’s own assign')}
        onClose={say('Closes the window')}
      />
    ),
  },
  {
    key: '346-ride-along',
    title: '#346 · the sheet form: a job’s team is offered, and the step is one pick called Paid to',
    render: () => (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        <CrewStep caption="An old sheet, opened to edit" names={['Harlan Mechanical', 'Dana Whitlock', 'Owen Farris']} rule="owed" />
        <CrewStep caption="New sheet · job #2041 picked" names={[]} team={['Harlan Mechanical', 'Dana Whitlock', 'Owen Farris']} rule="owed" />
        <CrewStep caption="New sheet · one name picked" names={['Harlan Mechanical']} team={['Harlan Mechanical', 'Dana Whitlock', 'Owen Farris']} rule="owed" />
      </div>
    ),
  },
  { key: '346-ride-along-cleanup', title: '#346 · take the teammates off the subs’ sheets', render: () => <RideAlongCleanUpWindowView cleanUp={RIDE_ALONGS} busy={false} outcome={null} onRun={say('Takes the teammates off the ticked sheets')} onOpenSheet={say('Opens that sheet on Jobs → Subs → Pay')} onClose={say('Closes the window')} /> },
  { key: '346-ride-along-cleanup-after', title: '#346 · the same window after a run that one sheet refused', render: () => <RideAlongCleanUpWindowView cleanUp={RIDE_ALONGS} busy={false} outcome={RIDE_ALONG_DONE} onRun={say('Takes the teammates off the ticked sheets')} onOpenSheet={say('Opens that sheet on Jobs → Subs → Pay')} onClose={say('Closes the window')} /> },
  { key: '346-who-sees', title: '#346 PR 6 · who sees a sheet’s amounts: office all, field their own', render: () => <WhoSees /> },
  {
    key: '346-crew-step',
    title: '#346 · the sheet form’s Crew step, four cases',
    render: () => (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        <CrewStep names={['Ridgeline Coring LLC', 'Marlow Tile', 'Owen Farris']} rule="payroll" />
        <CrewStep names={['Harlan Mechanical', 'Dana Whitlock']} rule="payroll" />
        <CrewStep names={['Dana Whitlock']} rule="payroll" />
        <CrewStep names={['Dana Whitlock']} rule="owed" />
        <div style={{ maxWidth: 400 }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Work and cost, on a job that already has this line</div>
          <SheetSameLineWarning draft={[{ label: 'Top-out', amount: 1800 }]} others={SPIKE_SHEETS.filter((x) => x.job.id === 'job-cedar').map((x) => x.sheet)} />
        </div>
      </div>
    ),
  },
  { key: '350-statement', title: '#350 · Statement of account…, the window and the paper', render: () => <Papers open={{ kind: 'statement' }} /> },
  { key: '350-work', title: '#350 · Work statement…, one sheet', render: () => <Papers open={{ kind: 'work', sheetId: 's-cedar-1' }} /> },
  { key: '350-payment', title: '#350 · Payment record…, one sending over two sheets', render: () => <Papers open={{ kind: 'payment', sendingKey: 'snd-231' }} /> },
  { key: '350-send', title: '#350 · Send, by email with the files', render: () => <Papers open={{ kind: 'statement' }} send /> },
  { key: '350-send-no-email', title: '#350 · Send, a sub with no email on the roster', render: () => <Papers open={{ kind: 'statement' }} send email={null} /> },
  { key: '346-phone-sheet', title: '#346 · on a phone, the sheet a card opens', render: () => <RosterView rule="payroll" narrow openId="harlan" />, wide: false },
]
