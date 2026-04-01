-- Subjects of an attendance incident can read their own row (e.g. Calendar NCNS chip).

CREATE POLICY "Attendance incidents subject select own"
ON public.attendance_incidents
FOR SELECT
USING (subject_user_id = auth.uid());
