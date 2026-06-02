const express = require("express")
const router = express.Router()
const { v4: uuid } = require("uuid")
const sessions = require("../utils/sessions")
const { generateToken } = require("../services/id4face.service")

// ─── Crear sesión y generar link biométrico ───────────────────────────────
router.post("/start-verification", async (req, res) => {
  try {
    const { cedula, dactilar } = req.body

    if (!cedula || !dactilar) {
      return res.status(400).json({
        success: false,
        message: "cedula y dactilar son requeridos"
      })
    }

    const token = await generateToken()
    const sessionId = uuid()

    sessions[sessionId] = {
      cedula,
      dactilar,
      token,
      createdAt: new Date()
    }

    const verificationUrl = `${process.env.SELF_URL}/verify/${sessionId}`

    return res.json({
      success: true,
      sessionId,
      url: verificationUrl
    })
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message })
  }
})

// ─── Servir página HTML con componente id4face ───────────────────────────
router.get("/verify/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params
    const session = sessions[sessionId]

    if (!session) {
      return res.status(404).send("Sesión no encontrada")
    }

   const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Validación Biométrica</title>
  <script src="https://id4face.eclipsoft.com/dist/id4face@2.4.0.js" defer></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      max-width: 500px;
      width: 100%;
      background: white;
      padding: 32px 24px;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.1);
      text-align: center;
    }
    h2 { color: #111827; margin-bottom: 8px; font-size: 1.4rem; }
    #status { color: #6b7280; font-size: 0.9rem; margin-bottom: 24px; }
    
    eclipsoft-id4face { display: block; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Validación Biométrica</h2>
    <p id="status">Inicializando...</p>
    <eclipsoft-id4face dismissable oval limits></eclipsoft-id4face>
  </div>

  <script>
    const WHATSAPP_RETURN_URL = "https://wa.me/${process.env.WHATSAPP_NUMBER}"

    // ── Iniciar biometría ─────────────────────────────────────────────────
    window.addEventListener("load", async () => {
      const id4face = document.querySelector("eclipsoft-id4face")
      const status = document.getElementById("status")

      id4face.token = "${session.token}"

      const config = {
        camera: "front",
        minMatch: "98",
        blink: true,
        env: "${process.env.ID4FACE_ENV || "dev"}",
        faceRecognition: true,
        callbackUrl: "${process.env.SELF_URL}/callback",
        checkId: {
          id: "${session.cedula}",
          dactilar: "${session.dactilar}"
        }
      }

      try {
        status.textContent = "Inicializando biometría..."
        await id4face.load(config)
        status.textContent = "Por favor mire a la cámara"

        // Intentar start() directamente después del load
        try {
          await id4face.start()
        } catch (e) {
          console.warn("start() directo falló, esperando ready:", e)
        }

        // ready como respaldo por si start() no funcionó
        id4face.addEventListener("ready", () => {
          status.textContent = "Por favor mire a la cámara"
          try { id4face.start() } catch (e) { console.error(e) }
        })

      } catch (error) {
        console.error(error)
        status.textContent = "Error iniciando biometría: " + error.message
      }

      // ── Resultado exitoso → notificar backend → redirigir a WhatsApp ───
      id4face.addEventListener("result", async (event) => {
        status.textContent = "Procesando resultado..."
        try {
          const response = await fetch("${process.env.SELF_URL}/callback", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-callback-token": "${process.env.CALLBACK_TOKEN}"
            },
            body: JSON.stringify({
              sessionId: "${sessionId}",
              result: event.detail
            })
          })

          if (response.ok) {
            status.textContent = "✅ Validación completada. Regresando a WhatsApp..."
            // Esperar 1.5s para que el usuario vea el mensaje y redirigir
            setTimeout(() => {
              window.location.href = WHATSAPP_RETURN_URL
            }, 1500)
          } else {
            status.textContent = "Error procesando resultado."
          }
        } catch (err) {
          console.error(err)
          status.textContent = "Error enviando resultado."
        }
      })

      id4face.addEventListener("failed", (event) => {
        status.textContent = "❌ Validación fallida: " + (event.detail?.message || "intente de nuevo")
      })
    })
  </script>
</body>
</html>`

    res.send(html)
  } catch (error) {
    return res.status(500).send("Error interno: " + error.message)
  }
})

module.exports = router
