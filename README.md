# KLIP

A voice-driven, screen-aware AI companion that lives in the corner of your screen. Hold a hotkey, talk to it, and a small glowing pet glides across your display to point at whatever it's referring to.

> **Inspired by [Clicky](https://www.clicky.so/)** by [Farza](https://github.com/farzaa) ([github.com/farzaa/clicky](https://github.com/farzaa/clicky)).
> Clicky is the original idea — a macOS-only Swift app. KLIP is an independent reimagining built from scratch in Electron so the same experience can run on **Windows, macOS, and Linux**. All credit for the original concept, the pointing-cursor interaction, and the "vibe" goes to Farza. If you're on a Mac, go check out the original — it's great.

---

## What KLIP adds on top of the original idea

- **A living pet character** — a circular, glowing companion with no mouth and two capsule eyes that blink, look around, and react (idle / listening / thinking / speaking / success / error) through a real emotion state machine, animated with Framer Motion.
- **Cross-platform** — Windows, macOS, and Linux from a single Electron codebase.
- **Three reasoning providers** — pick between **Anthropic Claude** (Sonnet / Opus 4.6), **OpenAI** (GPT-5, GPT-5 mini, GPT-4o), and **Google Gemini** (2.5 Pro / Flash, with Google Search grounding) on the fly.
- **Two voice (TTS) providers** — **ElevenLabs**' full voice catalog with speed/stability tuning, or **Sarvam AI**'s Bulbul v2 speakers for strong multilingual and Indian-language output.
- **Two transcription (STT) providers** — **Groq** Whisper (fast, English-tuned) or **Sarvam AI** Saarika v2.5 (auto language detection, strong on Indian and code-switched speech).
- **Local chat history** — every conversation is stored on your machine, browsable from the panel, never uploaded.
- **Long-running context management** — auto-compacts older messages into a summary near a configurable token budget so a single conversation can run forever without blowing up the context window.
- **Customizable push-to-talk shortcut** — capture any key combination from the UI; the global shortcut re-registers live.
- **Multiple reasoning depths** — off / medium / deep "extended thinking" toggle.
- **Multi-display aware overlay** — the pet follows your real mouse across monitors.
- **Provider key management** — separate, encrypted local storage for each provider's API key with one-click validation.

The core loop — hold the hotkey, ask anything, watch the pet point — is faithful to Farza's original.

---

## Running locally

Requires [Bun](https://bun.sh) (or npm) and Node 20+.

```bash
bun install
bun run dev
```

That starts the TypeScript watcher for the main process and Vite for the renderer. Launch the Electron app from a separate terminal once the dev servers are up:

```bash
bun run start
```

## Building installers

```bash
bun run package          # current platform
bun run package:win      # Windows .exe (NSIS)
bun run package:mac      # macOS .dmg + .zip (universal)
bun run package:linux    # AppImage + .deb
```

Releases are also produced automatically by GitHub Actions on every `v*` tag — see [`.github/workflows/build.yml`](.github/workflows/build.yml).

## Configuration

You'll need API keys for the providers you want to use — everything is added and validated live inside the app, either during first-run setup or later from the panel:

- **Mind (reasoning)** — Anthropic, OpenAI, or Gemini
- **Voice (text-to-speech)** — ElevenLabs or Sarvam AI
- **Ear (speech-to-text)** — Groq or Sarvam AI

Keys are stored locally with platform-appropriate encryption (Windows DPAPI / macOS Keychain / Linux libsecret via Electron's `safeStorage`) — they never leave your machine except in API calls to the relevant provider.

## Optional AWS accounts

KLIP can use Amazon Cognito for in-app sign-in and API Gateway, Lambda, and
DynamoDB to save and restore portable preferences across devices. Configure the
backend, then open **General → Account & preferences**. Local use does not require
an account. See [AWS setup, architecture, and tests](docs/aws-backend.md).

## License

MIT — see [LICENSE](LICENSE).

The original Clicky project is the intellectual seed for this work; KLIP is an independent implementation and does not bundle or redistribute Clicky's source. If you like what's here, please also star [Farza's repo](https://github.com/farzaa/clicky).
