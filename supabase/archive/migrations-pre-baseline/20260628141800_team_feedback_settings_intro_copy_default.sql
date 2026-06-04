-- Sync default intro copy for Team Feedback clock-out wizard (null or legacy default only).
UPDATE public.team_feedback_settings
SET intro_copy =
  '100% Anonymous — No names or employee IDs are attached. Your feedback helps us run better, safer jobs.'
WHERE id = 1
  AND (
    intro_copy IS NULL
    OR intro_copy =
      'Your responses help leadership improve the field experience. This is anonymous to your manager; only aggregate trends may be shared.'
  );
