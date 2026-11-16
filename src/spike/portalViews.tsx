/** SPIKE ONLY: the sub's Statements tab over made-up papers (punch list #350, PR 6 and PR 7). Deleted at wrap-up. */
import type { PaperContext } from '../../supabase/functions/_shared/subPapers'
import { SubPortalStatementsTab } from '../components/subPortal/SubPortalStatementsTab'
import { paperSheetsFor } from '../lib/subWorkOrders/subPapersInputs'
import { SPIKE_ASSIGNEES, SPIKE_JOB_NAMES, SPIKE_REGISTER, SPIKE_ROSTER, SPIKE_SHEETS, SPIKE_TODAY } from './fixtures'
import { say } from './say'
import type { SpikeView } from './views'

const CTX: PaperContext = { company: { name: 'Your Company Name', lines: ['100 Example Way, Suite 4', '(555) 010-0100'] }, sub: { name: 'Harlan Mechanical', lines: ['22 Foundry Row'] }, today: SPIKE_TODAY, preparedAt: 'Nov 13, 2026 at 2:40 pm', zone: 'Central time' }
const sheets = () => paperSheetsFor('id:harlan', SPIKE_SHEETS.map((x) => x.sheet), SPIKE_ASSIGNEES, SPIKE_JOB_NAMES, SPIKE_ROSTER, { register: SPIKE_REGISTER })

function Portal({ narrow = false, confirmLive = false }: { narrow?: boolean; confirmLive?: boolean }) {
  return (
    <div style={{ maxWidth: narrow ? 375 : 620 }}>
      <b style={{ fontSize: '1rem' }}>Harlan Mechanical</b>
      <div style={{ display: 'flex', gap: 14, margin: '0.5rem 0 0.8rem', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}>
        {['Pay', 'Work', 'Statements', 'Papers to sign'].slice(0, narrow ? 3 : 4).map((t) => (
          <span key={t} style={{ padding: '0.3rem 0', fontWeight: t === 'Statements' ? 700 : 400, borderBottom: t === 'Statements' ? '2px solid #2563eb' : '2px solid transparent', color: t === 'Statements' ? 'var(--text-strong)' : 'var(--text-muted)' }}>
            {t}
          </span>
        ))}
      </div>
      <SubPortalStatementsTab
        sheets={sheets()}
        ctx={CTX}
        received={new Map([['snd-226', 'Nov 1, 2026']])}
        narrow={narrow}
        confirmLive={confirmLive}
        onPdf={say('Saves that paper as a PDF')}
        onGotIt={say('Marks the payment received')}
        onConfirm={say('Records the confirm with the revision they saw')}
        onSomethingWrong={say('Opens a note to the office')}
      />
    </div>
  )
}

export const PORTAL_VIEWS: SpikeView[] = [
  { key: '350-portal', title: '#350 · the sub’s Statements tab, Confirm switched off (as it would ship)', render: () => <Portal /> },
  { key: '350-portal-confirm', title: '#350 · the same tab with Confirm switched on (PR 7, held)', render: () => <Portal confirmLive /> },
  { key: '350-portal-phone', title: '#350 · the Statements tab on a phone', render: () => <Portal narrow />, wide: false },
]
