import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { imageUrl } = req.body;

  if (!imageUrl) {
    return res.status(400).json({ error: "Missing 'imageUrl' parameter." });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res
        .status(500)
        .json({
          error: "GEMINI_API_KEY environment variable is not defined on the server.",
        });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) {
      throw new Error(
        `Failed to retrieve image from storage: ${imgResponse.statusText}`
      );
    }

    const contentType = imgResponse.headers.get("content-type") || "image/png";
    const buffer = await imgResponse.arrayBuffer();
    const base64Data = Buffer.from(buffer).toString("base64");

    const fallbackModels = [
      "gemini-2.5-flash",
      "gemini-1.5-flash",
      "gemini-2.5-pro",
      "gemini-1.5-pro",
    ];

    let lastError = null;
    let textOutput = "";

    for (const modelName of fallbackModels) {
      let attempts = 0;
      const maxAttempts = 2;

      while (attempts < maxAttempts) {
        try {
          console.log(
            `Attempting image analysis with model: ${modelName} (attempt ${attempts + 1}/${maxAttempts})...`
          );

          const response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                inlineData: {
                  mimeType: contentType,
                  data: base64Data,
                },
              },
              "Analyze this uploaded inventory item image carefully. Analyze colors, style, category, and visual properties. Give it a highly professional and relevant name (2 to 5 words max, please be concise). Then provide a detailed professional description.",
            ],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: {
                    type: Type.STRING,
                    description:
                      "A clean, compact name describing what the item is in the photo.",
                  },
                  description: {
                    type: Type.STRING,
                    description:
                      "A professional and detailed description highlighting key visual traits of the item.",
                  },
                },
                required: ["title", "description"],
              },
            },
          });

          textOutput = response.text || "{}";
          console.log(
            `Successfully completed image analysis with model: ${modelName}`
          );
          break;
        } catch (modelErr) {
          console.error(
            `Model ${modelName} failed on attempt ${attempts + 1}:`,
            modelErr
          );
          lastError = modelErr;
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }

      if (textOutput) {
        break;
      }
    }

    if (!textOutput) {
      throw new Error(
        `All Gemini AI analysis models (${fallbackModels.join(", ")}) failed or are unavailable: ${lastError?.message || lastError || "Unknown error"}`
      );
    }

    const parsed = JSON.parse(textOutput);
    return res.json({
      title: parsed.title || "AI Analyzed Asset",
      description:
        parsed.description || "Automatically analyzed asset description.",
    });
  } catch (err) {
    console.error("Error analyzing image in server route:", err);
    return res.status(500).json({
      error: err.message || "Failed to analyze image with AI.",
    });
  }
}
