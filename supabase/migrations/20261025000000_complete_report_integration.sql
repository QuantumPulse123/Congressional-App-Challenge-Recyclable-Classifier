-- Apply after 20260905191116_create_reports_table.sql. Existing reports remain readable.
ALTER TABLE public.trash_reports
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_severity text CHECK (ai_severity IN ('low', 'medium', 'high'));

DROP POLICY IF EXISTS public_insert_reports ON public.trash_reports;
DROP POLICY IF EXISTS public_update_reports ON public.trash_reports;
DROP POLICY IF EXISTS public_delete_reports ON public.trash_reports;

CREATE POLICY authenticated_insert_reports ON public.trash_reports
  FOR INSERT TO authenticated WITH CHECK (
    user_id = (SELECT auth.uid()) AND status = 'open'
    AND length(trim(title)) BETWEEN 1 AND 160
    AND length(trim(description)) BETWEEN 1 AND 5000
    AND category IN ('illegal_dumping', 'litter', 'pollution', 'hazardous_waste', 'graffiti', 'other')
    AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
    AND (ai_classification IS NULL OR length(ai_classification) <= 2000)
  );
-- Public readers only receive report fields, not the anonymous author's identity.
REVOKE SELECT ON public.trash_reports FROM anon, authenticated;
GRANT SELECT (id, title, description, category, ai_classification, ai_severity,
  latitude, longitude, address, status, image_url, created_at)
  ON public.trash_reports TO anon, authenticated;
GRANT INSERT ON public.trash_reports TO authenticated;
REVOKE UPDATE, DELETE ON public.trash_reports FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS trash_reports_user_id_idx ON public.trash_reports(user_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('report-images', 'report-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY report_image_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'report-images' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY report_image_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'report-images' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY report_image_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'report-images' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- Atomic per-user throttle. Clients cannot write counters directly.
CREATE TABLE public.report_analysis_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL,
  requests integer NOT NULL
);
ALTER TABLE public.report_analysis_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.report_analysis_limits FROM anon, authenticated;
CREATE FUNCTION public.reserve_report_analysis() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE request_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  INSERT INTO public.report_analysis_limits AS limits (user_id, window_started_at, requests)
    VALUES (auth.uid(), now(), 1)
  ON CONFLICT (user_id) DO UPDATE SET
    requests = CASE WHEN limits.window_started_at <= now() - interval '1 hour' THEN 1 ELSE limits.requests + 1 END,
    window_started_at = CASE WHEN limits.window_started_at <= now() - interval '1 hour' THEN now() ELSE limits.window_started_at END
  RETURNING requests INTO request_count;
  RETURN request_count <= 10;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_report_analysis() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_report_analysis() TO authenticated;
