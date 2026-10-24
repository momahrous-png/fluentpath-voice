import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.OPENAI_API_KEY;

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || `http://localhost:${PORT}`)
  .split(",").map(x => x.trim()).filter(Boolean);

app.use("/api/", (req, res, next) => {
  const origin = req.get("origin");
  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: "Origin not allowed." });
  }
  next();
});

const sessionLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many session requests. Please wait a moment." }
});

const tutorProfiles = {
  friendly: {
    voice: "marin",
    label: "Friendly",
    style: "Warm, patient, encouraging and kind. Praise effort specifically. Correct mistakes gently."
  },
  sarcastic: {
    voice: "ash",
    label: "Sarcastic",
    style: "Playfully sarcastic with light, harmless teasing and witty humor. Never insult, humiliate, threaten, or target protected traits. Keep corrections useful and respectful."
  },
  strict: {
    voice: "cedar",
    label: "Strict",
    style: "Firm, demanding and direct like a strict language coach. Challenge vague answers and insist on complete sentences. Never shout, threaten, shame, or abuse the learner."
  },
  neutral: {
    voice: "sage",
    label: "Neutral",
    style: "Calm, neutral, concise and professional. Give balanced corrections without exaggerated praise or humor."
  },
  casual: {
    voice: "coral",
    label: "Casual",
    style: "Relaxed, natural, conversational and friendly, like chatting with a classmate. Use everyday English."
  }
};

const scenarios = {
  daily: "Practice everyday small talk. Begin by asking how the learner's day is going.",
  interview: "Role-play a job interview. Ask one question at a time and help the learner answer professionally.",
  travel: "Role-play a travel situation such as hotel check-in, airport questions, or ordering food. Ask one question at a time.",
  debate: "Have a friendly debate about a simple topic. Ask the learner to explain their opinion and give a reason."
};

function instructionsFor({ persona, level, language, scenario }) {
  const profile = tutorProfiles[persona];
  const levelGuide = {
    beginner: "The learner is A1-A2. Use short sentences, common words, speak clearly, ask one question at a time, and allow time to answer.",
    intermediate: "The learner is B1-B2. Use natural everyday English, idioms sparingly, and ask follow-up questions that require explanation.",
    advanced: "The learner is C1-C2. Use nuanced, natural English, sophisticated vocabulary when useful, and encourage precise expression."
  }[level];
  const helpLanguage = language === "arabic"
    ? "When explaining a correction, briefly explain it in Arabic, then give a natural English example. Keep the conversation itself mainly in English."
    : "Keep the conversation and explanations in English unless the learner explicitly asks for another language.";
  return [
    "You are FluentPath, an AI English speaking tutor. This is a live voice conversation, not a lecture.",
    `Tutor personality: ${profile.style}`,
    `Learner level: ${levelGuide}`,
    `Practice scenario: ${scenarios[scenario]}`,
    helpLanguage,
    "Teaching loop: listen carefully, respond naturally, and ask only one clear follow-up question at a time.",
    "Do not interrupt unnecessarily. If the learner makes an important mistake, first respond to their meaning, then briefly model a corrected natural sentence.",
    "Prioritize fluency and confidence. Do not correct every tiny mistake. If the learner is stuck, offer a short hint.",
    "The learner may ask you to repeat or slow down. Accommodate them.",
    "Do not claim to assess pronunciation from text alone. Be supportive, safe, and respectful even in strict or sarcastic mode.",
    "Start the conversation now with a short greeting and a question that fits the scenario."
  ].join("\n");
}

app.post("/api/realtime-token", sessionLimiter, express.json({ limit: "8kb" }), async (req, res) => {
  if (!API_KEY) {
    return res.status(503).json({ error: "Server setup incomplete: add OPENAI_API_KEY to your .env file." });
  }
  const body = req.body || {};
  const persona = Object.hasOwn(tutorProfiles, body.persona) ? body.persona : "friendly";
  const level = ["beginner", "intermediate", "advanced"].includes(body.level) ? body.level : "beginner";
  const language = body.language === "english" ? "english" : "arabic";
  const scenario = Object.hasOwn(scenarios, body.scenario) ? body.scenario : "daily";
  const profile = tutorProfiles[persona];

  try {
    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": crypto.createHash("sha256")
          .update(String(req.ip || "anonymous")).digest("hex")
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: "gpt-realtime-2.1",
          instructions: instructionsFor({ persona, level, language, scenario }),
          audio: { output: { voice: profile.voice } }
        }
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Realtime token request failed:", response.status, data?.error?.message || "Unknown API error");
      return res.status(502).json({
        error: "Could not create a voice session. Check your API project access and billing, then try again."
      });
    }
    return res.json({ value: data.value, expires_at: data.expires_at, voice: profile.voice });
  } catch (err) {
    console.error("Realtime token request error:", err.message);
    return res.status(502).json({ error: "Could not reach the voice service. Try again shortly." });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true, app: "FluentPath Voice", version: "0.2.0" }));

app.listen(PORT, () => {
  console.log(`FluentPath Voice is running at http://localhost:${PORT}`);
  if (!API_KEY) console.log("Setup needed: copy .env.example to .env and add OPENAI_API_KEY.");
});
