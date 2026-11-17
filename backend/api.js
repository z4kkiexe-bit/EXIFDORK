import "dotenv/config"
import express from "express"
import multer from "multer"
import cors from "cors"
import cookieParser from "cookie-parser"
import { rateLimit } from "express-rate-limit"
import { MongoClient } from "mongodb"
import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import dns from "node:dns"
import { randomUUID } from "node:crypto"
/* ------------------------------------------------------------------ *
 *  CONFIG (everything environment-specific comes from env variables)
 *
 *  PORT             Render sets this for you. Default 3999 for local dev.
 *  MONGODB_URI      your Atlas connection string
 *  CLOUDFLARE_SECRET_KEY   Turnstile SECRET key
 *  FRONTEND_URL     where the frontend lives, e.g. https://doxxer.onrender.com
 *                   (comma separated for several). Default: Vite dev server.
 *  NODE_ENV         "production" on the server (turns on secure cookies)
 *  COOKIE_SAMESITE  "lax" (default) when frontend and backend share one address
 *                   (e.g. via a rewrite/proxy). "none" only if they are on
 *                   different domains.
 *  EXIFTOOL_PATH    "exiftool" on Linux (default). On your Windows laptop:
 *                   ./exiftool-13.59_64/exiftool.exe
 * ------------------------------------------------------------------ */
const vsIsProduction = process.env.NODE_ENV === "production"
const viPort = process.env.PORT || 5000
const asFrontendOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
    .split(",")
    .map((sOrigin) => sOrigin.trim())
    .filter(Boolean)
const vsExiftoolPath = process.env.EXIFTOOL_PATH || "exiftool"
const vsSameSite = process.env.COOKIE_SAMESITE || "lax"
const viSessionMaxAge = 1000 * 60 * 60 * 24 * 365 // browsers cap cookies at ~400 days anyway
const oUsernamePattern = /^[a-zA-Z0-9_.-]{3,24}$/

const oCookieOptions = {
    httpOnly: true,
    secure: vsIsProduction || vsSameSite === "none", // "none" requires secure
    sameSite: vsSameSite,
    maxAge: viSessionMaxAge
}

const oMongoClient = new MongoClient(process.env.MONGODB_URI)
const collection = oMongoClient.db("DoxxerRegist").collection("Registers")

dns.setServers(["1.1.1.1"])
const app = express()
app.set("trust proxy", 1) // Render sits behind a proxy; needed for correct client IPs
app.use(cors({ origin: asFrontendOrigins, credentials: true }))
app.use(express.json({ limit: "10kb" }))
app.use(cookieParser())

const oRegisterLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: vsIsProduction ? 20 : 1000,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many attempts. Please try again later." }
})
const oMetadataLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: vsIsProduction ? 60 : 1000,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many requests. Please slow down." }
})

/* ----------------------------- helpers ----------------------------- */
async function verifyTurnstile(sToken) {
    const sSecret = process.env.CLOUDFLARE_SECRET_KEY

    if (!sSecret) {
        console.error("Turnstile: CLOUDFLARE_SECRET_KEY is missing")
        throw new Error("Turnstile secret is not configured")
    }

    if (typeof sToken !== "string" || sToken.length === 0) {
        return false
    }

    const oBody = new URLSearchParams()
    oBody.set("secret", sSecret)
    oBody.set("response", sToken)

    try {
        const oResponse = await fetch(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: oBody,
                signal: AbortSignal.timeout(8000)
            }
        )

        const oResult = await oResponse.json()

        console.log("Turnstile verification:", {
            status: oResponse.status,
            success: oResult.success,
            errorCodes: oResult["error-codes"] || []
        })

        if (!oResponse.ok) {
            throw new Error(`Turnstile HTTP error: ${oResponse.status}`)
        }

        return oResult.success === true
    } catch (oError) {
        console.error("Turnstile request failed:", oError.message)
        throw oError
    }
}
// Cookies are attacker-controlled. cookie-parser turns "j:{...}" cookies into
// objects, so only ever query with a plain string.
async function findSession(req) {
    const vSessionId = req.cookies.sessionId

    if (typeof vSessionId !== "string" || vSessionId.length === 0 || vSessionId.length > 100) {
        return null
    }

    return collection.findOne({ psSessionId: vSessionId })
}

async function requireSession(req, res, next) {
    try {
        const oSession = await findSession(req)
        if (!oSession) {
            return res.status(401).json({ error: "Not signed in" })
        }

        req.user = oSession
        next()
    } catch (error) {
        console.error("Session lookup failed:", error)
        res.status(500).json({ error: "Internal server error" })
    }
}

async function deleteFile(oFile) {
    try {
        await fs.unlink(oFile.path)
    } catch (error) {
        console.error("Could not delete upload:", error.message)
    }
}
const oUpload = multer({
    dest: "uploads/",
    limits: {
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: (req, file, callback) => {
        const asAllowList = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf"
        ]

        if (asAllowList.includes(file.mimetype)) {
            callback(null, true)
        } else {
            callback(new Error("File type not allowed"))
        }
    }
})
/* ------------------------------ routes ----------------------------- */

