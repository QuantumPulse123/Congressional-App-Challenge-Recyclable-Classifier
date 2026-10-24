import * as ort from "onnxruntime-web"

export type ClassifyProblemResult = {
  category: string
  summary: string
  severity: "low" | "medium" | "high"
}

export type RecyclabilityResult = {
  recyclable: boolean
  material: string
  instructions: string
  confidence: number
}

type ClassMap = {
  classes: string[]
  recyclable_classes: string[]
  non_recyclable_classes: string[]
}

type ModelVersion = { sha256: string }

const MODEL_BASE_URL = `${import.meta.env.BASE_URL}recycle-model.onnx`
const MODEL_VERSION_URL = `${import.meta.env.BASE_URL}recycle-model-version.json`
const CLASS_MAP_URL = `${import.meta.env.BASE_URL}recycle-class-map.json`

function publicAssetUrl(path: string) {
  return new URL(path, document.baseURI).toString()
}

let sessionPromise: Promise<ort.InferenceSession> | null = null
let classMapPromise: Promise<ClassMap> | null = null
let modelVersionPromise: Promise<ModelVersion | null> | null = null

function configureOrt() {
  ort.env.wasm.wasmPaths = publicAssetUrl(`${import.meta.env.BASE_URL}ort/`)
  ort.env.wasm.numThreads = 1
  ort.env.wasm.simd = true
}

async function getModelVersion() {
  if (!modelVersionPromise) {
    modelVersionPromise = fetch(publicAssetUrl(MODEL_VERSION_URL), { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null
        return response.json() as Promise<ModelVersion>
      })
      .catch(() => null)
  }
  return modelVersionPromise
}

async function getSession() {
  if (!sessionPromise) {
    configureOrt()
    sessionPromise = (async () => {
      const version = await getModelVersion()
      const suffix = version?.sha256
        ? `?v=${encodeURIComponent(version.sha256)}`
        : ""
      const response = await fetch(publicAssetUrl(MODEL_BASE_URL) + suffix, {
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error(`Unable to load classifier model (HTTP ${response.status})`)
      }

      const modelBytes = new Uint8Array(await response.arrayBuffer())
      if (modelBytes.length < 1_000_000) {
        throw new Error("Classifier model download is unexpectedly small")
      }

      return ort.InferenceSession.create(modelBytes, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      })
    })()
  }
  return sessionPromise
}

async function getClassMap() {
  if (!classMapPromise) {
    classMapPromise = fetch(publicAssetUrl(CLASS_MAP_URL), { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Unable to load model class map")
      return response.json() as Promise<ClassMap>
    })
  }
  return classMapPromise
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Unable to decode image"))
    image.src = dataUrl
  })
}

async function imageToTensor(dataUrl: string) {
  const image = await loadImage(dataUrl)
  const canvas = document.createElement("canvas")
  canvas.width = 224
  canvas.height = 224
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) throw new Error("Canvas is unavailable")

  context.drawImage(image, 0, 0, 224, 224)
  const { data } = context.getImageData(0, 0, 224, 224)
  const tensorData = new Float32Array(3 * 224 * 224)
  const mean = [0.485, 0.456, 0.406]
  const std = [0.229, 0.224, 0.225]

  for (let i = 0; i < 224 * 224; i++) {
    const offset = i * 4
    tensorData[i] = (data[offset] / 255 - mean[0]) / std[0]
    tensorData[224 * 224 + i] = (data[offset + 1] / 255 - mean[1]) / std[1]
    tensorData[2 * 224 * 224 + i] = (data[offset + 2] / 255 - mean[2]) / std[2]
  }

  return new ort.Tensor("float32", tensorData, [1, 3, 224, 224])
}

function softmax(values: Float32Array | number[]) {
  const max = Math.max(...values)
  const exps = Array.from(values, (value) => Math.exp(value - max))
  const total = exps.reduce((sum, value) => sum + value, 0)
  return exps.map((value) => value / total)
}

function formatMaterial(className: string) {
  return className.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
}

