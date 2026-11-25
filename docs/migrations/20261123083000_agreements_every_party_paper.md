# 20261123083000_agreements_every_party_paper.sql (2026-11-23, v2.8354)

Where an outside signer lives, the owner's first decision (punch list #403, `to-dos/outside-signer-record/README.md`). Documents → Agreements lists every paper that is with an outside party, of any kind and any state. One view is restated. No table, no policy, no function and no edge function.

## The decision it builds

The card's pick: the Agreements tab lists every paper that is with an outside party, of any kind and any state, a party on no list among them, and one that is not signed carries **Send** and **Take back**. On 2026-11-22 the owner answered "Yes, all four" to the card's four picks, and on 2026-11-23 he said of the whole card "I wanna build four oh three as well".

## What was so before

`agreements_on_file` listed a paper of `person_contract_documents` only when it was an agreement, or a paper a job requires, and was sent or signed. So a party's W-9 or certificate was on the company's own page alone. A party on no list has no page, so their W-9 and a paper made for them and never sent were on no screen at all.

## What it makes

The view is restated from its newest definition ([`20261120010000_paper_party`](./20261120010000_paper_party.md)), with the person branch changed and nothing else. The columns are the same and in the same order.

- **A party's paper is a line whatever its kind and state.** A row with `party_contact_id` set is listed for any `doc_type` and any `status`. Every other paper is listed as before: an agreement or a job's paper, sent or signed.
- **A fourth state, `not_sent`.** A paper whose `status` is *unsent* reads it. Only a party's paper reaches the branch unsent, so no other kind can read it. Its moment is the moment it was made.
- **`facts.doc_type` on a party's line.** The tab draws a second tag from it: *W-9*, *Insurance certificate*, *License*. Every other line's facts are as they were.
- **The find box.** A party's W-9 is found by *w-9* or *w9*, a certificate by *insurance certificate*, a licence by *license*, and an unsent paper by *not sent*.
- The comment and the grant are put back.

## Rules it settles

- **Who reads a line is unchanged.** The view is `security_invoker`, so each table's own policy answers. The office's four roles read every such line. An estimator reads an outside company's, by `person_contract_documents_estimator_outside`, and reads nobody's on no list.
- **What an estimator now sees on the tab.** They already read these rows, and found them on the company's own page. The tab now lists them too: an outside company's W-9, its certificate and a paper nobody sent. A line still has no press for them.
- **A person's own papers are not widened.** A teammate's W-9, a sub's certificate and a paper made for a person and never sent are still no lines. They stay on People.
- **A trade company's GC papers are not widened.** A W-9 or a certificate filed under a trade company's own id (`company_id`, GC mode's bench) is still no line. Only its agreement is, as before.
- **The default list is unchanged.** The tab opens on sent and signed, and `not_sent` is neither. An unsent paper is under the **Not sent** chip and under Search.

## The client is first

A client that does not know `not_sent` reads it as *ended*, and would call an unsent paper *Voided*. The tab learned the state in v2.8352. **Push this only once that client is live.** The generated types and the dev seat's catalog do not change, since the view's columns do not, so no types PR follows.

## Who can do what they could not before

Nobody reads a row they could not read. The office and an estimator see on one more screen what each already read.

## The beds

- `supabase/tests/paper_party/20_scenario.sql` (`npm run test:pg:paper-party`). A supply house's W-9, a customer's certificate, the W-9 of someone on no list and a copy nobody sent are lines now, each with its state and kind. An estimator reads the outside companies' and none of a party on no list. A teammate's, a sub's and a trade company's own tax forms are still no lines. The find box finds each by its words. A new section plays **Take back**'s own statement as each role: an estimator takes nothing, nobody takes back a signed paper, and the table's delete policy answers the office's four roles, so the press being the leader's and a dev's is the app's own rule (a dev's and the controller's since v2.8530, `20261124214500`).
- `supabase/tests/agreements_on_file/20_scenario.sql` (`npm run test:pg:agreements-on-file`) is unchanged and still passes: an unsent paper and a W-9 of a person are absent.
- Both bed scripts re-apply the ground, which restates the view as it stood. They now re-apply this migration after it, as on prod.

## After the merge

`supabase db push`, once the Pages deploy of v2.8352 or later is live. No types PR and no function to deploy.
