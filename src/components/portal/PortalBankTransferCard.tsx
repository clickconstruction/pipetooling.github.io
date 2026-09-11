/**
 * "Prefer to pay by bank transfer?" — the company's ACH / wire details and
 * the check mailing address on the customer portal statement (v2.3308).
 * Collapsed by default on screen (the card stays the way to pay); open, it
 * reads like the remittance page of a bank's own wire sheet: label · value ·
 * Copy, the memo the customer should write, where checks must go, and the
 * one line that defends against invoice-redirect fraud. Print shows it open
 * — paper is where wire details get used. Customer-facing ⇒ single-theme
 * light with the statement's own palette.
 */
import { useState } from 'react'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, NOTE_BAND, PAPER } from '../../lib/portal/portalTheme'
import {
  bankTransferDetailsComplete,
  bankTransferGuardLine,
  checkMailingSentence,
  groupDigits,
  type BankTransferDetails,
} from '../../lib/bankTransferDetails'

export type PortalBankTransferCardProps = {
  details: BankTransferDetails
  /** "Sam Sample · PLUM 1001, 0994" — from buildBankTransferMemo. */
  memo: string
  /** The office phone for the guard line. */
  phone: string
}

function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      data-screen-only
      aria-label={`Copy ${value}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setDone(true)
          setTimeout(() => setDone(false), 1200)
        } catch {
          /* clipboard blocked — the value is on the page */
        }
      }}
      style={{
        border: `1px solid ${HAIR}`,
        background: PAPER,
        color: MUTED,
        fontSize: 11,
        fontWeight: 600,
        padding: '3px 9px',
        borderRadius: 999,
        cursor: 'pointer',
        fontFamily: 'inherit',
        justifySelf: 'end',
        whiteSpace: 'nowrap',
      }}
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  )
}

const keyStyle = { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: FAINT, whiteSpace: 'nowrap' as const, padding: '7px 0', borderBottom: `1px solid ${HAIR}` }
const valStyle = { fontVariantNumeric: 'tabular-nums' as const, fontWeight: 600, letterSpacing: '0.02em', minWidth: 0, padding: '7px 0', borderBottom: `1px solid ${HAIR}`, overflowWrap: 'anywhere' as const }
const cellStyle = { padding: '7px 0', borderBottom: `1px solid ${HAIR}` }

function Row({ k, v, sub, copy, plain }: { k: string; v: string; sub?: string; copy?: string; plain?: boolean }) {
  return (
    <>
      <span style={keyStyle}>{k}</span>
      <span style={{ ...valStyle, fontWeight: plain ? 400 : 600 }}>
        {v}
        {sub ? <small style={{ display: 'block', fontWeight: 400, color: FAINT, fontSize: 11, letterSpacing: 0 }}>{sub}</small> : null}
      </span>
      <span style={{ ...cellStyle, display: 'flex', justifyContent: 'flex-end' }}>{copy ? <CopyButton value={copy} /> : null}</span>
    </>
  )
}

function Body({ details, memo, phone }: PortalBankTransferCardProps) {
  const c = bankTransferDetailsComplete(details)
  const checks = checkMailingSentence(details.checkMailingAddress)
  return (
    <div style={{ padding: '10px 16px 12px', fontSize: 13, borderTop: `1px solid ${HAIR}` }}>
      {c.transfer ? (
        <>
          <div style={{ fontSize: 12, color: MUTED }}>ACH and domestic wire use the same details. Online card payments stay above.</div>
          <div data-portal-bank-grid style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '0 14px', alignItems: 'center', marginTop: 8 }}>
            <Row k="Pay to" v={details.payeeName} copy={details.payeeName} />
            <Row k="Routing" v={groupDigits(details.routingNumber)} copy={details.routingNumber} />
            <Row k="Account" v={groupDigits(details.accountNumber)} sub={details.accountKind} copy={details.accountNumber} />
            {details.bankName ? <Row k="Bank" v={details.bankName} sub={details.bankNote || undefined} /> : null}
            {details.beneficiaryAddress ? <Row k="Address" v={details.beneficiaryAddress} plain /> : null}
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: COPPER }}>Memo</span>
            <code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, background: NOTE_BAND, padding: '2px 7px', border: `1px solid ${HAIR}` }}>{memo}</code>
            <span style={{ color: MUTED, fontSize: 12 }}>so we can match your payment the day it lands.</span>
          </div>
        </>
      ) : null}
      {checks ? (
        <div style={{ marginTop: c.transfer ? 10 : 0, paddingTop: c.transfer ? 9 : 0, borderTop: c.transfer ? `1px dashed ${HAIR}` : 'none', fontSize: 12.5, color: INK }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: COPPER, marginRight: 8 }}>Checks</span>
          {checks}
        </div>
      ) : null}
      <div style={{ marginTop: 10, paddingTop: 9, borderTop: `1px dashed ${HAIR}`, fontSize: 12, color: MUTED, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: COPPER, flex: 'none', marginTop: 5 }} />
        <span>
          <b style={{ color: INK }}>These details never change by email.</b> {bankTransferGuardLine(phone).replace('These details never change by email. ', '')}
        </span>
      </div>
    </div>
  )
}

export function PortalBankTransferCard(props: PortalBankTransferCardProps) {
  const [open, setOpen] = useState(false)
  const c = bankTransferDetailsComplete(props.details)
  const title = c.transfer ? 'Prefer to pay by bank transfer?' : 'Paying by check?'
  return (
    <div data-testid="portal-bank-transfer" style={{ margin: '1.4rem 0 0', background: CARD, border: `1px solid ${HAIR}` }}>
      <button
        type="button"
        data-screen-only
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          width: '100%',
          border: 'none',
          background: 'none',
          padding: '12px 16px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          color: INK,
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: COPPER }}>{title}</span>
        <span style={{ fontSize: 12, color: MUTED, whiteSpace: 'nowrap' }}>
          {open ? 'Hide' : c.transfer ? 'ACH · wire · check' : 'Where to mail it'} <span aria-hidden style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>
        </span>
      </button>
      {open ? (
        <div data-screen-only>
          <Body {...props} />
        </div>
      ) : null}
      {/* Paper is where wire details get used: the printed statement carries the block open. */}
      <div data-print-only>
        <div style={{ padding: '12px 16px 0', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: COPPER }}>{title}</div>
        <Body {...props} />
      </div>
    </div>
  )
}
