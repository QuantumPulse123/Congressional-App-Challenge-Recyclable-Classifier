import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createRequire } from "node:module"
import vm from "node:vm"
import test, { afterEach } from "node:test"
import assert from "node:assert/strict"
import ts from "typescript"
import { JSDOM } from "jsdom"

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost:5173/" })
for (const key of ["window", "document", "navigator", "HTMLElement", "HTMLInputElement", "HTMLButtonElement", "Element", "Node", "NodeFilter", "DocumentFragment", "MutationObserver", "Event", "CustomEvent", "File", "FileReader", "getComputedStyle"]) {
  Object.defineProperty(globalThis, key, { configurable: true, value: typeof dom.window[key] === "function" && key === "getComputedStyle" ? dom.window[key].bind(dom.window) : dom.window[key] })
}
globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0)
globalThis.cancelAnimationFrame = clearTimeout
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const React = await import("react")
const { render, screen, fireEvent, waitFor, cleanup, act } = await import("@testing-library/react")
const { MemoryRouter } = await import("react-router-dom")
const nativeRequire = createRequire(import.meta.url)
afterEach(() => cleanup())

// Load real TSX components and UI primitives; replace only backend I/O.
function loadComponent(relative, mocks) {
  const cache = new Map()
  function load(path) {
    if (cache.has(path)) return cache.get(path).exports
    const module = { exports: {} }
    cache.set(path, module)
    const source = readFileSync(path, "utf8").replaceAll("import.meta.env", '({BASE_URL:"/Congressional-App-Challenge-Recyclable-Classifier/",VITE_SUPABASE_URL:"https://example.supabase.co",VITE_SUPABASE_ANON_KEY:"public"})')
    const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
    const require = (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name]
      if (name.startsWith("@/")) {
        const base = resolve("src", name.slice(2))
        return load(base + (existsSync(base + ".tsx") ? ".tsx" : ".ts"))
      }
      return nativeRequire(name)
    }
    vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: path })(require, module, module.exports)
    return module.exports
  }
  return load(resolve(relative))
}

function authHarness(options = {}) {
  let listener
  let credentials
  let signupOptions
  const auth = {
    onAuthStateChange: (callback) => {
      listener = callback
      queueMicrotask(() => callback("INITIAL_SESSION", options.session ?? null))
      return { data: { subscription: { unsubscribe() { listener = null } } } }
    },
    signInWithPassword: async (value) => {
      credentials = value
      if (options.signInError) return { error: new Error("Invalid login credentials") }
      const session = { user: { id: "member-1", email: value.email, is_anonymous: false } }
      listener?.("SIGNED_IN", session)
      return { error: null }
    },
    signUp: async (value) => { signupOptions = value; return { data: { session: null }, error: options.sendError ? new Error("Email rate limit exceeded") : null } },
    signOut: async () => { listener?.("SIGNED_OUT", null); return { error: null } },
  }
  const { AuthControls } = loadComponent("src/components/AuthControls.tsx", { "@/lib/supabase": { isSupabaseConfigured: true, supabase: { auth } } })
  render(React.createElement(AuthControls))
  return { get credentials() { return credentials }, get signupOptions() { return signupOptions } }
}
async function openSignIn() {
  const button = await screen.findByRole("button", { name: "Sign in", exact: true })
  await waitFor(() => assert.equal(button.disabled, false))
  fireEvent.click(button)
}
function fillAuth() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "tester@example.invalid" } })
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-password-123" } })
}
test("password sign-in updates the header and sign-out works", async () => {
  const app = authHarness()
  await openSignIn()
  fillAuth()
  fireEvent.submit(screen.getByLabelText("Email").closest("form"))
  assert.ok(await screen.findByRole("button", { name: "Sign out" }))
  assert.deepEqual(app.credentials, { email: "tester@example.invalid", password: "test-password-123" })
  assert.equal(screen.queryByRole("dialog"), null)
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }))
  assert.ok(await screen.findByRole("button", { name: "Sign in", exact: true }))
})
test("signup explicitly redirects verification to Google and returns to password sign-in", async () => {
  const app = authHarness()
  await openSignIn()
  fireEvent.click(screen.getByRole("button", { name: "Create an account" }))
  fillAuth()
  fireEvent.submit(screen.getByLabelText("Email").closest("form"))
  assert.match((await screen.findByRole("status")).textContent, /opens Google after verification/)
  assert.equal(app.signupOptions.options.emailRedirectTo, "https://www.google.com/")
  assert.equal(app.signupOptions.email, "tester@example.invalid")
  assert.equal(screen.getByLabelText("Password").value, "")
  assert.equal(screen.queryByLabelText("Verification code"), null)
  assert.equal(screen.queryByRole("button", { name: "Sign out" }), null)
})
test("invalid credentials remain in the dialog for retry", async () => {
  const app = authHarness({ signInError: true })
  await openSignIn()
  fillAuth()
  fireEvent.submit(screen.getByLabelText("Email").closest("form"))
  assert.match((await screen.findByRole("alert")).textContent, /Invalid login credentials/)
  assert.ok(screen.getByRole("dialog"))
  assert.ok(screen.getByLabelText("Password"))
  assert.equal(app.credentials.email, "tester@example.invalid")
  assert.equal(screen.queryByRole("button", { name: "Sign out" }), null)
})
test("signup email failures remain on the signup form without claiming verification", async () => {
  authHarness({ sendError: true })
  await openSignIn()
  fireEvent.click(screen.getByRole("button", { name: "Create an account" }))
  fillAuth()
  fireEvent.submit(screen.getByLabelText("Email").closest("form"))
  assert.match((await screen.findByRole("alert")).textContent, /rate limit/)
  assert.ok(screen.getByLabelText("Email"))
  assert.ok(screen.getByRole("button", { name: "Create account", exact: true }))
  assert.equal(screen.queryByRole("status"), null)
})
test("restores a signed-in session and opens sign-in when a report requests it", async () => {
  authHarness({ session: { user: { email: "tester@example.invalid", is_anonymous: false } } })
  assert.ok(await screen.findByRole("button", { name: "Sign out" }))
  cleanup()
  authHarness()
  await act(async () => { await Promise.resolve(); window.dispatchEvent(new Event("ecoreport:sign-in")) })
  assert.ok(await screen.findByRole("dialog"))
})

