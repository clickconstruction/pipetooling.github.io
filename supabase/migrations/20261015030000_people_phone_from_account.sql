SET lock_timeout = '3s';

-- The roster's numbers from each person's account (v2.5551; the owner, 2026-10-15: "add the numbers on People for the
-- roster", after v2.5546 showed most of the roster with no number on file). A roster row (people) whose phone is blank
-- takes the phone on the account it is linked to (people.account_user_id → users.phone), an archived account's too,
-- never a sample's or a twin's. Once now, for every row (people_phones_from_accounts, re-runnable), and from here on
-- by two triggers: an account that gains or changes its phone fills its roster rows' blank phone, and a roster row that
-- gains an account takes the account's phone when it has none. A phone the office typed on the roster is never
-- written over, and clearing one on the roster is left alone (the people trigger fires on the account link, not on
-- the phone). The triggers are definers, since the person editing their own account may not write the roster.

-- ---------- once, for the roster as it stands ----------

CREATE OR REPLACE FUNCTION public.people_phones_from_accounts()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_filled integer;
BEGIN
  UPDATE public.people p SET phone = btrim(u.phone)
  FROM public.users u
  WHERE u.id = p.account_user_id
    AND coalesce(btrim(p.phone), '') = ''
    AND coalesce(btrim(u.phone), '') <> ''
    AND coalesce(u.is_sample, false) = false
    AND coalesce(u.is_digital_twin, false) = false;
  GET DIAGNOSTICS v_filled = ROW_COUNT;
  RETURN v_filled;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.people_phones_from_accounts() FROM PUBLIC, anon, authenticated;

-- ---------- from here on ----------

-- An account's phone, set or changed, fills the blank phone on the roster rows linked to it.
CREATE OR REPLACE FUNCTION public.people_phone_from_account_on_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(btrim(NEW.phone), '') = '' OR coalesce(NEW.is_sample, false) OR coalesce(NEW.is_digital_twin, false) THEN
    RETURN NEW;
  END IF;
  UPDATE public.people SET phone = btrim(NEW.phone)
  WHERE account_user_id = NEW.id AND coalesce(btrim(phone), '') = '';
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.people_phone_from_account_on_users() FROM PUBLIC, anon, authenticated;

-- A roster row that gains an account takes the account's phone when the row has none.
CREATE OR REPLACE FUNCTION public.people_phone_from_account_on_people()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
BEGIN
  IF NEW.account_user_id IS NOT NULL AND coalesce(btrim(NEW.phone), '') = '' THEN
    SELECT btrim(u.phone) INTO v_phone FROM public.users u
    WHERE u.id = NEW.account_user_id
      AND coalesce(btrim(u.phone), '') <> ''
      AND coalesce(u.is_sample, false) = false
      AND coalesce(u.is_digital_twin, false) = false;
    IF v_phone IS NOT NULL THEN
      NEW.phone := v_phone;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.people_phone_from_account_on_people() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS people_phone_from_account ON public.users;
CREATE TRIGGER people_phone_from_account
  AFTER INSERT OR UPDATE OF phone ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.people_phone_from_account_on_users();

DROP TRIGGER IF EXISTS people_phone_from_account ON public.people;
CREATE TRIGGER people_phone_from_account
  BEFORE INSERT OR UPDATE OF account_user_id ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.people_phone_from_account_on_people();

-- The roster as it stands, once.
SELECT public.people_phones_from_accounts();