function disposalInstructions(className: string, recyclable: boolean) {
  if (!recyclable) {
    const instructions: Record<string, string> = {
      food_organics: "Place food and organic waste in your compost or organics bin where accepted. Do not put it in standard recycling.",
      miscellaneous_trash: "Place this item in general waste unless your local program has a specialized collection option.",
      textile_trash: "Do not place textiles in curbside recycling. Use a textile donation or textile recycling drop-off when available.",
      vegetation: "Place yard or plant waste in your local organics or yard-waste collection where accepted.",
    }
    return instructions[className] ?? "This material is not classified as recyclable by the model. Check your local waste guidelines for specialized disposal options."
  }
  const instructions: Record<string, string> = {
    cardboard: "Flatten cardboard and keep it clean and dry. Place it in your paper or cardboard recycling stream according to local guidelines.",
    glass: "Empty and rinse the glass container. Place it in your local glass recycling stream if accepted, and check whether lids should be separated.",
    metal: "Empty and rinse the metal container. Place it in your local metal or mixed recycling stream according to local guidelines.",
    paper: "Keep paper clean and dry and place it in your local paper or mixed recycling stream.",
    plastic: "Empty and rinse the plastic item. Check the resin/recycling symbol and your local program before placing it in recycling.",
  }
  return instructions[className] ?? "Check your local recycling guidelines for the correct recycling stream."
}

export async function classifyProblem(description: string, imageBase64?: string): Promise<ClassifyProblemResult> {
  void imageBase64
  const lower = description.toLowerCase()
  if (lower.includes("dump") || lower.includes("trash") || lower.includes("garbage")) return { category: "illegal_dumping", summary: "Illegal waste dumping detected. This requires prompt municipal attention.", severity: "high" }
  if (lower.includes("pollut") || lower.includes("chemical") || lower.includes("oil")) return { category: "pollution", summary: "Environmental pollution identified. May pose health risks to surrounding ecosystem.", severity: "high" }
  if (lower.includes("hazard") || lower.includes("toxic") || lower.includes("battery")) return { category: "hazardous_waste", summary: "Hazardous materials detected. Requires specialized disposal team.", severity: "high" }
  if (lower.includes("graffiti") || lower.includes("vandal") || lower.includes("spray")) return { category: "graffiti", summary: "Vandalism/graffiti identified. Recommend reporting to local authorities.", severity: "low" }
  if (lower.includes("litter") || lower.includes("bottle") || lower.includes("can")) return { category: "litter", summary: "General littering observed. Community cleanup recommended.", severity: "low" }
  return { category: "other", summary: "Environmental issue detected. Municipal review recommended.", severity: "medium" }
}

export async function checkRecyclability(imageBase64: string): Promise<RecyclabilityResult> {
  const [session, classMap] = await Promise.all([getSession(), getClassMap()])
  const input = await imageToTensor(imageBase64)
  const inputName = session.inputNames[0]
  const outputName = session.outputNames[0]
  if (!inputName || !outputName) throw new Error("Model input/output is unavailable")

  const outputs = await session.run({ [inputName]: input })
  const output = outputs[outputName]
  if (!output) throw new Error("Model output is unavailable")

  const logits = output.data as Float32Array
  if (logits.length !== classMap.classes.length) throw new Error("Model output does not match class map")

  const probabilities = softmax(logits)

  const scoredClasses = classMap.classes.map((name, index) => ({
    name,
    probability: probabilities[index] ?? 0,
    recyclable: classMap.recyclable_classes.includes(name),
  }))
  
  // Add together the scores for each of the two groups.
  const recyclableScore = scoredClasses
    .filter((item) => item.recyclable)
    .reduce((sum, item) => sum + item.probability, 0)
  
  const nonRecyclableScore = scoredClasses
    .filter((item) => !item.recyclable)
    .reduce((sum, item) => sum + item.probability, 0)
  
  // Choose the group with the larger combined score.
  const recyclable = recyclableScore >= nonRecyclableScore
  
  // Keep the representative material consistent with the chosen result.
  const bestClass = scoredClasses
    .filter((item) => item.recyclable === recyclable)
    .sort((a, b) => b.probability - a.probability)[0]
  
  if (!bestClass) {
    throw new Error("Unable to determine recyclability")
  }

  return {
    recyclable,
    material: formatMaterial(bestClass.name),
    instructions: disposalInstructions(bestClass.name, recyclable),
    confidence: Math.max(recyclableScore, nonRecyclableScore),
  }
}
