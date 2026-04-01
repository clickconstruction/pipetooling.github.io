-- Writeups: HR-style forms (templates + submissions about a subject user).
-- RLS mirrors contract tables (dev, pay-approved master, any master, assistant of pay-approved master, assistant).

CREATE TYPE public.writeup_disclosure AS ENUM (
  'discussed_with_subject',
  'withheld_from_subject'
);

COMMENT ON TYPE public.writeup_disclosure IS
  'Whether the writeup was discussed with the subject or withheld from them.';

CREATE TABLE IF NOT EXISTS public.writeup_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_writeup_templates_active ON public.writeup_templates(is_active) WHERE is_active;

COMMENT ON TABLE public.writeup_templates IS
  'Reusable writeup form definitions (JSON block schema). Staff-only via RLS.';

CREATE TABLE IF NOT EXISTS public.writeups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.writeup_templates(id) ON DELETE RESTRICT,
  subject_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  filled_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  disclosure public.writeup_disclosure,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT writeups_disclosure_when_submitted CHECK (
    status = 'draft' OR disclosure IS NOT NULL
  ),
  CONSTRAINT writeups_submitted_at_when_submitted CHECK (
    (status = 'submitted' AND submitted_at IS NOT NULL)
    OR (status = 'draft' AND submitted_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_writeups_subject_submitted ON public.writeups(subject_user_id, submitted_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_writeups_template_created ON public.writeups(template_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_writeups_author_created ON public.writeups(filled_by_user_id, created_at DESC);

COMMENT ON TABLE public.writeups IS
  'Completed or draft writeup instance about subject_user_id. Staff-only via RLS; subjects do not SELECT in v1.';

COMMENT ON COLUMN public.writeups.disclosure IS
  'Set when status=submitted: discussed_with_subject or withheld_from_subject.';

ALTER TABLE public.writeup_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.writeups ENABLE ROW LEVEL SECURITY;

-- writeup_templates: same access bundle as contract_templates (current migration)
CREATE POLICY "Writeups templates staff all"
ON public.writeup_templates
FOR ALL
USING (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_master_or_dev()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
)
WITH CHECK (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_master_or_dev()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);

-- writeups: read for staff
CREATE POLICY "Writeups staff select"
ON public.writeups
FOR SELECT
USING (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_master_or_dev()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);

-- writeups: insert; author must be current user
CREATE POLICY "Writeups staff insert"
ON public.writeups
FOR INSERT
WITH CHECK (
  filled_by_user_id = auth.uid()
  AND (
    public.is_dev()
    OR public.is_pay_approved_master()
    OR public.is_master_or_dev()
    OR public.is_assistant_of_pay_approved_master()
    OR public.is_assistant()
  )
);

-- writeups: update only while draft (submit is draft -> submitted in one update)
CREATE POLICY "Writeups staff update draft"
ON public.writeups
FOR UPDATE
USING (
  status = 'draft'
  AND (
    public.is_dev()
    OR public.is_pay_approved_master()
    OR public.is_master_or_dev()
    OR public.is_assistant_of_pay_approved_master()
    OR public.is_assistant()
  )
)
WITH CHECK (
  (
    public.is_dev()
    OR public.is_pay_approved_master()
    OR public.is_master_or_dev()
    OR public.is_assistant_of_pay_approved_master()
    OR public.is_assistant()
  )
  AND (status = 'draft' OR (status = 'submitted' AND disclosure IS NOT NULL))
);

-- writeups: delete drafts — any staff in bundle; submitted — dev only
CREATE POLICY "Writeups staff delete draft"
ON public.writeups
FOR DELETE
USING (
  status = 'draft'
  AND (
    public.is_dev()
    OR public.is_pay_approved_master()
    OR public.is_master_or_dev()
    OR public.is_assistant_of_pay_approved_master()
    OR public.is_assistant()
  )
);

CREATE POLICY "Writeups dev delete submitted"
ON public.writeups
FOR DELETE
USING (public.is_dev() AND status = 'submitted');
