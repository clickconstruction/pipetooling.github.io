import { useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react'
import {
  accountFactsFor,
  buildAccountFacts,
  formatMercuryAccountKind,
  indexMercuryAccounts,
  orderAccountsForNaming,
  type AccountFacts,
  type AccountFactsInputRow,
  type MercuryListedAccount,
} from '../lib/banking/accountFacts'
import { loadMercuryCash } from '../lib/bridge/mercuryCash'
import { supabase } from '../lib/supabase'

/**
 * Account nicknames (dev only). Redrawn for punch list #155: a dev used to name a
 * Mercury account by opening Mercury and matching its transactions against the
 * ledger by eye, because a row was an eight-letter id and a box. Each account is
 * now a card: the name Mercury gives it (the Balance Sheet's own read of Mercury's
 * account list) with **Use this name**, the full id with **Copy**, and what the
 * ledger holds for it, from the rows the page already loaded. The unnamed come
 * first. Save, Clear and the empty-box rule are as they were.
 */
export type BankingAccountNicknamesModalProps = {
  open: boolean
  onClose: () => void
  accountIds: string[]
  nicknameByAccount: Record<string, string>
  nicknameDrafts: Record<string, string>
  setNicknameDrafts: Dispatch<SetStateAction<Record<string, string>>>
  savingNicknameId: string | null
  onSave: (mercuryAccountId: string) => void
  onClear: (mercuryAccountId: string) => void
  /** The rows the page holds; the facts on each card come from them. */
  rows?: readonly AccountFactsInputRow[]
  /** True when `rows` is the whole ledger (the Ledger and User Sort load every row, up to the cap). */
  rowsComplete?: boolean
  /** Exact counts read from the table when `rows` is not the whole ledger; absent while they load. */
  exactCountByAccount?: Record<string, number> | null
  /** Closes the modal with the Ledger filtered to the account. */
  onShowInLedger?: (mercuryAccountId: string) => void
  /** Mercury's own account list; the Balance Sheet's read by default, a stub in the render smoke. */
  loadMercuryAccounts?: () => Promise<MercuryListedAccount[]>
}

type MercuryListState =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ready'; byId: Map<string, MercuryListedAccount> }
  | { state: 'error'; message: string }

const NO_ROWS: readonly AccountFactsInputRow[] = []

async function defaultLoadMercuryAccounts(): Promise<MercuryListedAccount[]> {
  const cash = await loadMercuryCash(supabase)
  return cash.accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind, currentBalance: a.currentBalance }))
}

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

/** "+$12,400.00" for money in, "−$612.40" for money out. */
function fmtSigned(n: number): string {
  if (n > 0) return `+${fmtUsd(n)}`
  if (n < 0) return `−${fmtUsd(-n)}`
  return fmtUsd(0)
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const smallButton: CSSProperties = {
  padding: '4px 10px',
  fontSize: '0.8125rem',
  borderRadius: 4,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-strong)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const tinyButton: CSSProperties = {
  ...smallButton,
  padding: '2px 8px',
  fontSize: '0.75rem',
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the selection
  }
  return false
}

