# 20261123030000_form_pdf_opens_outlive_paper.sql (2026-11-22, v2.8323)

Where an outside signer lives, the owner's fourth decision (punch list #403, `to-dos/outside-signer-record/README.md`). The open log outlives its paper. No screen, no client change and no edge function ride with it.

## The decision it builds

The card asked: *should the open log outlive its paper?* The pick was that it does. On 2026-11-22 the owner was asked "Take the card's pick on all four of #403's decisions?" and answered "Yes, all four".

## What was so before

Every open of a signed form's PDF is a line in `contract_form_pdf_opens`: which paper, who opened it and when. A signed W-9's PDF is the one place its whole tax number is, so the log is the record of who has seen one. The line was tied to its paper with `ON DELETE CASCADE`. Deleting a paper deleted the record of who had opened it.

## What it makes

No table, so no fence call. Every statement is safe to run twice.

- **`paper_name` and `paper_with`**, two new columns on `contract_form_pdf_opens`. The paper's name, and who the paper was with: the person it is filed under, a party's frozen name, or a trade company's name. Never a stored name (`party:<id>`, `gc-company:<id>`).
- **The trigger `keep_paper_words_on_open`** fills both when a line is written. `open-contract-form-pdf` writes the paper's id and who opened it, as before, and needs no redeploy.
- **The lines already kept are filled once.** Each still has its paper, since a deleted paper took its lines until now.
- **`person_contract_document_id` may be empty**, and its key is `ON DELETE SET NULL`. The key is put back `NOT VALID` and then validated, so the swap holds its strong lock for an instant.
- **`contract_paper_with_words(p_paper_id)`**, a definer the trigger reads. Nobody signed in may call it.

## Rules it settles

- **A line says what it was at the open.** The words are frozen when the line is written. A company renamed later, or a paper deleted, changes no line.
- **An open still needs a paper.** A line cannot be written for a paper that is not there. Only a later delete empties the link.
- **Who reads the log is unchanged.** A dev and the controller. Nobody signed in writes it.

## Who can do what they could not before

Nobody. No role reads or writes anything new. A dev and the controller now still find a line after its paper is deleted.

## The bed

`supabase/tests/form_pdf_opens_outlive_paper/20_scenario.sql` (`npm run test:pg:form-pdf-opens-outlive-paper`, in `scripts/sql-beds.txt`). It writes opens of a person's, a supply house's and a trade company's signed paper, deletes two of the papers as a dev through row security, and reads the log as each role.

## After the merge

`supabase db push`, then a types PR. No client reads the new columns.
