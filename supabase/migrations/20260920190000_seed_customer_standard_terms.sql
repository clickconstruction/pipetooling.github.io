SET lock_timeout = '3s';

-- Signing it on paper, PR 4 (to-dos/contract-paper-lane): the customer's standard terms become a
-- real Contract Book document. Until now the wording every agreement carries was a source constant
-- (DEFAULT_JOB_CONTRACT_TERMS_PLAIN) — prod had 0 customer-audience documents, so the sweep's Terms
-- dropdown had one option and nobody in the office could change a word. This seeds that wording,
-- verbatim, as "Service agreement" (audience customer, plain, version 2026-09-20) under a new
-- "Customer agreements" packet. The constant stays in the client as the fallback when no customer
-- document exists. Who may edit it is unchanged (owner, 2026-09-20: any office staff — the Book's
-- existing policies and update_contract_book_entry()'s gate). Idempotent: seeds only when the Book
-- holds no customer document at all, so an office that has written its own is never overwritten.
-- A parity test (jobContractTermsSeed.test.ts) holds the text below to the constant.

DO $seed$
DECLARE
  v_template_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.contract_template_documents WHERE audience = 'customer') THEN
    RETURN;
  END IF;

  SELECT id INTO v_template_id FROM public.contract_templates WHERE lower(trim(name)) = 'customer agreements' LIMIT 1;
  IF v_template_id IS NULL THEN
    INSERT INTO public.contract_templates (name, sequence_order)
    VALUES ('Customer agreements', COALESCE((SELECT max(sequence_order) FROM public.contract_templates), 0) + 1)
    RETURNING id INTO v_template_id;
  END IF;

  INSERT INTO public.contract_template_documents
    (template_id, document_name, sequence_order, book_body_html, book_body_format, tags, audience, book_version_date)
  VALUES (
    v_template_id,
    'Service agreement',
    0,
    $terms$1. Scope. Contractor agrees to perform the work described above at the property listed, in a workmanlike manner and in accordance with applicable codes. Work not listed is not included.

2. Changes. Additional or changed work will be priced in writing and approved by the Customer before it proceeds. Approved changes become part of this agreement.

3. Payment. Payment is due as stated above. Balances unpaid 30 days after the due date accrue interest at the lesser of 1.5% per month or the maximum allowed by law, plus reasonable costs of collection.

4. Materials and site. Customer will provide reasonable access to the property and utilities needed for the work. Materials remain Contractor's property until paid for in full. Concealed conditions (rot, corrosion, code deficiencies, hidden lines) that require additional work are not included and will be handled as a change.

5. Warranty. Contractor warrants its labor for one year from completion. Manufacturer warranties apply to materials and equipment. The warranty does not cover damage from misuse, freezing, or work by others.

6. Permits and inspections. Where required, Contractor will obtain permits and schedule inspections; permit fees are included only if stated in the scope.

7. Cancellation. Either party may cancel before work begins with written notice; the Customer is responsible for materials already ordered for the job.

8. Electronic signature. The parties agree to conduct this transaction electronically. A typed or drawn signature on this document has the same force and effect as a handwritten signature.$terms$,
    'plain',
    ARRAY['customer', 'standard terms'],
    'customer',
    DATE '2026-09-20'
  );
END
$seed$;