export function BankingAccountNicknamesModal({
  open,
  onClose,
  accountIds,
  nicknameByAccount,
  nicknameDrafts,
  setNicknameDrafts,
  savingNicknameId,
  onSave,
  onClear,
  rows = NO_ROWS,
  rowsComplete = true,
  exactCountByAccount = null,
  onShowInLedger,
  loadMercuryAccounts = defaultLoadMercuryAccounts,
}: BankingAccountNicknamesModalProps) {
  const [mercury, setMercury] = useState<MercuryListState>({ state: 'idle' })
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  // Mercury's account list, read once per open; the Balance Sheet makes the same read.
  useEffect(() => {
    if (!open) {
      setMercury({ state: 'idle' })
      return
    }
    let cancelled = false
    setMercury({ state: 'loading' })
    void (async () => {
      try {
        const list = await loadMercuryAccounts()
        if (!cancelled) setMercury({ state: 'ready', byId: indexMercuryAccounts(list) })
      } catch (e) {
        if (!cancelled) setMercury({ state: 'error', message: e instanceof Error ? e.message : 'Could not read Mercury' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, loadMercuryAccounts])

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
    },
    [],
  )

  const facts = useMemo(() => buildAccountFacts(open ? rows : NO_ROWS), [open, rows])
  const ordered = useMemo(
    () => (open ? orderAccountsForNaming(accountIds, nicknameByAccount, facts) : []),
    [open, accountIds, nicknameByAccount, facts],
  )

  if (!open) return null

  const unnamedCount = ordered.filter((id) => !(nicknameByAccount[id] ?? '').trim()).length
  const loadedCount = rows.length

  const copy = async (id: string) => {
    const ok = await copyText(id)
    if (!ok) {
      // No clipboard here: select the id so a keyboard copy takes it.
      const el = document.querySelector<HTMLElement>(`[data-account-id-text="${id}"]`)
      const sel = window.getSelection()
      if (el && sel) {
        const range = document.createRange()
        range.selectNodeContents(el)
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }
    setCopiedId(id)
    if (copiedTimer.current) clearTimeout(copiedTimer.current)
    copiedTimer.current = setTimeout(() => setCopiedId(null), 1500)
  }

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="banking-account-nicknames-modal-title"
        aria-describedby="banking-account-nicknames-modal-desc"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          color: 'var(--text-strong)',
          borderRadius: 8,
          width: 'min(760px, calc(100vw - 2rem))',
          maxHeight: 'min(90vh, 100%)',
          display: 'flex',
          flexDirection: 'column',
          padding: '1rem 1.25rem',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            marginBottom: '0.5rem',
            flexShrink: 0,
          }}
        >
          <h2 id="banking-account-nicknames-modal-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
            Account nicknames
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.45rem 0.85rem',
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              color: 'var(--text-strong)',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Close
          </button>
        </div>
        <p id="banking-account-nicknames-modal-desc" style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 0.25rem', flexShrink: 0 }}>
          One nickname per Mercury account, shared by every dev. Each card says what Mercury calls the account and what the ledger
          holds for it. Save with an empty box, or press Clear, to remove a nickname.
        </p>
        <p data-testid="account-nicknames-scope" style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: '0 0 0.75rem', flexShrink: 0 }}>
          {ordered.length === 0
            ? null
            : rowsComplete
              ? `The facts come from the ledger's ${loadedCount.toLocaleString()} loaded transactions.${unnamedCount > 0 ? ` ${unnamedCount === 1 ? '1 account has' : `${unnamedCount} accounts have`} no nickname yet and ${unnamedCount === 1 ? 'sits' : 'sit'} first.` : ''}`
              : `This tab loaded ${loadedCount.toLocaleString()} rows, not the whole ledger. Each card counts the whole table and lists only what this tab holds. Open from the Ledger tab for the full facts.`}
        </p>
        <div style={{ overflow: 'auto', flex: '1 1 auto', minHeight: 0 }}>
          {ordered.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              No account IDs yet — use Refresh from Mercury or Reload table.
            </p>
          ) : (
            ordered.map((id) => (
              <AccountCard
                key={id}
                id={id}
                nickname={nicknameByAccount[id] ?? ''}
                draft={nicknameDrafts[id]}
                setDraft={(value) => setNicknameDrafts((d) => ({ ...d, [id]: value }))}
                saving={savingNicknameId === id}
                onSave={() => onSave(id)}
                onClear={() => onClear(id)}
                facts={accountFactsFor(facts, id)}
                exactCount={exactCountByAccount?.[id] ?? null}
                rowsComplete={rowsComplete}
                mercury={mercury}
                copied={copiedId === id}
                onCopy={() => void copy(id)}
                onShowInLedger={onShowInLedger ? () => onShowInLedger(id) : undefined}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

type AccountCardProps = {
  id: string
  nickname: string
  draft: string | undefined
  setDraft: (value: string) => void
  saving: boolean
  onSave: () => void
  onClear: () => void
  facts: AccountFacts
  exactCount: number | null
  rowsComplete: boolean
  mercury: MercuryListState
  copied: boolean
  onCopy: () => void
  onShowInLedger?: () => void
}

function AccountCard({
  id,
  nickname,
  draft,
  setDraft,
  saving,
  onSave,
  onClear,
  facts,
  exactCount,
  rowsComplete,
  mercury,
  copied,
  onCopy,
  onShowInLedger,
}: AccountCardProps) {
  const unnamed = nickname.trim() === ''
  const listed = mercury.state === 'ready' ? mercury.byId.get(id) ?? null : null
  const kind = formatMercuryAccountKind(listed?.kind)
  const count = exactCount ?? facts.count
  const hasRows = facts.count > 0 || (exactCount ?? 0) > 0
  const labelStyle: CSSProperties = { color: 'var(--text-muted)', minWidth: '7.5rem', flexShrink: 0 }

  return (
    <div
      data-testid={`account-nickname-card-${id}`}
      data-unnamed={unnamed ? 'true' : undefined}
      style={{
        border: `1px solid ${unnamed ? 'var(--border-amber-soft)' : 'var(--border)'}`,
        background: unnamed ? 'var(--bg-amber-tint)' : 'var(--surface)',
        borderRadius: 8,
        padding: '0.6rem 0.75rem',
        marginBottom: '0.6rem',
        display: 'grid',
        gap: '0.35rem',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
        {unnamed ? (
          <span
            style={{
              padding: '1px 9px',
              borderRadius: 999,
              background: 'var(--bg-amber-100)',
              color: 'var(--text-amber-800)',
              fontSize: '0.75rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            No nickname yet
          </span>
        ) : null}
        <input
          value={draft ?? nickname}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !saving) {
              e.preventDefault()
              onSave()
            }
          }}
          placeholder="Nickname"
          aria-label={`Nickname for account ${id}`}
          maxLength={120}
          style={{ flex: '1 1 12rem', minWidth: 140, padding: '4px 8px', fontSize: '0.875rem' }}
        />
        <button type="button" disabled={saving} onClick={onSave} style={{ ...smallButton, cursor: saving ? 'wait' : 'pointer' }}>
          Save
        </button>
        <button
          type="button"
          disabled={saving || unnamed}
          onClick={onClear}
          style={{ ...smallButton, cursor: saving ? 'wait' : 'pointer', opacity: unnamed ? 0.6 : 1 }}
        >
          Clear
        </button>
      </div>

      <div data-testid="account-nickname-mercury-line" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem 0.6rem', fontSize: '0.8125rem' }}>
        <span style={labelStyle}>Mercury calls it</span>
        {mercury.state === 'loading' || mercury.state === 'idle' ? (
          <span style={{ color: 'var(--text-muted)' }}>Reading Mercury's account list…</span>
        ) : mercury.state === 'error' ? (
          <span style={{ color: 'var(--text-red-700)' }}>Could not read Mercury's account list: {mercury.message}</span>
        ) : listed ? (
          <>
            <b style={{ fontWeight: 600 }}>{listed.name}</b>
            <span style={{ color: 'var(--text-muted)' }}>
              {kind ? `${kind} · ` : ''}balance {fmtUsd(listed.currentBalance)}
            </span>
            <button
              type="button"
              data-testid="account-nickname-use-name"
              disabled={saving}
              onClick={() => setDraft(listed.name)}
              style={tinyButton}
              title="Puts Mercury's name in the box. Press Save to keep it."
            >
              Use this name
            </button>
          </>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>
            Not on Mercury's account list. A closed or archived account keeps its old transactions here.
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem 0.6rem', fontSize: '0.75rem' }}>
        <span style={labelStyle}>Id</span>
        <code data-account-id-text={id} style={{ fontSize: '0.75rem', wordBreak: 'break-all', color: 'var(--text-muted)' }}>
          {id}
        </code>
        <button type="button" data-testid="account-nickname-copy" onClick={onCopy} style={tinyButton} aria-live="polite">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {hasRows ? (
        <>
          <div data-testid="account-nickname-facts" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem 0.9rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            <span>
              <b style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{count.toLocaleString()}</b>{' '}
              {count === 1 ? 'transaction' : 'transactions'}
              {!rowsComplete && exactCount == null ? ' on this tab' : ''}
            </span>
            {facts.count > 0 ? (
              <>
                <span>
                  {fmtDate(facts.firstIso)} to {fmtDate(facts.lastIso)}
                </span>
                <span>
                  in <b style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{fmtUsd(facts.inUsd)}</b>
                </span>
                <span>
                  out <b style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{fmtUsd(facts.outUsd)}</b>
                </span>
                {facts.frequent.length > 0 ? (
                  <span>often {facts.frequent.map((c) => `${c.name} ×${c.count}`).join(', ')}</span>
                ) : null}
              </>
            ) : null}
          </div>
          {facts.recent.length > 0 ? (
            <ul data-testid="account-nickname-recent" style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 2, fontSize: '0.75rem' }}>
              {facts.recent.map((l) => (
                <li key={l.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(5.5rem, 6.5rem) 1fr auto', gap: '0.6rem', alignItems: 'baseline' }}>
                  <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmtDate(l.whenIso)}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.counterparty}</span>
                  <span
                    style={{
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                      color: l.amount > 0 ? 'var(--text-green-700)' : 'var(--text-strong)',
                    }}
                  >
                    {fmtSigned(l.amount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p data-testid="account-nickname-facts" style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          No transactions yet in the ledger.
        </p>
      )}

      {onShowInLedger ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            data-testid="account-nickname-show-in-ledger"
            disabled={!hasRows}
            onClick={onShowInLedger}
            style={{
              ...tinyButton,
              border: '1px solid var(--border-blue)',
              color: 'var(--text-link)',
              fontWeight: 600,
              opacity: hasRows ? 1 : 0.5,
              cursor: hasRows ? 'pointer' : 'default',
            }}
            title="Closes this window with the Ledger filtered to this account."
          >
            Show in ledger
          </button>
        </div>
      ) : null}
    </div>
  )
}
