import { readFileSync } from "node:fs"
import vm from "node:vm"
import ts from "typescript"
import { loadEnv } from "vite"

const env = loadEnv("development", process.cwd(), "")
const source = readFileSync(new URL("../src/lib/ai.ts", import.meta.url), "utf8")
const fn = source.slice(source.indexOf("export async function classifyProblem"), source.indexOf("export async function checkRecyclability"))
const code = ts.transpileModule(fn.replace("export ", "").replaceAll("import.meta.env", "env"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText
const context = vm.createContext({
  env, AbortSignal, Error,
  fetch: async (...args) => {
    const response = await fetch(...args)
    const body = await response.clone().json().catch(() => null)
    console.log("OpenRouter response:", JSON.stringify({ status: response.status, model: body?.model, finishReason: body?.choices?.[0]?.finish_reason, contentLength: body?.choices?.[0]?.message?.content?.length ?? 0, completionTokens: body?.usage?.completion_tokens, reasoningTokens: body?.usage?.completion_tokens_details?.reasoning_tokens, errorCode: body?.error?.code }))
    return response
  },
})
vm.runInContext(code, context)
try {
  // Optional synthetic 1px PNG checks multimodal routing without uploading personal photos.
  const image = process.argv.includes("--image") ? "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=" : undefined
  const result = await context.classifyProblem("Several plastic bottles and empty food wrappers are scattered beside a park walking path. Any attached image is a synthetic blank test image; use the report text as the evidence.", image)
  console.log("Live AI analysis:", JSON.stringify(result))
} catch (error) {
  console.log("Live AI check failed:", error.message)
  process.exitCode = 1
}
if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY) {
  const headers = { apikey: env.VITE_SUPABASE_ANON_KEY }
  for (const [name, path] of [["Auth settings", "/auth/v1/settings"], ["Report schema/read access", "/rest/v1/trash_reports?select=id,title,description,category,ai_classification,ai_severity,latitude,longitude,address,status,image_url,created_at&limit=0"]]) {
    try {
      const response = await fetch(env.VITE_SUPABASE_URL + path, { headers, signal: AbortSignal.timeout(15_000) })
      const body = await response.json()
      console.log(name + ":", JSON.stringify({ status: response.status, ...(name === "Auth settings" ? { emailEnabled: body.external?.email, anonymousEnabled: body.external?.anonymous_users, emailConfirmationRequired: body.mailer_autoconfirm === false } : { errorCode: body.code, error: body.message }) }))
    } catch (error) { console.log(name + ":", error.message); process.exitCode = 1 }
  }
}
