import { readFileSync } from "node:fs"
import test, { before, after } from "node:test"
import assert from "node:assert/strict"
import { PGlite } from "@electric-sql/pglite"

// Run the actual migrations and RLS policies in an isolated Postgres instance.
const db = new PGlite()
const member = "00000000-0000-0000-0000-000000000001"
const admin = "00000000-0000-0000-0000-000000000002"
const guest = "00000000-0000-0000-0000-000000000003"
const report = "00000000-0000-0000-0000-000000000010"
before(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz, is_anonymous boolean DEFAULT false);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array(name, '/') $$;
    INSERT INTO auth.users (id,email,email_confirmed_at,is_anonymous) VALUES
      ('${member}','member@example.invalid',now(),false),
      ('${admin}','vvrukshav@gmail.com',NULL,false),
      ('${guest}',NULL,NULL,true);
  `)
  for (const filename of ["20260905191116_create_reports_table.sql", "20261025000000_complete_report_integration.sql", "20261025010000_admin_and_report_resolution.sql"]) {
    await db.exec(readFileSync(new URL("../supabase/migrations/" + filename, import.meta.url), "utf8"))
  }
  await db.exec(`INSERT INTO public.trash_reports (id,user_id,title,description,category,latitude,longitude) VALUES ('${report}','${member}','Park litter','Bottles beside path','litter',39.2,-76.8)`)
})
after(async () => db.close())
async function asUser(id, role = "authenticated") {
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','${id}',false); SET ROLE ${role}`)
}
test("unconfirmed designated email is not admin; confirmation provisions its Auth ID", async () => {
  await asUser(admin)
  assert.equal((await db.query("SELECT public.is_report_admin() AS allowed")).rows[0].allowed, false)
  await db.exec(`RESET ROLE; UPDATE auth.users SET email_confirmed_at=now() WHERE id='${admin}'`)
  await asUser(admin)
  assert.equal((await db.query("SELECT public.is_report_admin() AS allowed")).rows[0].allowed, true)
})
test("regular users cannot read or alter the admin membership table", async () => {
  await asUser(member)
  assert.equal((await db.query("SELECT public.is_report_admin() AS allowed")).rows[0].allowed, false)
  await assert.rejects(db.query("SELECT * FROM public.report_admins"), /permission denied/)
  await assert.rejects(db.query(`INSERT INTO public.report_admins VALUES ('${member}')`), /permission denied/)
})
test("regular users cannot directly edit or delete reports", async () => {
  await asUser(member)
  assert.equal((await db.query(`UPDATE public.trash_reports SET title='Unauthorized' WHERE id='${report}' RETURNING id`)).rows.length, 0)
  assert.equal((await db.query(`DELETE FROM public.trash_reports WHERE id='${report}' RETURNING id`)).rows.length, 0)
})
test("verified members can resolve reports without gaining edit access", async () => {
  await asUser(member)
  const result = (await db.query(`SELECT public.resolve_report('${report}') AS report`)).rows[0].report
  assert.equal(result.status, "resolved")
  assert.equal(result.title, "Park litter")
  assert.equal(Object.hasOwn(result, "user_id"), false)
  assert.equal((await db.query(`UPDATE public.trash_reports SET status='open' WHERE id='${report}' RETURNING id`)).rows.length, 0)
  await assert.rejects(db.query("SELECT public.resolve_report('00000000-0000-0000-0000-000000000099')"), /Report not found/)
})
test("anonymous sessions and public visitors cannot resolve reports", async () => {
  await asUser(guest)
  await assert.rejects(db.query(`SELECT public.resolve_report('${report}')`), /verified account/)
  await asUser("", "anon")
  await assert.rejects(db.query(`SELECT public.resolve_report('${report}')`), /permission denied/)
})
test("admins can reopen, edit, add, and delete reports while validation remains enforced", async () => {
  await asUser(admin)
  assert.equal((await db.query(`UPDATE public.trash_reports SET title='Updated by admin',status='open' WHERE id='${report}' RETURNING id`)).rows.length, 1)
  await assert.rejects(db.query(`UPDATE public.trash_reports SET latitude=1000 WHERE id='${report}'`), /row-level security/)
  await assert.rejects(db.query(`UPDATE public.trash_reports SET user_id='${admin}' WHERE id='${report}'`), /permission denied/)
  const created = (await db.query(`INSERT INTO public.trash_reports (user_id,title,description,category,latitude,longitude) VALUES ('${admin}','Admin report','Needs cleanup','litter',39,-76) RETURNING id`)).rows[0]
  assert.ok(created.id)
  assert.equal((await db.query(`DELETE FROM public.trash_reports WHERE id='${created.id}' RETURNING id`)).rows.length, 1)
})
