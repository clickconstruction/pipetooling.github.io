-- Add phone column to users for user's contact phone
-- Users can update their own profile (name, email, phone) via "My Profile" in Settings

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
