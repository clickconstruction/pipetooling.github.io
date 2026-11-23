# 20261123183000_evidence_staged_file_cap.sql (2026-11-23, v2.8375)

`dev_person_evidence_write` takes a staged file of up to 50 MB. It refused one over 10 MB.

## Why

The function is the dev seat's door for a piece of evidence on a person's HR file (`plan_person_evidence` → `apply_person_evidence`). Its 10 MB cap was the size a browser upload and a tool call's JSON body carry. Since dev-mcp 0.129.0 the seat's agent can declare a file by its size and sha256 and send the bytes straight to the private `hr-files` bucket, to a signed upload address the plan answers. The seat reads the object back and holds it to the plan before it calls this function. So the size a call can carry is no longer the limit, and a recording of 11 MB or 14 MB can be staged like any other file.

## What changes

One number and its words. The check on each file's `size_bytes` moves from 10,485,760 to 52,428,800, the project's storage limit, and the refusal reads *is over 50 MB*. The rest of the function is the function as `20261106020000_evidence_counsel_only.sql` left it: `src/lib/devMcp/devMcpEvidenceUpload.test.ts` compares the two and fails when anything else differs.

No table, no policy and no grant changes. `CREATE OR REPLACE` keeps the function's grants.

## What still holds a file to 10 MB

- The panel's Add evidence (`EVIDENCE_FILE_MAX_BYTES`), which uploads from the browser.
- A file sent to the seat as `content_base64`, checked by the seat before it reaches this function.
- `plan_mail_file`, which reads a file off a mail on the server, up to 10 MB.

## Order

Idempotent: a second run replaces the function with the same text. `CREATE OR REPLACE FUNCTION` takes a brief lock on the function alone, and the `SET lock_timeout` keeps it from queueing. Push it before dev-mcp 0.129.0 is deployed. Pushed late, nothing breaks: a declared file over 10 MB is refused by the function in words until the push, and every file of 10 MB or less files as before. No type regeneration: the signature is unchanged.
