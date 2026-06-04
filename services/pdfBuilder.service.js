const axios    = require("axios")
const FormData = require("form-data")
const fs       = require("fs")
const path     = require("path")
const { HttpsProxyAgent } = require("https-proxy-agent")

const PDF_BUILDER_BASE_URL = process.env.PDF_BUILDER_BASE_URL || "https://eclipsoft.dev/pdf-builder"

const proxyAgent = process.env.PROXY_URL
  ? new HttpsProxyAgent(process.env.PROXY_URL)
  : undefined

async function authenticatePdfBuilder() {
  const response = await axios.post(
    `${PDF_BUILDER_BASE_URL}/api/authenticate`,
    { username: process.env.ID4FACE_USER, password: process.env.ID4FACE_PASS },
    { headers: { "Content-Type": "application/json" }, httpsAgent: proxyAgent }
  )
  const token = response.data?.id_token
  if (!token) throw new Error("No se obtuvo id_token de PDF Builder.")
  console.log("Token PDF Builder obtenido ✓")
  return token
}

async function generateSumilladoDocument(options = {}) {
  const { name, nui, clientName, wordToFind } = options

  if (!name || !nui || !clientName || !wordToFind) {
    throw new Error("Faltan campos requeridos: name, nui, clientName, wordToFind")
  }

  const contractPath = path.join(__dirname, "../assets/Certificado_Chat_Sessions.pdf")
  if (!fs.existsSync(contractPath)) {
    throw new Error("Archivo Certificado_Chat_Sessions.pdf no encontrado en assets/")
  }
  const fileBuffer = fs.readFileSync(contractPath)

  const token = await authenticatePdfBuilder()

  const form = new FormData()
  form.append("file",       fileBuffer, { filename: "Certificado_Chat_Sessions.pdf", contentType: "application/pdf" })
  form.append("name",       name)
  form.append("nui",        nui)
  form.append("clientName", clientName)
  form.append("wordToFind", wordToFind)

  console.log("=== PDF BUILDER: generando sumillado ===")
  console.log("name:", name, "| nui:", nui, "| wordToFind:", wordToFind)

  const response = await axios.post(
    `${PDF_BUILDER_BASE_URL}/api/edit-word`, form,
    {
      headers:      { ...form.getHeaders(), "Authorization": `Bearer ${token}` },
      httpsAgent:   proxyAgent,
      responseType: "arraybuffer",
      timeout:      30000
    }
  )

  console.log("PDF Builder response status:", response.status)
  console.log("PDF sumillado size (bytes):", response.data?.length)

  return Buffer.from(response.data)
}

module.exports = { generateSumilladoDocument }