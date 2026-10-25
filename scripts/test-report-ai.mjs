import { readFileSync } from "node:fs"
import vm from "node:vm"
import test from "node:test"
import assert from "node:assert/strict"
import ts from "typescript"

// Exercise the actual browser analyzer without ONNX or a live API request.
const source = readFileSync(new URL("../src/lib/ai.ts", import.meta.url), "utf8")
const fn = source.slice(source.indexOf("export async function classifyProblem"), source.indexOf("export async function checkRecyclability"))
const code = ts.transpileModule(fn.replace("export ", "").replaceAll("import.meta.env", "env"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText
const result = { category: "litter", severity: "low", summary: "Reported bottles beside a path. Consider a community cleanup." }

function setup(options = {}) {
  let sent
  let calls = 0
  const context = vm.createContext({
    AbortSignal, Error,
    env: { VITE_OPENROUTER_API_KEY: options.missingKey ? "" : "test-key", VITE_OPENROUTER_MODEL: options.model },
    fetch: async (_url, init) => {
      calls++
      sent = JSON.parse(init.body)
      if (options.timeout) { const error = new Error("timeout"); error.name = "TimeoutError"; throw error }
      const completion = options.completions?.[Math.min(calls - 1, options.completions.length - 1)]
        ?? { choices: [{ message: { content: options.content ?? JSON.stringify(result) } }] }
      return new Response(JSON.stringify(completion), { status: options.status ?? 200 })
    },
  })
  vm.runInContext(code, context)
  return { analyze: context.classifyProblem, get sent() { return sent }, get calls() { return calls } }
}

test("analyzes text and a photo directly with the free router", async () => {
  const app = setup()
  const image = "data:image/jpeg;base64,AAAA"
  assert.deepEqual(JSON.parse(JSON.stringify(await app.analyze("Bottles", image))), result)
  assert.equal(app.sent.model, "openrouter/free")
  assert.equal(app.sent.max_tokens, 2048)
  assert.equal(app.sent.response_format.type, "json_schema")
  assert.equal(app.sent.messages[1].content[1].image_url.url, image)
})
test("rejects missing key, paid models, and invalid descriptions before calling the API", async () => {
  for (const [options, description] of [[{ missingKey: true }, "Litter"], [{ model: "paid/model" }, "Litter"], [{}, " "], [{}, "a".repeat(5001)]]) {
    const app = setup(options)
    await assert.rejects(app.analyze(description))
    assert.equal(app.calls, 0)
  }
})
test("handles provider authentication errors and quotas", async () => {
  await assert.rejects(setup({ status: 401 }).analyze("Litter"), /API key/)
  await assert.rejects(setup({ status: 429 }).analyze("Litter"), /quota/)
  await assert.rejects(setup({ status: 503 }).analyze("Litter"), /unavailable/)
})
test("rejects malformed and invalid AI output", async () => {
  for (const content of ["not JSON", "null", JSON.stringify({ ...result, category: "made_up" }), JSON.stringify({ ...result, severity: "urgent" }), JSON.stringify({ ...result, summary: "" })]) {
    await assert.rejects(setup({ content }).analyze("Litter"))
  }
})

test("parses markdown, commentary, and text block responses without changing JSON strings", async () => {
  const withBraces = { ...result, summary: 'Reported a container labeled "{unknown}". Keep a distance.' }
  for (const content of ["```json\n" + JSON.stringify(withBraces) + "\n```", "Analysis:\n" + JSON.stringify(withBraces), [{ type: "text", text: JSON.stringify(withBraces) }]]) {
    const app = setup({ content })
    assert.deepEqual(JSON.parse(JSON.stringify(await app.analyze("A container"))), withBraces)
    assert.equal(app.calls, 1)
  }
})
test("retries empty, truncated, and malformed completions with a larger token budget", async () => {
  for (const first of [{ choices: [{ finish_reason: "length", message: { content: "", reasoning: "thinking" } }] }, { choices: [{ message: { content: '{"category":' } }] }, { choices: [{ finish_reason: "length", message: { content: JSON.stringify(result) } }] }]) {
    const app = setup({ completions: [first, { choices: [{ finish_reason: "stop", message: { content: JSON.stringify(result) } }] }] })
    assert.deepEqual(JSON.parse(JSON.stringify(await app.analyze("Litter"))), result)
    assert.equal(app.calls, 2)
    assert.equal(app.sent.max_tokens, 4096)
  }
})
test("limits retries and handles refusals, provider errors, and timeouts", async () => {
  const empty = setup({ content: "" })
  await assert.rejects(empty.analyze("Litter"), /two attempts/)
  assert.equal(empty.calls, 2)
  for (const completion of [{ error: { message: "provider failed" } }, { choices: [{ finish_reason: "content_filter", message: {} }] }]) {
    const app = setup({ completions: [completion] })
    await assert.rejects(app.analyze("Litter"))
    assert.equal(app.calls, 1)
  }
  await assert.rejects(setup({ timeout: true }).analyze("Litter"), /timed out/)
})
