const axios = require("axios")
const { HttpsProxyAgent } = require("https-proxy-agent")

// ── Proxy para IP estática ───────────────
const proxyAgent = process.env.PROXY_URL
  ? new HttpsProxyAgent(process.env.PROXY_URL)
  : undefined

/**
 * Genera un token de sesión autenticándose en el servicio ID4FACE.
 * Este token se pasa al componente web eclipsoft-id4face.
 */
async function generateToken() {
  try {
    const authUrl = process.env.ID4FACE_AUTH_URL

    if (!authUrl) throw new Error("ID4FACE_AUTH_URL no está configurada.")

    const response = await axios.post(
      authUrl,
      {
        username: process.env.ID4FACE_USER,
        password: process.env.ID4FACE_PASS
      },
      {
        headers:    { "Content-Type": "application/json" },
        httpsAgent: proxyAgent
      }
    )

    const token = response.data?.id_token
    if (!token) throw new Error("No se obtuvo id_token de ID4FACE.")

    return token
  } catch (error) {
    console.error("Error generando token ID4FACE:", error.response?.status || error.message)
    throw error
  }
}

module.exports = { generateToken }