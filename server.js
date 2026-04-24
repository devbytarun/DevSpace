require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
app.use(cors());
app.use(express.json());

app.post("/api/chat", async (req, res) => {
  try {
    if (!req.body?.message) return res.status(400).json({ reply: "message is required" });
    const result = await model.generateContent(req.body.message);
    const response = await result.response;
    const text = response.text();
    res.json({ reply: text || "No reply" });
  } catch {
    res.status(500).json({ reply: "Failed to generate reply" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
