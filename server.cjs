var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json({ limit: "50mb" }));
  app.post("/api/analyze-image", async (req, res) => {
    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ error: "Missing 'imageUrl' parameter." });
    }
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY environment variable is not defined on the server." });
      }
      const ai = new import_genai.GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      const imgResponse = await fetch(imageUrl);
      if (!imgResponse.ok) {
        throw new Error(`Failed to retrieve image from Supabase Storage: ${imgResponse.statusText}`);
      }
      const contentType = imgResponse.headers.get("content-type") || "image/png";
      const buffer = await imgResponse.arrayBuffer();
      const base64Data = Buffer.from(buffer).toString("base64");
      const fallbackModels = [
        "gemini-2.5-flash",
        "gemini-1.5-flash",
        "gemini-2.5-pro",
        "gemini-1.5-pro"
      ];
      let lastError = null;
      let textOutput = "";
      for (const modelName of fallbackModels) {
        let attempts = 0;
        const maxAttempts = 2;
        while (attempts < maxAttempts) {
          try {
            console.log(`Attempting image analysis with model: ${modelName} (attempt ${attempts + 1}/${maxAttempts})...`);
            const response = await ai.models.generateContent({
              model: modelName,
              contents: [
                {
                  inlineData: {
                    mimeType: contentType,
                    data: base64Data
                  }
                },
                "Analyze this uploaded inventory item image carefully. Analyze colors, style, category, and visual properties. Give it a highly professional and relevant name (2 to 5 words max, plain text, no quotes, do not preface with brand name), and a professional detailed and engaging description for our inventory database (2 or 3 sentences max)."
              ],
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: import_genai.Type.OBJECT,
                  properties: {
                    title: {
                      type: import_genai.Type.STRING,
                      description: "A clean, compact name describing what the item is in the photo."
                    },
                    description: {
                      type: import_genai.Type.STRING,
                      description: "A professional and detailed description highlighting key visual traits of the item."
                    }
                  },
                  required: ["title", "description"]
                }
              }
            });
            textOutput = response.text || "{}";
            console.log(`Successfully completed image analysis with model: ${modelName}`);
            break;
          } catch (modelErr) {
            console.error(`Model ${modelName} failed on attempt ${attempts + 1}:`, modelErr);
            lastError = modelErr;
            attempts++;
            if (attempts < maxAttempts) {
              await new Promise((resolve) => setTimeout(resolve, 1e3));
            }
          }
        }
        if (textOutput) {
          break;
        }
      }
      if (!textOutput) {
        throw new Error(`All Gemini AI analysis models (${fallbackModels.join(", ")}) failed or are unavailable: ${lastError?.message || lastError || "Unknown error"}`);
      }
      const parsed = JSON.parse(textOutput);
      return res.json({
        title: parsed.title || "AI Analyzed Asset",
        description: parsed.description || "Automatically analyzed asset description."
      });
    } catch (err) {
      console.error("Error analyzing image in server route:", err);
      return res.status(500).json({ error: err.message || "Failed to analyze image with AI." });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server listening on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
