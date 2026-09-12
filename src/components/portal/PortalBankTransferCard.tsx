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
  groupDigits,
  mailingAddressLines,
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

const keyStyle = { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: FAINT, whiteSpace: 'nowrap' as const }
const valStyle = { fontVariantNumeric: 'tabular-nums' as const, fontWeight: 600, letterSpacing: '0.02em', minWidth: 0, overflowWrap: 'anywhere' as const }

/**
 * One line of the remittance grid. The row owns its rule (one border across
 * the whole width), so a value that wraps or carries a tail never leaves the
 * label's underline sitting higher than the value's — the cells inside carry
 * no borders of their own.
 */
function Row({ k, v, tail, copy, plain }: { k: string; v: string; tail?: string; copy?: string; plain?: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '84px minmax(0, 1fr) auto', gap: '0 14px', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${HAIR}` }}>
      <span style={keyStyle}>{k}</span>
      <span style={{ ...valStyle, fontWeight: plain ? 400 : 600 }}>
        {v}
        {tail ? <span style={{ fontWeight: 400, color: MUTED, letterSpacing: 0 }}> · {tail}</span> : null}
      </span>
      <span style={{ display: 'flex', justifyContent: 'flex-end' }}>{copy ? <CopyButton value={copy} /> : null}</span>
    </div>
  )
}

const eyebrowStyle = { fontSize: 10.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: COPPER }
const smallKeyStyle = { fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: FAINT }

/**
 * Two halves, each with its own eyebrow, so an impatient reader never
 * mails a check to the bank's beneficiary address: the transfer details
 * on the left (the address row says it is for the wire form), and a boxed
 * envelope on the right with the one address checks go to. Stacks on
 * phones ([data-portal-bank-split] in the statement's style block).
 */
function Body({ details, memo, phone }: PortalBankTransferCardProps) {
  const c = bankTransferDetailsComplete(details)
  const mailLines = mailingAddressLines(details.checkMailingAddress)
  return (
    <div style={{ padding: '12px 16px 12px', fontSize: 13, borderTop: `1px solid ${HAIR}` }}>
      <div data-portal-bank-split data-both={c.transfer && c.checks ? '' : undefined}>
        {c.transfer ? (
          <div style={{ minWidth: 0 }}>
            <div style={eyebrowStyle}>By bank transfer — ACH (direct deposit) or wire</div>
            <div data-portal-bank-grid style={{ marginTop: 8, borderTop: `1px solid ${HAIR}` }}>
              {/* Payee then their address — the way a wire form asks for them — then the numbers, then the bank. */}
              <Row k="Pay to" v={details.payeeName} copy={details.payeeName} />
              {details.beneficiaryAddress ? <Row k="Address" v={details.beneficiaryAddress} tail="for bank ACH and wires, not for mail" plain /> : null}
              <Row k="Routing" v={groupDigits(details.routingNumber)} copy={details.routingNumber} />
              <Row k="Account" v={groupDigits(details.accountNumber)} tail={details.accountKind} copy={details.accountNumber} />
              {details.bankName ? <Row k="Bank" v={details.bankName} /> : null}
            </div>
            {/* The bank note is a sentence, not a value: it sits under the grid in the
                same muted voice as the line above it, instead of stacking inside a row. */}
            {details.bankName && details.bankNote ? <div style={{ marginTop: 8, fontSize: 12, color: MUTED }}>{details.bankNote}</div> : null}
            <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: COPPER }}>Memo</span>
              <code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, background: NOTE_BAND, padding: '2px 7px', border: `1px solid ${HAIR}` }}>{memo}</code>
              <span style={{ color: MUTED, fontSize: 12 }}>so we can match your payment the day it lands.</span>
            </div>
          </div>
        ) : null}
        {c.checks ? (
          <div data-portal-bank-check style={{ background: NOTE_BAND, border: `1px solid ${HAIR}`, padding: '12px 14px 13px', alignSelf: 'start', minWidth: 0 }}>
            <div style={eyebrowStyle}>By check — mail it here</div>
            {details.payeeName ? (
              <>
                <div style={{ ...smallKeyStyle, marginTop: 10 }}>Payable to</div>
                <div style={{ fontWeight: 700 }}>{details.payeeName}</div>
              </>
            ) : null}
            <div style={{ ...smallKeyStyle, marginTop: 10 }}>Mail to</div>
            <div style={{ fontWeight: 700, fontSize: 14.5, lineHeight: 1.35 }}>
              {mailLines.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: MUTED, lineHeight: 1.45 }}>
              Checks can only be received at this address. Checks mailed anywhere else need to be re-issued.
            </div>
          </div>
        ) : null}
      </div>
      <div style={{ marginTop: 12, paddingTop: 9, borderTop: `1px dashed ${HAIR}`, fontSize: 12, color: MUTED, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: COPPER, flex: 'none', marginTop: 5 }} />
        <span>
          {bankTransferGuardLine(phone)}
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
          {open ? 'Hide' : c.transfer ? 'ACH (direct deposit) • wire • check' : 'Where to mail it'} <span aria-hidden style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>
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
