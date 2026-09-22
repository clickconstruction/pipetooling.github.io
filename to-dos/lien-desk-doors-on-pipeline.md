---
name: Lien desk doors on the Pipeline tab
number: 34
group: ready
status: asked 2026-09-22 — not now
summary: >
  **Lien desk doors on the Pipeline tab** (`/jobs?tab=stages`): the owner asked whether the Lien
  desk has an entry point there. It has one — the Pipeline tools ⋯ menu lists *Lien desk · N* at
  its top (beside the sort and filters). It is missing where the owner looked: the Section tools ⋯
  beside *Waiting*, and a card in *Today's Money Opportunities*.
next: >
  Two doors, one PR: a *Lien desk · N* item in the Section tools ⋯ menu beside the stage headers,
  and a Money Opportunities card — *⏱ N lien notices due · $X — the earliest by <date>* — that
  opens the desk on its Notices tab (zero state: no card). Both read the desk's own summary
  (`useLienDeskData` → `summary.office.next`), so the count and the date are the desk's.
size: S
blocker: none — the owner said not now.
ver: —
opinion: build when the owner says — small, and it puts the desk where the money cards already are.
---

# Lien desk doors on the Pipeline tab

Asked 2026-09-22, mid-session, with *I don't want to do this now*.

- **What exists:** Jobs → Pipeline → the ⋯ *Pipeline tools* menu opens with *Lien desk · N* as its first row (the count is the desk's notices due). The desk also opens from the Collections section's *⏱ Lien desk · N* button and from the Legal desk.
- **What the owner expected and did not find:** a door in the Section tools ⋯ beside *Waiting / Working / …*, and a card in *Today's Money Opportunities* — the strip that already carries *Bill the finished work*, *Chase the 90+ tail*, *Accounts Receivable* and the like. A lien notice due is the most time-boxed money item the office has and it is not on that strip.
- **Build:** the menu item is a line in the Section tools menu; the card is a `moneyOpportunities` entry fed by the desk summary — count of notices due, the dollars behind them, the earliest deadline, red inside a week — opening the desk on Notices. Zero notices: no card.
