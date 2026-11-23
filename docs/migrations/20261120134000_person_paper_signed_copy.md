# 20261120134000_person_paper_signed_copy.sql (2026-11-19, v2.8016)

A copy to the signer, and a PDF of a plain paper (punch list #376, *What is left*, row 2). A form has made a PDF since the forms train. A paper of plain words or clauses made none, and nobody was emailed once a person signed.

## What it makes

No table, so no fence call. No bucket and no policy. Both statements are safe to run twice.

- **`signed_pdf_storage_path`** on `person_contract_documents`: where the PDF of a signed plain or clause paper is kept, in the forms' bucket (`contract-form-pdfs`) at `<paper id>/signed-paper.pdf`. A form keeps its own in `form_pdf_storage_path`.
- **`signed_copy_sent_at`**: when the signer was emailed their copy.

## Rules it settles

- **Existing rows get nulls.** Nobody is emailed about an old paper.
- **An old signed paper's PDF is made the first time someone opens it**, by `person-paper-pdf`, and kept. Nothing is made in bulk.
- **Both columns are written as the service role**, by `accept-contract` and `person-paper-pdf`. No client writes them.

## Order

Push this before `accept-contract` and `person-paper-pdf` are deployed. Ahead of the push, `accept-contract`'s read of the new columns answers nothing and the signing carries on with no copy, so a deploy in the wrong order breaks no signature.

## Applied

**Applied** to prod by 2026-11-23: `npm run check:migration-drift` read 1,454 versions applied against 1,454 local files, this version among them (read in the docs pass after #9274); types regenerated in #9294.
