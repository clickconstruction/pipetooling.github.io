---
title: add a new paper to a step of a flow
category: Bids & Estimating
roles: dev, master_technician, assistant, controller, estimator
keywords: new paper, flow, step, upload, contract, notice, clause, exhibit, bond, safety plan, runs out, spanish, contract library, flows
order: 97
---
A step of a flow can wait on a paper the app does not know yet. Add the paper once, and the step finishes when that paper is in.

## Add a paper

1. Open Settings, then Flows.
2. Find the step, and press **+ Add a new paper** under its papers.
3. Pick what kind of paper it is.
4. Fill in what that kind needs.
5. Press {{button:blue|Save}}.

The window says what it saved. The step now waits on the paper, and the paper joins the Contract library with the other flow papers.

## Pick the kind

- **They give it to us** is an upload, like a bond or a safety plan.
- **We write it, they sign it** is a contract, like a safety agreement.
- **We send it to inform** is a notice, like a start letter.

Every kind has a name in English and one in Spanish. The Spanish name is what a Spanish reader sees on their page.

## Add an upload

1. Give it a name, such as their bond.
2. Pick Yes under Does it run out if it has a date on it.
3. Pick how many days before it runs out we ask for the next one. The app starts at 30.

The step finishes once the paper is on file. A paper that runs out also needs its date ahead of today.

## Add a contract

1. Give it a name, such as the safety agreement.
2. Write each clause in English and in Spanish.
3. Pick who each clause is for. A clause for everyone is the base. A clause kept to one trade goes on that trade's exhibit, and only that trade sees it.
4. Press **Add a clause** for each clause after the first.

The e-sign consent is the app's own words on every sign page, so you never write it here.

A dev's or a controller's clauses publish as version 1 right away. Anyone else's clauses wait for a dev or a controller to approve them. Those approvers get a push and an email. The window says which happened, and who it reached.

## Add a notice

1. Give it a name, such as the start letter.
2. Write its words in English and in Spanish.

The step finishes when the notice goes. Nothing comes back from a notice.