function reportHarness(options = {}) {
  let inserted
  const uploads = [], removed = []
  const storage = {
    upload: async (path, file) => { uploads.push({ path, file }); return { error: null } },
    getPublicUrl: (path) => ({ data: { publicUrl: "https://example.test/" + path } }),
    remove: async (paths) => { removed.push(...paths); return { error: null } },
  }
  const { default: ReportPage } = loadComponent("src/pages/ReportPage.tsx", {
    "@/hooks/use-report-access": { useReportAccess: () => ({ signedIn: true, isAdmin: Boolean(options.admin), loading: false }) },
    "@/lib/supabase": {
      CATEGORIES: [{ value: "litter", label: "Litter", color: "orange" }, { value: "other", label: "Other", color: "gray" }],
      ensureReportSession: async () => "member-1",
      supabase: { storage: { from: () => storage }, from: () => ({ insert: async (value) => { inserted = value; return { error: options.insertError ? new Error("Database unavailable") : null } } }) },
    },
    "@/lib/ai": { classifyProblem: async () => {
      if (options.aiError) throw new Error("AI unavailable")
      return { category: "litter", severity: "low", summary: "Bottles beside a path. Contact park maintenance." }
    } },
  })
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: (success) => success({ coords: { latitude: 39.2, longitude: -76.8 } }) } })
  const view = render(React.createElement(MemoryRouter, null, React.createElement(ReportPage)))
  fireEvent.change(screen.getByLabelText("Describe the Problem *"), { target: { value: "Bottles beside a park path" } })
  return { ...view, get inserted() { return inserted }, uploads, removed }
}
test("AI-reviewed reports save the actual category, severity, summary, and location", async () => {
  const app = reportHarness()
  fireEvent.click(screen.getByRole("button", { name: "Analyze with AI" }))
  assert.ok(await screen.findByText("AI Analysis"))
  assert.equal(screen.getByRole("button", { name: "Submit Report" }).disabled, true)
  fireEvent.click(screen.getByRole("button", { name: "Use my location" }))
  fireEvent.click(screen.getByRole("button", { name: "Submit Report" }))
  assert.ok(await screen.findByText("Report Submitted!"))
  assert.equal(app.inserted.user_id, "member-1")
  assert.equal(app.inserted.category, "litter")
  assert.equal(app.inserted.ai_severity, "low")
  assert.equal(app.inserted.latitude, 39.2)
  assert.match(app.inserted.ai_classification, /Bottles/)
})
test("failed AI analysis still permits a manual report", async () => {
  const app = reportHarness({ aiError: true })
  fireEvent.click(screen.getByRole("button", { name: "Analyze with AI" }))
  assert.ok(await screen.findByText(/AI unavailable/))
  fireEvent.click(screen.getByRole("button", { name: "Litter", exact: true }))
  fireEvent.click(screen.getByRole("button", { name: "Use my location" }))
  fireEvent.click(screen.getByRole("button", { name: "Submit Report" }))
  assert.ok(await screen.findByText("Report Submitted!"))
  assert.equal(app.inserted.ai_classification, null)
  assert.equal(app.inserted.ai_severity, null)
})
test("uploads report photos and removes the upload if database insertion fails", async () => {
  const app = reportHarness({ insertError: true })
  fireEvent.change(app.container.querySelector('input[type="file"]'), { target: { files: [new File(["synthetic test"], "test.png", { type: "image/png" })] } })
  await screen.findByAltText("Preview")
  fireEvent.click(screen.getByRole("button", { name: "Continue without AI" }))
  fireEvent.click(screen.getByRole("button", { name: "Use my location" }))
  fireEvent.click(screen.getByRole("button", { name: "Submit Report" }))
  assert.ok(await screen.findByText("Database unavailable"))
  assert.equal(app.uploads.length, 1)
  assert.ok(app.uploads[0].path.startsWith("member-1/"))
  assert.equal(app.removed[0], app.uploads[0].path)
})

