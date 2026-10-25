-- Apply after the two earlier report migrations in the Supabase SQL Editor.
-- No passwords are stored here. Supabase Auth owns credentials and verification.
CREATE TABLE public.report_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);
ALTER TABLE public.report_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.report_admins FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.is_report_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.report_admins WHERE user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.is_report_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_report_admin() TO authenticated;

-- Bind the designated admin to a verified Auth user ID, never user-editable metadata.
INSERT INTO public.report_admins (user_id)
SELECT id FROM auth.users
WHERE lower(email) = 'vvrukshav@gmail.com' AND email_confirmed_at IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE FUNCTION public.assign_designated_report_admin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF lower(NEW.email) = 'vvrukshav@gmail.com' AND NEW.email_confirmed_at IS NOT NULL THEN
    INSERT INTO public.report_admins (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_designated_report_admin() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER assign_designated_report_admin
  AFTER INSERT OR UPDATE OF email, email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_designated_report_admin();

-- Only admins can directly edit or delete reports. The update grant is limited
-- to report fields; ownership, IDs, and creation timestamps cannot be rewritten.
GRANT UPDATE (title, description, category, status, latitude, longitude, address, image_url, ai_classification, ai_severity)
  ON public.trash_reports TO authenticated;
GRANT DELETE ON public.trash_reports TO authenticated;
CREATE POLICY admin_update_reports ON public.trash_reports FOR UPDATE TO authenticated
  USING ((SELECT public.is_report_admin()))
  WITH CHECK (
    (SELECT public.is_report_admin())
    AND length(trim(title)) BETWEEN 1 AND 160
    AND length(trim(description)) BETWEEN 1 AND 5000
    AND category IN ('illegal_dumping', 'litter', 'pollution', 'hazardous_waste', 'graffiti', 'other')
    AND status IN ('open', 'in_progress', 'resolved')
    AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
    AND (ai_classification IS NULL OR length(ai_classification) <= 2000)
  );
CREATE POLICY admin_delete_reports ON public.trash_reports FOR DELETE TO authenticated
  USING ((SELECT public.is_report_admin()));

-- Signed-in, confirmed members can resolve any report. Anonymous Auth users
-- cannot. This narrowly scoped function cannot change descriptions or reopen issues.
CREATE FUNCTION public.resolve_report(report_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result public.trash_reports;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = auth.uid()
      AND email_confirmed_at IS NOT NULL AND NOT coalesce(is_anonymous, false)
  ) THEN
    RAISE EXCEPTION 'Sign in with a verified account to resolve reports.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.trash_reports SET status = 'resolved'
    WHERE id = report_id RETURNING * INTO result;
  IF NOT FOUND THEN RAISE EXCEPTION 'Report not found.' USING ERRCODE = 'P0002'; END IF;
  RETURN to_jsonb(result) - 'user_id';
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_report(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_report(uuid) TO authenticated;
