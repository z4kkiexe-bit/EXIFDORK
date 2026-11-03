import express from "express"
import multer from "multer"
import cors from 'cors'
import fs from "node:fs/promises"
import { spawn } from 'node:child_process'

const app = express()
const port = 3888

async function deleteFile(req) { 
    await fs.unlink(req.file.path).catch((error) => {
        console.error(error.message)
    })
    console.log(`File ${req.file.originalname} was deleted`)
}

app.use(cors({
    origin: 'http://localhost:5173'
}))

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

app.get("/", (req, res) => {
    res.json({
        name: 'EXIFDORK',
        status: 'online'
    })
})

app.post("/api/metadata", oUpload.single("file"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            error: "No file uploaded"
        })
    }
    const oExiftool = spawn("./exiftool-13.59_64/exiftool.exe", ["-j", req.file.path])
    let sOutput = ""
    
    oExiftool.stdout.on("data", (oData) => {
        sOutput += oData.toString()
    })

    oExiftool.on("error", (oError) => {
        console.error(oError)

        if (!res.headersSent) {
            res.status(500).json({
                error: "Failed to start exiftool"
            }) 
        }
    })

    oExiftool.on("close", async (processCode) => {
        if (res.headersSent) {
            await deleteFile(req)
            return
        }
        try {
            if (processCode !== 0) {
            await deleteFile(req)
            return res.status(500).json({
                error: "failed to read the file"
            })
        }} catch(error) {

        }

            
        try {
            const oResponseMetadata = JSON.parse(sOutput)

            res.status(200).json({
                filename: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype,
                metadata: oResponseMetadata[0]
            })
                        
        } catch(error) {
            console.error(error.message)

            res.status(500).json({
                error: "failed to parse metadata"
            })
        } finally {
            await deleteFile(req)
        }
    })

    
})

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE")
            return res.status(413).json({
                error: "File exceeds the 10MiB limit"
        })

        return res.status(400).json({
            error: err.message
        })
    }

    if (err.message === 'File type not allowed') {
        return res.status(415).json({
            error: err.message
        })
    }

    console.error(err)

    res.status(500).json({
        error: 'Internal server error'
    })

})

app.listen(port,  () => {
    console.log(`EXIFDORK running at http://localhost:${port}`)
})