test("manual reports include the successfully uploaded photo URL", async () => {
  const app = reportHarness()
  fireEvent.change(app.container.querySelector('input[type="file"]'), { target: { files: [new File(["synthetic test"], "test.png", { type: "image/png" })] } })
  await screen.findByAltText("Preview")
  fireEvent.click(screen.getByRole("button", { name: "Continue without AI" }))
  fireEvent.click(screen.getByRole("button", { name: "Use my location" }))
  fireEvent.click(screen.getByRole("button", { name: "Submit Report" }))
  assert.ok(await screen.findByText("Report Submitted!"))
  assert.equal(app.inserted.image_url, "https://example.test/" + app.uploads[0].path)
  assert.equal(app.removed.length, 0)
})
test("editing a description clears outdated AI results and requires another review", async () => {
  reportHarness()
  fireEvent.click(screen.getByRole("button", { name: "Analyze with AI" }))
  await screen.findByText("AI Analysis")
  fireEvent.change(screen.getByLabelText("Describe the Problem *"), { target: { value: "Something different" } })
  assert.equal(screen.queryByText("AI Analysis"), null)
  assert.equal(screen.queryByRole("button", { name: "Submit Report" }), null)
  assert.ok(screen.getByRole("button", { name: "Analyze with AI" }))
})
test("admins can add reports with manual coordinates without GPS", async () => {
  const app = reportHarness({ admin: true })
  fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "38.9" } })
  fireEvent.change(screen.getByLabelText("Longitude"), { target: { value: "-77.1" } })
  fireEvent.click(screen.getByRole("button", { name: "Use coordinates" }))
  fireEvent.click(screen.getByRole("button", { name: "Continue without AI" }))
  fireEvent.click(screen.getByRole("button", { name: "Submit Report" }))
  assert.ok(await screen.findByText("Report Submitted!"))
  assert.equal(app.inserted.latitude, 38.9)
  assert.equal(app.inserted.longitude, -77.1)
})
test("report sessions reuse signed-in users and request sign-in when guest access is disabled", async () => {
  const { ensureReportSession: existing } = loadComponent("src/lib/supabase.ts", {
    "@supabase/supabase-js": { createClient: () => ({ auth: { getSession: async () => ({ data: { session: { user: { id: "existing-member" } } }, error: null }) } }) },
  })
  assert.equal(await existing(), "existing-member")
  let requested = false
  const handler = () => { requested = true }
  window.addEventListener("ecoreport:sign-in", handler)
  try {
    const { ensureReportSession: guest } = loadComponent("src/lib/supabase.ts", {
      "@supabase/supabase-js": { createClient: () => ({ auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        signInAnonymously: async () => ({ data: {}, error: new Error("Anonymous sign-ins are disabled") }),
      } }) },
    })
    await assert.rejects(guest(), /sign in or create an account/)
    assert.equal(requested, true)
  } finally { window.removeEventListener("ecoreport:sign-in", handler) }
})