app.get("/", (req, res) => {
    res.json({ name: "Doxxer", status: "online" })
})

// Render can ping this to know the service is alive.
app.get("/healthz", (req, res) => {
    res.json({ status: "ok" })
})
app.post("/api/register", oRegisterLimiter, async (req, res) => {
    const vsUsername =
        typeof req.body?.username === "string"
            ? req.body.username.trim().toLowerCase()
            : ""
    const vsTurnstileToken = req.body?.turnstileToken

    if (!oUsernamePattern.test(vsUsername)) {
        return res.status(400).json({
            error: "Use 3 to 24 characters: letters, numbers, dot, underscore or dash."
        })
    }
    if (typeof vsTurnstileToken !== "string" || vsTurnstileToken.length === 0) {
        return res.status(400).json({ error: "Missing Cloudflare check. Please try again." })
    }

    try {
        if (!(await verifyTurnstile(vsTurnstileToken))) {
            return res.status(403).json({
                error: "Cloudflare verification failed. Please try again."
            })
        }
        const oRegistrar = {
            psSessionId: `session-${randomUUID()}`,
            psUsername: vsUsername,
            createdAt: Date.now()
        }

        await collection.insertOne(oRegistrar)

        console.log("New user registered:", {
            username: oRegistrar.psUsername,
            createdAt: oRegistrar.createdAt
        })
        res.cookie("sessionId", oRegistrar.psSessionId, oCookieOptions)
        return res.status(201).json({ success: true, message: "Registration successful" })
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: "That username is already taken." })
        }

        console.error("Registration failed:", {
            name: error.name,
            message: error.message,
            code: error.code,
            stack: error.stack
        })
        return res.status(500).json({ error: "Something went wrong. Please try again." })
    }
})
app.get("/api/me", async (req, res) => {
    res.set("Cache-Control", "no-store")

    try {
        const oSession = await findSession(req)

        if (!oSession) {
            return res.status(401).json({ error: "Not signed in" })
        }

        // sliding expiry: every visit starts the clock again
        res.cookie("sessionId", oSession.psSessionId, oCookieOptions)
        return res.status(200).json({
            success: true,
            username: oSession.psUsername
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "Internal server error" })
    }
})

app.post(
    "/api/metadata",
    requireSession,
    oMetadataLimiter,
    oUpload.single("file"),
    (req, res) => {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" })
        }
        const oFile = req.file
        let sOutput = ""
        let bDone = false

        const oExiftool = spawn(vsExiftoolPath, ["-j", oFile.path])
        const oTimer = setTimeout(() => oExiftool.kill(), 15000) // never hang the free instance
        // answer once, always delete the upload
        async function finish(viStatus, oBody) {
            if (bDone) return
            bDone = true
            clearTimeout(oTimer)
            await deleteFile(oFile)
            res.status(viStatus).json(oBody)
        }

        oExiftool.stdout.on("data", (oData) => {
            sOutput += oData.toString()
        })

        oExiftool.stderr.resume() // drain so the process can't block on a full pipe
        oExiftool.on("error", (oError) => {
            console.error(oError)
            finish(500, { error: "Failed to start exiftool" })
        })

        oExiftool.on("close", (viCode) => {
            if (viCode !== 0) {
                return finish(500, { error: "Failed to read the file" })
            }

            try {
                const oResponseMetadata = JSON.parse(sOutput)
                finish(200, {
                    filename: oFile.originalname,
                    size: oFile.size,
                    mimetype: oFile.mimetype,
                    metadata: oResponseMetadata[0]
                })
            } catch (error) {
                console.error(error.message)
                finish(500, { error: "Failed to parse metadata" })
            }
        })
    }
)
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({ error: "File exceeds the 10MiB limit" })
        }

        return res.status(400).json({ error: err.message })
    }

    if (err.message === "File type not allowed") {
        return res.status(415).json({ error: err.message })
    }
    if (err.status && err.status < 500) {
        return res.status(err.status).json({ error: "Bad request" })
    }

    console.error(err)
    res.status(500).json({ error: "Internal server error" })
})

/* ------------------------------ startup ---------------------------- */

try {
    await oMongoClient.connect()
    console.log("Mongodb connected")
    // This is what makes usernames unique. If old test data contains duplicates
    // the index can't be built: delete those test documents in Atlas, restart.
    try {
        await collection.createIndex({ psUsername: 1 }, { unique: true })
        await collection.createIndex({ psSessionId: 1 }, { unique: true })
    } catch (error) {
        console.error(
            "Could not create the unique indexes (duplicate test data?). " +
            "Usernames are NOT unique until this is fixed:",
            error.message
        )
    }
    console.log("PORT:", process.env.PORT)
    console.log("viPort:", viPort)
    app.listen(viPort, "0.0.0.0", () => {
        console.log(`Server running on port ${viPort}`)
    })
} catch (error) {
    console.error("MongoDB startup failed:", error)
    console.error("Cause:", error.cause)
    process.exitCode = 1
}
