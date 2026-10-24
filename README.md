# FluentPath Voice v0.2

A responsive English-learning voice-room prototype with five tutor personalities and real-time two-way audio using OpenAI Realtime API over WebRTC.

## Included

- Responsive web interface for desktop and mobile.
- Five tutor personalities: Friendly, Sarcastic, Strict, Neutral, and Casual.
- Different built-in voice selections per personality.
- CEFR learner level (A1–A2, B1–B2, C1–C2), practice scenarios, Arabic/English correction-language preference.
- Live microphone input and tutor audio playback over WebRTC.
- Transcript event handling where supported by the selected Realtime model.
- Short-lived client secrets created by the backend. The standard OpenAI API key is never sent to the browser.
- Rate limiting on session-token creation, basic origin allowlist, Helmet security headers.

## Requirements

- Node.js 20+
- An OpenAI API key with access to the Realtime API.
- API billing configured for the OpenAI project.
- Browser microphone permission.
- HTTPS in production. `http://localhost` is allowed for local development.

## Run locally

1. Extract this folder.
2. Copy `.env.example` to `.env`.
3. Put your standard API key in `.env`:
   `OPENAI_API_KEY=...`
4. Install dependencies:
   `npm install`
5. Start:
   `npm start`
6. Open `http://localhost:3000`.

Do not share `.env`, commit it to Git, or put a standard API key in `public/app.js`.

## How the connection works

1. Browser sends selected tutor/level/scenario to `POST /api/realtime-token`.
2. Express validates those options and requests a short-lived Realtime client secret using the server-only API key.
3. Browser requests microphone permission, creates an `RTCPeerConnection`, and sends its SDP offer to OpenAI Realtime using the short-lived secret.
4. Tutor audio streams back over WebRTC. A data channel carries session events and text messages.

## Tutor personalities

- Friendly: `marin` voice; patient, encouraging.
- Sarcastic: `ash` voice; playful, light teasing, never humiliating.
- Strict: `cedar` voice; firm coaching without abuse.
- Neutral: `sage` voice; calm and professional.
- Casual: `coral` voice; relaxed conversation.

Voice availability and exact behavior can vary by model/API version. The selected voice affects voice identity; personality is primarily controlled by the tutor instructions.

## Important production hardening before public launch

This is a prototype, not a complete production system. Before making it public:
- Add user authentication and enforce per-user session quotas.
- Apply a stricter abuse/rate-limit policy and API spend limits.
- Configure `ALLOWED_ORIGINS` to the exact production origin.
- Use HTTPS, monitor API usage, and avoid logging audio or sensitive transcripts.
- Add privacy/consent notices and an account/data deletion workflow if transcripts are stored.
- Test the selected voice IDs, event names, interruption behavior, mobile browsers, and current Realtime model availability in your OpenAI project.

## API documentation

- WebRTC voice guide: https://developers.openai.com/api/docs/guides/voice-webrtc
- Realtime API pricing: https://platform.openai.com/pricing

## Prototype boundaries

A live voice connection requires a valid API key and active API access. No API key is included in this archive. The browser can run only after the server is configured with your own credentials.
