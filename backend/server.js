import express from "express";
import multer from "multer";
import axios from "axios";
import fs from "fs";
import { exec } from "child_process";

const app = express();
const PORT = 3001;

app.use(express.json());

// Ensure folders exist
const ensureDirectoryExists = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};
ensureDirectoryExists("uploads");
ensureDirectoryExists("outputs");

// Multer config
const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => cb(null, "target.jpg"),
});
const upload = multer({ storage });

// Download first page from API
async function downloadImage(imageUrl, outputPath) {
    const response = await axios({ url: imageUrl, responseType: "stream" });

    return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);
        writer.on("finish", resolve);
        writer.on("error", reject);
    });
}

// Run Python script to generate `.mind` file
function generateMindFile() {
    return new Promise((resolve, reject) => {
        exec(`"C:\\Users\\DELL\\AppData\\Local\\Programs\\Python\\Python312\\python.exe" mindar_train.py uploads/target.jpg outputs/targets.mind`, (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ Python Error: ${error.message}`);
                return reject(error);
            }
            if (stderr) {
                console.error(`⚠️ Python Stderr: ${stderr}`);
            }
            console.log(`✅ MindAR File Generated: ${stdout}`);
            resolve("outputs/targets.mind");
        });

    });
}

// API to generate MindAR file
app.post("/generate-mind", async (req, res) => {
    try {
        const imageUrl = req.body.imageUrl;
        if (!imageUrl) return res.status(400).json({ error: "Image URL required" });

        console.log(`📥 Downloading image from: ${imageUrl}`);
        await downloadImage(imageUrl, "uploads/target.jpg");

        console.log("✅ Image downloaded successfully!");
        const mindFilePath = await generateMindFile();

        console.log(`✅ MindAR file ready at: ${mindFilePath}`);
        res.json({ success: true, mindFile: `http://localhost:${PORT}/${mindFilePath}` });
    } catch (error) {
        console.error("❌ Error generating `.mind` file:", error.message);
        res.status(500).json({ error: "Error generating `.mind` file" });
    }
});

// Serve outputs folder
app.use("/outputs", express.static("outputs"));

app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
