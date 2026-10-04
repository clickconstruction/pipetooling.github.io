import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { GcPayAppNotary } from './GcPayAppNotary'
import {
  GC_COMPANY_NAME,
  money,
  ownerPayAppForm,
  ownerPayAppParties,
  shortDate,
  type GcProject,
  type GcState,
} from '../../lib/gcMode/gcModel'
import { downloadPayAppExcel, downloadPayAppPdf } from '../../lib/gcMode/gcPayAppFile'

/**
 * GC mode design spike: our pay application to the owner as the form they, their architect and a
 * lender read: the AIA G702 (page 1) and G703 (page 2). The same paper as the Building lane's trade
 * pay application, pointed the other way: from us, to the owner, via the architect. A paper surface,
 * so it stays light in both themes. The real build fills the app's AIA template, as the Jobs Stages
 * tab does.
 */

const CSS = `
.gcOwnerPayApp-table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; font-size: 0.72rem; }
.gcOwnerPayApp-table th { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 0.58rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; color: var(--text-muted); border: 1px solid var(--border-strong); padding: 0.25rem 0.2rem; vertical-align: bottom; text-align: center; }
.gcOwnerPayApp-table td { border: 1px solid var(--border-strong); padding: 0.25rem 0.3rem; text-align: right; white-space: nowrap; }
.gcOwnerPayApp-table td.gcOwnerPayApp-left { text-align: left; white-space: normal; }
.gcOwnerPayApp-table tr.gcOwnerPayApp-total td { font-weight: 700; border-top: 2px solid var(--text-base); }
`

const label: CSSProperties = {
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontSize: '0.62rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--text-muted)',
}

function Box({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: '0.05rem', minWidth: 0 }}>
      <span style={label}>{name}</span>
      <span>{children}</span>
    </div>
  )
}

function Blank() {
  return <span style={{ color: 'var(--text-muted)' }}>______________</span>
}

type Page = 'g702' | 'g703'

