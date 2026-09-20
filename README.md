# KLIP

KLIP is a voice-driven, screen-aware AI companion for your desktop. Hold a hotkey, ask a question, and KLIP can use what is on your screen to answer in context—then speak, stream, or point you to the exact thing it is describing.

It is an independent, cross-platform reimagining of the interaction pioneered by [Clicky](https://www.clicky.so/) from [Farza](https://github.com/farzaa). KLIP is built from scratch with Electron for Windows, macOS, and Linux.

## What it does

- Uses a global hotkey for push-to-talk or toggle-to-talk conversations.
- Captures screen context so you do not have to narrate your UI or paste screenshots.
- Guides you with a cursor-aware overlay and step-by-step walkthroughs.
- Supports Anthropic, OpenAI, Google Gemini, Ollama, and compatible local endpoints.
- Supports ElevenLabs and Sarvam AI for speech, plus Groq Whisper and Sarvam for transcription.
- Keeps chats and provider keys on-device; keys use Electron's platform storage encryption.
- Maintains long conversations by compacting older context into useful summaries.
- Works across multiple displays and provides a setup flow for permissions, microphone, keys, and shortcuts.

## Quick start

Requirements: [Bun](https://bun.sh), Node.js 20+, and a desktop platform supported by Electron.

```bash
bun install
bun run dev
```

In a second terminal, launch the app after the TypeScript and renderer watchers are ready:

```bash
bun run start
```

## Configure providers

Add and validate provider keys from KLIP's onboarding flow or **Settings**. You only need the services you intend to use:

- **Reasoning:** Anthropic, OpenAI, Google Gemini, or a local OpenAI-compatible endpoint
- **Text to speech:** ElevenLabs or Sarvam AI
- **Speech to text:** Groq or Sarvam AI

KLIP stores keys locally using Electron's `safeStorage`; provider requests go directly to the service you select. An account is not required for local use.

## Build installers

```bash
bun run package          # Current platform
bun run package:win      # Windows NSIS installer
bun run package:mac      # macOS DMG and ZIP
bun run package:linux    # Linux AppImage and DEB
```

## Landing page

The marketing site lives in [`landing`](landing). It is a static Next.js export and can be deployed to Vercel, GitHub Pages, or any static host.

```bash
cd landing
bun install
bun run dev
```

Run `bun run build` to create the deployable static site in `landing/out`.

## Optional cloud preferences

KLIP can optionally use Amazon Cognito, API Gateway, Lambda, and DynamoDB to save portable preferences across devices. Local use remains fully functional without this. See [the AWS backend guide](docs/aws-backend.md).

## License and credit

MIT — see [LICENSE](LICENSE). Clicky is the inspiration for KLIP's core interaction; KLIP does not bundle or redistribute Clicky's source.