function actionsHarness(options = {}) {
  let updated, deleted, patch, deleteCalls = 0, resolveCalls = 0
  const report = { id: "report-1", title: "Park litter", description: "Bottles beside path", category: "litter", status: options.resolved ? "resolved" : "open", latitude: 39.2, longitude: -76.8, address: null, image_url: null, ai_classification: null, created_at: new Date().toISOString() }
  const { ReportActions } = loadComponent("src/components/ReportActions.tsx", {
    "@/hooks/use-report-access": { useReportAccess: () => ({ signedIn: !options.guest, isAdmin: Boolean(options.admin), loading: false }) },
    "@/lib/supabase": {
      CATEGORIES: [{ value: "litter", label: "Litter" }, { value: "other", label: "Other" }], REPORT_FIELDS: "id,title,status",
      supabase: {
        rpc: async () => { resolveCalls++; return { data: options.fail ? null : { ...report, status: "resolved" }, error: options.fail ? new Error("Permission denied") : null } },
        from: () => ({
          update: (value) => { patch = value; return { eq: () => ({ select: () => ({ single: async () => ({ data: { ...report, ...value }, error: options.fail ? new Error("Permission denied") : null }) }) }) } },
          delete: () => { deleteCalls++; return { eq: () => ({ select: () => ({ single: async () => ({ data: { id: report.id }, error: options.fail ? new Error("Permission denied") : null }) }) }) } },
        }),
      },
    },
  })
  render(React.createElement(MemoryRouter, null, React.createElement(ReportActions, { report, onUpdated: (value) => { updated = value }, onDeleted: (id) => { deleted = id } })))
  return { get updated() { return updated }, get deleted() { return deleted }, get patch() { return patch }, get deleteCalls() { return deleteCalls }, get resolveCalls() { return resolveCalls } }
}
test("members can resolve a report but do not see admin edit/delete controls", async () => {
  const app = actionsHarness()
  assert.equal(screen.queryByRole("button", { name: "Edit", exact: true }), null)
  assert.equal(screen.queryByRole("button", { name: "Delete", exact: true }), null)
  fireEvent.click(screen.getByRole("button", { name: "Resolve", exact: true }))
  await waitFor(() => assert.equal(app.updated?.status, "resolved"))
  assert.equal(app.resolveCalls, 1)
})
test("guests are prompted to sign in without making a resolve request", () => {
  const app = actionsHarness({ guest: true })
  let prompted = false
  const callback = () => { prompted = true }
  window.addEventListener("ecoreport:sign-in", callback)
  try { fireEvent.click(screen.getByRole("button", { name: "Sign in to resolve" })); assert.equal(prompted, true); assert.equal(app.resolveCalls, 0) }
  finally { window.removeEventListener("ecoreport:sign-in", callback) }
})
test("admins edit report details and can reopen resolved reports", async () => {
  const app = actionsHarness({ admin: true, resolved: true })
  fireEvent.click(screen.getByRole("button", { name: "Edit", exact: true }))
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Cleanup still needed" } })
  fireEvent.change(screen.getByLabelText("Status"), { target: { value: "open" } })
  fireEvent.submit(screen.getByLabelText("Title").closest("form"))
  await waitFor(() => assert.equal(app.updated?.title, "Cleanup still needed"))
  assert.equal(app.patch.status, "open")
  assert.equal(screen.queryByRole("dialog"), null)
  assert.ok(screen.getByRole("button", { name: "Add report" }))
})
test("deletion requires confirmation and updates the map only after success", async () => {
  const app = actionsHarness({ admin: true })
  fireEvent.click(screen.getByRole("button", { name: "Delete", exact: true }))
  assert.equal(app.deleteCalls, 0)
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
  assert.equal(app.deleteCalls, 0)
  fireEvent.click(screen.getByRole("button", { name: "Delete", exact: true }))
  fireEvent.click(screen.getByRole("button", { name: "Delete report", exact: true }))
  await waitFor(() => assert.equal(app.deleted, "report-1"))
  assert.equal(app.deleteCalls, 1)
})
test("permission failures keep the report unchanged and show an error", async () => {
  const app = actionsHarness({ fail: true })
  fireEvent.click(screen.getByRole("button", { name: "Resolve", exact: true }))
  assert.match((await screen.findByRole("alert")).textContent, /Permission denied/)
  assert.equal(app.updated, undefined)
})
