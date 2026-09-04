# 20260904044533_job_contracts_signed_document_url.sql (2026-09-04, v2.2744)

**File a signed contract** — adds `job_contracts.signed_document_url text`: the Google Doc (or Drive, or any https link) the office files as the signed contract, recorded with `signer_mode = 'paper'` beside the optional `paper_upload_path`. Additive `ADD COLUMN IF NOT EXISTS`; metadata-only.

**Apply order**: push before the client deploy if you can — the v2.2744 modal writes the column on *Record as signed*; the read paths (`select('*')`) tolerate its absence. `share-job-contract` reads it to email the link for link-only records; deploy after the push.
