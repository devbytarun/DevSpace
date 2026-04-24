const { GoogleGenerativeAI } = require("@google/generative-ai");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

let cachedModel = null;

function getModel() {
  if (cachedModel) return cachedModel;
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  const genAI = new GoogleGenerativeAI(apiKey);
  cachedModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  return cachedModel;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ reply: "Method not allowed" })
    };
  }

  const model = getModel();
  if (!model) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ reply: "Missing GOOGLE_API_KEY in Netlify environment variables." })
    };
  }

  let body = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ reply: "Invalid JSON body." })
    };
  }

  const message = (body.message || "").trim();
  if (!message) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ reply: "message is required" })
    };
  }

  try {
    const result = await model.generateContent(message);
    const response = await result.response;
    const text = response.text();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ reply: text || "No reply" })
    };
  } catch (error) {
    const status = Number(error?.status) || 500;
    const fallback =
      status === 401
        ? "GOOGLE_API_KEY is invalid for this deployment."
        : "Failed to generate reply";

    return {
      statusCode: status >= 400 && status < 600 ? status : 500,
      headers: corsHeaders,
      body: JSON.stringify({ reply: fallback })
    };
  }
};
