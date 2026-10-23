---
name: "Account nicknames: the modal says what each Mercury account is"
number: 155
group: close
status: built 2026-10-23 · left: the owner's look at the live modal, then delete the folder
summary: >
  A dev names a Mercury account in Banking → Nicknames → Account nicknames, and a row there was an
  eight-letter id and a box, so the owner named accounts by opening Mercury, reading each account's
  transactions and matching them by eye against the ledger. The app holds both halves of that match:
  the ledger's rows by account, and Mercury's own account list, which the Balance Sheet already reads.
  Built as drawn: each account is a card with the name Mercury gives it and Use this name, the full id
  with Copy, the ledger's facts for it and its newest lines, Show in ledger, the unnamed first.
next: The owner opens the modal on the Ledger, names the two unnamed accounts from Mercury's names, then this folder goes.
size: S
blocker: The owner's look.
ver: v2.5806
opinion: build B as drawn; Mercury's own names carry the last four already, so no function change was needed
---

# Account nicknames: the modal says what each Mercury account is (#155)

## The ask, in the owner's words (2026-10-23)

> This modal is extremely hard to use because my method for naming accounts relies on seeing the
> transactions and going into Mercury and matching them. Would you be able to help me improve this
> modal where this becomes more possible. Please come up with a mock-up and then ask yourself is
> this the best we can do, and then build the result and present it to me with screenshots.

His screenshot is `/banking?tab=ledger&product=mercury` with the modal open: ten rows, each an
id cut to eight letters, a Nickname box, Save and Clear. Two rows have no nickname. Nothing on a
row says which account it is.

## What the app already knew

- `mercury_transactions.raw` is Mercury's transaction object as the sync stores it
  (`supabase/functions/_shared/mercuryTransaction.ts`). It carries `accountId` and nothing else
  about the account: no name, no kind, no account number.
- The sync (`sync-mercury-transactions`) reads `/transactions` only. It never reads Mercury's
  `/accounts`.
- `get-mercury-account-balances` does read `/accounts`, for the Balance Sheet's cash line and the
  Bridge. It returns each account's id, name, kind and balances, and filters out archived
  accounts. The ids are the same ids the transactions carry. It does not pass the account number
  on, and it does not need to: Mercury's names carry the last four already, as *Mercury Checking
  ••8103*.

So the match the owner made by eye is a lookup the app can make by id.

## The mock-up

`mockup.html` beside this file: today's modal, option A (the ledger's facts on every row) and
option B (the card with Mercury's own name first), B on a phone, and the critique.

## The decision

**B, as drawn.** Each account is a card:

- The nickname box, Save and Clear, as before. An unnamed card is amber with *No nickname yet*,
  and the unnamed come first, the busiest first.
- *Mercury calls it* **Ops Checking** · Checking · balance, read from Mercury's account list once
  when the modal opens, with **Use this name** to put that name in the box. An account Mercury no
  longer lists says so, since a closed or archived account keeps its old transactions here.
- The full id with **Copy**.
- What the ledger holds: how many transactions, the first and last date, money in and out, the
  three counterparties that recur most, and the four newest lines as date, counterparty, amount.
  An account with nothing says *No transactions yet in the ledger.*
- **Show in ledger** closes the modal with the Ledger's account filter set to the account.

Rejected: A alone, since he would still open Mercury for the name. Not built: naming every
unnamed account from Mercury's names at once, because his nicknames are not Mercury's names and one
press per account keeps the choice his and the write path as it was.

## Is this the best we can do, are we being straightforward

- Does he still open Mercury? Only for an account Mercury no longer lists. Mercury does not search
  by account id, so Copy is for the dashboard's address bar and for a note, not a search box.
- Why read Mercury from the modal and not store the names? A table of Mercury account names would
  be one more thing to sync. The Balance Sheet already reads the list live, and ten accounts is one
  small call.
- Where do the counts come from? The rows the page already loaded. The Ledger and User Sort load
  every row, so the counts are the whole ledger. Opened from the Accounting tab, which loads only
  the unlabeled rows, the card says so and each account's count is read from the table instead.
- The last four of the account number: Mercury's own names carry it, as *Mercury Checking ••8103*,
  so the card shows it with no change to the function. Seen live on 2026-10-23: the two unnamed
  accounts read *Mercury Checking ••5127* and *Mercury Checking ••8500*, and one named account is
  no longer on Mercury's list.

## Where it plugs in

- Kernel `src/lib/banking/accountFacts.ts` (tests beside it, a 400-row ledger): the facts per
  account from the loaded rows, the order for naming, Mercury's kinds in plain words, the index of
  Mercury's list by id.
- `src/components/BankingAccountNicknamesModal.tsx` redrawn (render smoke beside it: a named, an
  unnamed and an empty account, Copy, Use this name, Show in ledger, the partial-tab scope line).
- `src/pages/Banking.tsx` passes the rows, whether they are the whole ledger, the exact counts
  when they are not, and the Show in ledger door (`accountFilter` + the Ledger tab).
- Mercury's list through `loadMercuryCash` (`src/lib/bridge/mercuryCash.ts`), the Bridge's reader
  of `get-mercury-account-balances`.
- The write is unchanged: `mercury_account_nicknames` upsert on Save, delete on Clear or an empty
  box; dev only (RLS).

## How to verify

As the dev, `/banking?tab=ledger&product=mercury`, **Nicknames ▾ → Account nicknames** or the amber
line's **Name accounts…**. The unnamed cards sit first. Each card's *Mercury calls it* line fills
within a second. Press **Use this name** on an unnamed card and the box fills; nothing is saved
until Save. **Copy** reads *Copied* for a moment. **Show in ledger** closes the modal and the
Ledger's account filter reads that account. Light and dark, desktop and phone width.
