import axios from "axios"
import express from "express"
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import dns from "node:dns"
import cookieParser from "cookie-parser"
import cors from "cors"

const app = express()
const viPort = 3999
const oMongoClient = new MongoClient(process.env.MONGODB_URI)
const db = oMongoClient.db("DoxxerRegist")
const collection = db.collection("Registers")

dns.setServers(["1.1.1.1"])
app.use(express.json())
app.use(cookieParser())
app.use(cors({ origin: "http://localhost:5173", credentials: true }))

async function sendToken(token) {
    const oResponse = await axios.post("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        secret: process.env.CLOUDFLARE_SECRET_KEY,
        response: token
    })
    return oResponse
}
async function connectMongoDB() {
    await oMongoClient.connect();
    console.log("Mongodb connected")
}

try {
    await connectMongoDB()
    app.listen(viPort, () => {
        console.log(`Server running on port ${viPort}`)
    })
} catch(error) {
    console.error(error.message)
    process.exitCode = 1
}

app.post("/api/register", async (req, res) => {
    const vsUsernames = req.body.username
    const  vsTurnStileToken = req.body.turnstileToken
    

    try {
        const oCloudFlareResponse = await sendToken(vsTurnStileToken)

        if (oCloudFlareResponse.data.success === true) {
            console.log("Turnstile verification succesfull on", vsUsernames)
            const oRegistrar = {
                psSessionId: `session-${randomUUID()}`,
                psUsername: vsUsernames,
                createdAt: Date.now()
            }
            const oInsertResult = await collection.insertOne(oRegistrar)
            console.log("Inserted ID:", oInsertResult.insertedId)
            res.cookie("sessionId", oRegistrar.psSessionId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 1000 * 60 * 60 * 24 * 365 * 600   // 600 tahun wkwkwk
            })
            res.status(201).json({
                success: true,
                message: "Registration successful"
            })
        } else {
            return res.status(403).json({
                success: false,
                message: "Turnstile verification failed"
            })
        }
    } catch(error) {
        console.error(error.message)
        res.status(500).json({
            error: "Turnstile got an error"
        })
    }

})

app.get("/api/me", async (req, res) => {
    try {
        const vsSessionId = req.cookies.sessionId
        if (!vsSessionId) {
            return res.status(401).json({
                success: false,
                message: "No active session"
            })
        }
        const oSession = await collection.findOne({
            psSessionId: vsSessionId
        })

        if (!oSession) {
            return res.status(401).json({
                success: false,
                message: "Invalid session"
            })
        }
        res.cookie("sessionId", vsSessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 24 * 365
        })
        
        return res.status(200).json({
            success: true,
            username: oSession.psUsername
        })
    } catch(error) {
        console.error(error)

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        })
    }
})

