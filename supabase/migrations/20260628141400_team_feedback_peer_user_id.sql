-- Allow peer feedback ratings for team users without a people row (peer_user_id); keep peer_person_id for roster people.

ALTER TABLE public.team_feedback_peer_ratings
  ADD COLUMN IF NOT EXISTS peer_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.team_feedback_peer_ratings
  ALTER COLUMN peer_person_id DROP NOT NULL;

ALTER TABLE public.team_feedback_peer_ratings
  DROP CONSTRAINT IF EXISTS team_feedback_peer_ratings_submission_id_peer_person_id_key;

ALTER TABLE public.team_feedback_peer_ratings
  ADD CONSTRAINT team_feedback_peer_ratings_one_peer_target CHECK (
    (peer_person_id IS NOT NULL AND peer_user_id IS NULL)
    OR (peer_person_id IS NULL AND peer_user_id IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS team_feedback_peer_ratings_submission_person_unique
  ON public.team_feedback_peer_ratings (submission_id, peer_person_id)
  WHERE peer_person_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS team_feedback_peer_ratings_submission_user_unique
  ON public.team_feedback_peer_ratings (submission_id, peer_user_id)
  WHERE peer_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_team_feedback_peer_ratings_peer_user
  ON public.team_feedback_peer_ratings (peer_user_id);

COMMENT ON COLUMN public.team_feedback_peer_ratings.peer_user_id IS 'When set, peer is a users row without using people.id; mutually exclusive with peer_person_id.';