/** Our pay application `which` (a number, or the next one as a draft) in a window over the page. */
export function OwnerPayAppWindow({
  state,
  project,
  which,
  onClose,
}: {
  state: GcState
  project: GcProject
  which: number | 'draft'
  onClose: () => void
}) {
  const [page, setPage] = useState<Page>('g702')
  const [saving, setSaving] = useState<'xlsx' | 'pdf' | null>(null)
  const [saveError, setSaveError] = useState('')
  useEffect(() => {
    // Escape closes this window only. It can sit over another window (the owner's portal opened
    // from the company window), so it takes Escape first and stops it there.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])
  const form = ownerPayAppForm(state, project, which)
  if (!form) return null
  const { app } = form
  const s = app.summary
  const customer = state.customers.find((c) => c.id === project.customerId)
  const draft = form.sentOn === null
  const name = app.final ? 'Final pay application' : `Pay application ${app.number}`
  const waiver = app.final ? 'conditional waiver on final payment' : 'conditional waiver on progress payment'
  const parties = ownerPayAppParties(state, project, form)
  const download = (kind: 'xlsx' | 'pdf') => {
    setSaving(kind)
    setSaveError('')
    ;(kind === 'xlsx' ? downloadPayAppExcel(app, parties) : downloadPayAppPdf(app, parties))
      .catch((e: unknown) => setSaveError(e instanceof Error ? e.message : 'The file could not be made.'))
      .finally(() => setSaving(null))
  }
  const fileButton = (kind: 'xlsx' | 'pdf', words: string) => (
    <button
      type="button"
      onClick={() => download(kind)}
      disabled={saving !== null}
      title={kind === 'xlsx' ? 'The AIA template the Jobs Stages tab fills, with every line' : 'The 702 and 703 as a PDF, with the notary block'}
      style={{ border: 'none', background: 'transparent', color: 'var(--text-link)', cursor: saving ? 'wait' : 'pointer', padding: '0.2rem 0.3rem', fontSize: '0.8rem', fontWeight: 600 }}
    >
      {saving === kind ? 'Making it…' : words}
    </button>
  )

  const tab = (p: Page, words: string) => (
    <button
      type="button"
      onClick={() => setPage(p)}
      aria-pressed={page === p}
      style={{
        padding: '0.3rem 0.75rem',
        borderRadius: 999,
        border: `1px solid ${page === p ? '#2563eb' : 'var(--border-strong)'}`,
        background: page === p ? '#2563eb' : 'var(--surface)',
        color: page === p ? '#ffffff' : 'var(--text-base)',
        fontSize: '0.78rem',
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {words}
    </button>
  )
  const line = (n: string, words: string, value: string, strong = false) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1.6rem minmax(0, 1fr) auto', gap: '0.4rem', alignItems: 'baseline', padding: '0.18rem 0', borderBottom: '1px dotted var(--border-strong)' }}>
      <span style={{ fontWeight: 700 }}>{n}</span>
      <span style={{ fontWeight: strong ? 700 : undefined }}>{words}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right', fontWeight: strong ? 700 : undefined }}>{value}</span>
    </div>
  )

  return (
    <div
      role="dialog"
      aria-label={`${name}, the form`}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', display: 'grid', placeItems: 'center', padding: '1rem', zIndex: 1300 }}
    >
      <style>{CSS}</style>
      <div
        data-theme="light"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-page)',
          color: 'var(--text-base)',
          borderRadius: 10,
          width: 'min(820px, 100%)',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '0.9rem 1rem 1.1rem',
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
          <strong style={{ fontSize: '1.05rem' }}>{name}</strong>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {project.name} · {draft ? `a draft, for ${shortDate(form.periodTo)}` : `sent ${shortDate(form.sentOn)}`}
          </span>
          <span style={{ flex: 1 }} />
          {fileButton('xlsx', '⤓ Excel')}
          {fileButton('pdf', '⤓ PDF')}
          {tab('g702', 'Page 1 · 702')}
          {tab('g703', 'Page 2 · 703')}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}
          >
            ×
          </button>
        </div>
        {saveError && <div style={{ color: 'var(--text-red-700)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>{saveError}</div>}

        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '1.1rem 1.25rem',
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: '0.8rem',
            lineHeight: 1.55,
            boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
          }}
        >
          {page === 'g702' ? (
            <>
              <p style={{ textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.15em' }}>
                Application and certificate for payment
              </p>
              <p style={{ ...label, textAlign: 'center', margin: '0 0 0.9em' }}>
                AIA G702 · page 1 of 2{app.final ? ' · final, retainage release' : ''}
                {draft ? ' · draft' : ''}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))', gap: '0.6rem 1.25rem' }}>
                <div style={{ display: 'grid', gap: '0.45rem' }}>
                  <Box name="To the customer">
                    {project.owner}
                    {customer ? (
                      <>
                        <br />
                        {customer.address}
                      </>
                    ) : null}
                  </Box>
                  {project.propertyOwner && <Box name="Project owner">{project.propertyOwner}</Box>}
                  <Box name="From the contractor">{GC_COMPANY_NAME}</Box>
                  <Box name="Contract for">General construction, the whole job</Box>
                </div>
                <div style={{ display: 'grid', gap: '0.45rem' }}>
                  <Box name="Project">
                    {project.name}
                    <br />
                    {project.address}
                  </Box>
                  <Box name="Via architect">{project.architect}</Box>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                    <Box name="Application no.">{app.final ? `${app.number}, final` : String(app.number)}</Box>
                    <Box name="Period to">{shortDate(form.periodTo)}</Box>
                    <Box name="Contract date">{form.contractDate ? shortDate(form.contractDate) : <Blank />}</Box>
                  </div>
                </div>
              </div>

              <p style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', margin: '1.1em 0 0.3em', fontSize: '0.75rem' }}>
                Application for payment
              </p>
              {line('1', 'Original contract sum', money(s.originalSum))}
              {line('2', 'Net change by change orders', money(s.changeOrders))}
              {line('3', 'Contract sum to date', money(s.sumToDate))}
              {line('4', 'Total completed and stored to date, from the 703', money(s.completedToDate))}
              {line('5', app.final ? 'Retainage, released on this final application' : form.retainageWords ? `Retainage, ${form.retainageWords}` : `Retainage, ${s.retainagePct}% of completed work`, money(s.retainage))}
              {line('6', 'Total earned less retainage', money(s.earnedLessRetainage))}
              {line('7', 'Less previous certificates for payment', money(s.previousCertificates))}
              {line('8', 'Current payment due', money(s.currentDue), true)}
              {line('9', 'Balance to finish, including retainage', money(s.balanceToFinish))}
              <div style={{ ...label, marginTop: '0.4rem' }}>
                {form.changeOrders.length === 0
                  ? 'Change orders: none on this contract'
                  : `Change orders: ${form.changeOrders
                      .map((co) => `${co.number}, ${co.description.replace(/[.\s]+$/, '')}, ${co.price < 0 ? '−' : '+'}${money(Math.abs(co.price))}`)
                      .join(' · ')}`}
              </div>

              <div style={{ marginTop: '0.9rem' }}>
                <p style={{ margin: '0 0 0.6em' }}>
                  The undersigned certifies that the work covered by this application is done as shown. Everyone owed for earlier
                  payments has been paid. The current payment shown is now due. A {waiver} for {money(s.currentDue)} is signed with
                  it.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))', gap: '0.5rem', alignItems: 'end' }}>
                  <div style={{ borderBottom: '1px solid var(--text-base)', paddingBottom: '0.15rem', minHeight: '1.6em', fontStyle: 'italic', fontSize: draft ? undefined : '1rem' }}>
                    {draft ? '' : GC_COMPANY_NAME}
                  </div>
                  <Box name="Date">{draft ? <Blank /> : shortDate(form.sentOn)}</Box>
                </div>
                <div style={{ ...label, marginTop: '0.2rem' }}>
                  {draft ? 'Signed for the contractor when it goes' : `Signed for ${GC_COMPANY_NAME}`}
                </div>
                <GcPayAppNotary />
              </div>

              <div style={{ marginTop: '1rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border-strong)' }}>
                <p style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 0.3em', fontSize: '0.75rem' }}>
                  Certificate for payment · the architect fills this in
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))', gap: '0.5rem' }}>
                  <Box name="Amount certified">{form.certificate.amount === null ? <Blank /> : money(form.certificate.amount)}</Box>
                  <Box name="Architect">{project.architect}</Box>
                  <Box name="Date">{form.certificate.on ? shortDate(form.certificate.on) : <Blank />}</Box>
                </div>
                {form.certificate.amount !== null && form.certificate.amount < s.currentDue - 0.005 && (
                  <p style={{ margin: '0.5em 0 0' }}>
                    Certified for {money(s.currentDue - form.certificate.amount)} less than applied for
                    {form.certificate.note ? `: ${form.certificate.note.replace(/[.\s]+$/, '')}` : ''}.
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <p style={{ textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.15em' }}>
                Continuation sheet
              </p>
              <p style={{ ...label, textAlign: 'center', margin: '0 0 0.8em' }}>AIA G703 · page 2 of 2</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(8rem, 1fr))', gap: '0.45rem', marginBottom: '0.7rem' }}>
                <Box name="Application no.">{String(app.number)}</Box>
                <Box name="Period to">{shortDate(form.periodTo)}</Box>
                <Box name="Project">{project.name}</Box>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="gcOwnerPayApp-table">
                  <thead>
                    <tr>
                      <th>A<br />Item</th>
                      <th>B<br />Work</th>
                      <th>C<br />Scheduled value</th>
                      <th>D<br />Previous</th>
                      <th>E<br />This period</th>
                      <th>F<br />Stored</th>
                      <th>G<br />Done to date</th>
                      <th>%<br />G ÷ C</th>
                      <th>H<br />Balance</th>
                      <th>I<br />Retainage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {app.lines.map((l) => (
                      <tr key={l.sovId}>
                        <td>{l.item}</td>
                        <td className="gcOwnerPayApp-left">{l.label}</td>
                        <td>{money(l.scheduled)}</td>
                        <td>{money(l.fromPrevious)}</td>
                        <td style={{ fontWeight: Math.round(l.thisPeriod) > 0 ? 700 : undefined }}>{money(l.thisPeriod)}</td>
                        <td>{money(l.stored)}</td>
                        <td>{money(l.toDate)}</td>
                        <td>{`${l.pct}%`}</td>
                        <td>{money(l.balance)}</td>
                        <td>{money(l.retainage)}</td>
                      </tr>
                    ))}
                    <tr className="gcOwnerPayApp-total">
                      <td />
                      <td className="gcOwnerPayApp-left">Grand total</td>
                      <td>{money(app.totals.scheduled)}</td>
                      <td>{money(app.totals.fromPrevious)}</td>
                      <td>{money(app.totals.thisPeriod)}</td>
                      <td>{money(app.totals.stored)}</td>
                      <td>{money(app.totals.toDate)}</td>
                      <td>{`${app.totals.pct}%`}</td>
                      <td>{money(app.totals.balance)}</td>
                      <td>{money(app.totals.retainage)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ ...label, marginTop: '0.5rem' }}>
                Each trade&rsquo;s line carries its share of our costs and fee. A change order is a line of its own.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
