-- Sparse table: row present => omit count line from Cover Letter / Approval fixture lists (revenue totals unchanged).

CREATE TABLE public.bid_count_row_submission_hides (
  bid_id UUID NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  count_row_id UUID NOT NULL REFERENCES public.bids_count_rows(id) ON DELETE CASCADE,
  price_book_version_id UUID NOT NULL REFERENCES public.price_book_versions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bid_id, count_row_id, price_book_version_id)
);

CREATE INDEX idx_bid_count_row_submission_hides_bid_version
  ON public.bid_count_row_submission_hides(bid_id, price_book_version_id);

ALTER TABLE public.bid_count_row_submission_hides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bid pricing users can read submission hides"
ON public.bid_count_row_submission_hides FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN (
      'dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'
    )
  )
  AND public.can_access_bid_for_pricing(bid_id)
);

CREATE POLICY "Bid pricing users can insert submission hides"
ON public.bid_count_row_submission_hides FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN (
      'dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'
    )
  )
  AND public.can_access_bid_for_pricing(bid_id)
);

CREATE POLICY "Bid pricing users can update submission hides"
ON public.bid_count_row_submission_hides FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN (
      'dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'
    )
  )
  AND public.can_access_bid_for_pricing(bid_id)
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN (
      'dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'
    )
  )
);

CREATE POLICY "Bid pricing users can delete submission hides"
ON public.bid_count_row_submission_hides FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN (
      'dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'
    )
  )
  AND public.can_access_bid_for_pricing(bid_id)
);

COMMENT ON TABLE public.bid_count_row_submission_hides IS
  'When a row exists for (bid_id, count_row_id, price_book_version_id), the fixture line is omitted from customer-facing lists (Cover Letter / Approval pricing grid); revenue totals include the row.';

INSERT INTO public.bid_count_row_submission_hides (bid_id, count_row_id, price_book_version_id)
SELECT DISTINCT bid_id, count_row_id, price_book_version_id
FROM public.bid_pricing_assignments
WHERE omit_from_submission_documents IS TRUE
ON CONFLICT DO NOTHING;

UPDATE public.bid_pricing_assignments
SET omit_from_submission_documents = false
WHERE omit_from_submission_documents IS TRUE;
