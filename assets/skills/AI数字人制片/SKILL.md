---
name: AI数字人制片
description: |
  AI video production pipeline. No API-based script generation — script text is written manually by the AI assistant and presented to the user for selection in the chat window. Only after user confirmation does the pipeline proceed to voice synthesis, video rendering, and FFmpeg post-processing.
  ⚠️ Cost control: HeyGen v3 creates exactly ONE video request per run. No duplicate requests are allowed.
  🔐 API Health Check: Before any synthesis runs, the script verifies both Fish Audio and HeyGen platform connectivity. If either fails, the pipeline aborts immediately with clear error guidance.
  Use cases:
  1. User says "make a video about X", "generate a talking-head video", "create short video content"
  2. Generate talking-head videos with realistic voice and subtitles from text
  3. Choose different digital human styles based on emotional tone
  4. Any request involving video production, talking-head, short video, content generation
  Supports: Manual script (AI writes) + Fish Audio for voice synthesis + HeyGen v3 for video rendering + FFmpeg for local audio replacement and subtitle burning.
---

# AI Video Producer v3.2

Manual Script → [API Health Check] → Fish Audio Voice → [API Health Check] → HeyGen v3 Video → FFmpeg Audio Replacement + Subtitles → Final Delivery

## ⚡ Core Rules (Must Follow)

### Rule 0: API Health Check (NEW in v3.2)

**Before any API call, the script validates platform connectivity with a lightweight test.**

```
Fish Audio: Sends a 1-char TTS request, expects audio response (HTTP 200 + >100 bytes)
HeyGen:    Calls GET /v1/user/me, expects {"code":100} (zero cost, no quota charge)
```

**If either check fails, the pipeline ABORTS immediately** and displays:
- Which platform failed
- Suggested fixes (API key, proxy, platform status)
- User must resolve before retrying

### Rule 1: Manual Script — No Kimi API Calls

**Step 1 script generation is DONE IN THE CHAT by the AI assistant, NOT via any API.**

```
❌ DO NOT: Call Kimi API, use any LLM API, or auto-generate scripts programmatically
✅ DO: Write 2-3 script versions manually + present in chat + user selects one
```

**脚本来源（二选一）：**

**A：AI 手动写稿** — AI 直接创作 2-3 版给用户选
1. AI assistant crafts 2-3 versions of the script based on the user's topic
2. Output script options to the chat window
3. User selects the preferred version
4. Only then proceed to Step 2 (Fish Audio TTS)

**B：承接上游技能输出** — 使用 `Video TSS Faddish Disassemble` 的输出作为底稿
1. 检查是否存在上游分析结果：`{行业}短视频文案_{timestamp}.md` 或 `{行业}口播拍摄脚本_{timestamp}.md`
2. 从中选择最合适的脚本作为底稿
3. 向用户确认："这里用的是之前分析的爆款文案脚本，需要调整吗？"
4. 用户确认后直接进 Step 2

> **上下游衔接示意图：**
> ```
> Vecspa Search Financial Videos  →  搜素材（第1步）
>   → Video to Subtitle Summary   →  转字幕/识别（第2步）
>     → Video TSS Faddish Disassemble →  出文案+脚本（第3步）
>       → AI Video Producer       →  数字人视频（第4步） ← 你在这里
>         → Smart Social Publisher → 多平台发布（第5步）
> ```

### Rule 2: HeyGen — Exactly ONE Request

**HeyGen v3 generates EXACTLY ONE video per run. Absolutely no duplicate requests.**

```
❌ DO NOT: Re-run the whole pipeline if something fails
         (this creates wasted HeyGen requests → costs money)
✅ DO: Use -ScriptText parameter, run once, handle errors in post-processing
```

**If HeyGen fails:**
- Report the error to the user in chat
- Do NOT re-submit to HeyGen automatically
- Ask user for instructions before retrying

## Workflow (4 steps)

```
Step 1: [AI Manual]              -> AI writes scripts in chat → user selects
Step 2: Fish Audio TTS (proxy)    -> Synthesize realistic voice audio
Step 3: HeyGen v3 (proxy)         -> ONE text-to-digital-human video request
Step 4: FFmpeg                    -> Replace audio track + Whisper subtitles + burn
```

## Prerequisites

### 1. API Keys (.env file)

```
FISH_AUDIO_API_KEY=xxx                           # Voice synthesis, needs proxy
FISH_AUDIO_VOICE_ID=59cb5986671546eaa6ca8ae6f29f6d22  # Default voice ID
HEYGEN_API_KEY=sk_V2_xxx                         # Video synthesis, needs proxy
```

Get keys at:
- Fish Audio: https://fish.audio/
- HeyGen: https://app.heygen.com/settings/api-keys

### 2. Avatar ID mapping (references/avatar-config.md)

| Style | Scene | Avatar ID |
|-------|-------|-----------|
| 商务/专业 | 商务 | e05b205f092c410cb36c59baf70d1216 |
| 休闲/亲和 | 居家 | 72be2f9094a54b50ac71e1a9d8069a4c |
| 科技/炫酷 | 科技 | 8d57dc38ef344538ae7fe069d0f6a876 |

### 3. Local tools

```bash
ffmpeg     # Audio track replacement + subtitle burning
whisper    # ASR subtitle generation (pip install openai-whisper)
python     # Fish Audio SDK (pip install requests)
```

### 4. Proxy configuration

Fish Audio and HeyGen require proxy access. Use `-ProxyUrl` parameter:

```powershell
.\generate_video.ps1 -ProxyUrl "http://127.0.0.1:7897"
```

## Detailed Flow

### Step 1: Manual Script Writing (AI in Chat — NO API)

The AI assistant writes 2-3 script versions in the chat window. No Kimi or any other API is called.

**脚本来源（二选一）：**

**A：AI 手动创作** — 直接根据用户话题写 2-3 版

**B：承接上游（Video TSS Faddish Disassemble）** — 使用已生成的行业文案作为底稿：
1. 检查桌面是否存在 `{行业}短视频文案_{timestamp}.md` 或 `{行业}口播拍摄脚本_{timestamp}.md`
2. 若有，从中选取最合适的脚本提交用户确认
3. 用户确认后直接进 Step 2

**Guidelines for writing scripts:**
- Target ~200 Chinese characters for ~55s video (adjust based on user's duration request)
- Chinese language only
- Conversational, easy to speak aloud
- Match the user's requested style (Professional / Casual / Marketing)
- Use sentence-ending punctuation (。！？) to control rhythm

**Output format in chat:**
```
**版本 A — [Title]**（[Tone description], ~Xs）
> [Script text]

**版本 B — [Title]**（[Tone description], ~Xs）
> [Script text]

**版本 C — [Title]**（[Tone description], ~Xs）
> [Script text]
```

**After user selection:**
- Copy the selected script text
- Pass it as `-ScriptText` parameter to `generate_video.ps1`

### Step 2: Fish Audio Voice Synthesis (Proxy)

Uses Fish Audio `s2-pro` model to generate realistic voice audio. Supports specific voice ID via `reference_id` parameter. Auto-retries up to 2 times on proxy instability.

**API**: `api.fish.audio/v1/tts` (through proxy)
**Request**:
```json
POST /v1/tts
Headers: { Authorization, model: "s2-pro" }
Body: { text: "...", format: "mp3", reference_id: "..." }
```
**Parameter**: `-VoiceId` (specific Fish Audio voice ID)

### Step 3: HeyGen v3 Video Rendering (ONE Request Only — Proxy)

Uses HeyGen v3 `video-agents` API to generate digital human talking-head video from text. Supports specific avatar ID.

**⚠️ Cost Critical: This step creates EXACTLY ONE request per run.**

**API**: `api.heygen.com/v3/video-agents` (through proxy)
**Flow**:
1. POST with prompt + avatar_id -> get `video_id`
2. Poll `v1/video_status.get` (every 10s, max 60 times)
3. Download completed video

**Error handling (no auto-retry):**
```
If HeyGen POST fails → Return error to user, ask before retrying
If HeyGen render fails → Return error to user, ask before retrying
If HeyGen timeout → Check status manually via API, report to user
```

### Step 4: FFmpeg Post-Processing

1. **Audio track replacement**: Replace HeyGen original audio with Fish Audio voice
   ```bash
   ffmpeg -i video.mp4 -i audio.mp3 -c:v copy -map 0:v:0 -map 1:a:0 -shortest output.mp4
   ```

#### Step 4b: Subtitle generation

Two approaches, Whisper first:

**Approach 1: Whisper ASR (preferred)**
```powershell
whisper $Audio --language zh --output_format srt --output_dir $tempDir
```
Post-process: removes all punctuation from subtitle text.

**Approach 2: Basic SRT (fallback when Whisper unavailable)**
- Splits script only on sentence-ending punctuation (。！？) — keeps clauses within a sentence together
- Removes all Chinese punctuation from displayed text（，。！？；：、．）
- Uses `ffprobe` to get exact audio duration
- Distributes time proportionally by character count per sentence
- Each complete sentence = one subtitle entry (no splitting)

**Example**:
```
Input:  "今天，是一个明媚阳光的天气。这个天气非常适合出去玩。"
Output:
  1
  00:00:00,000 --> 00:00:02,500
  今天是一个明媚阳光的天气

  2
  00:00:02,500 --> 00:00:04,800
  这个天气非常适合出去玩
```

#### Step 4c: Subtitle burning (FFmpeg)
```powershell
# On Windows, use filename= syntax + original_size to avoid colon parsing issues
ffmpeg -i input.mp4 -vf "subtitles=filename=C\:/path/to/subs.srt:original_size=720x1280:force_style='FontName=Microsoft YaHei,FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Alignment=2'" -c:a copy output.mp4
```

## File Structure

```
ai-video-producer/
├── .env                          # API key configuration (no KIMI_API_KEY)
├── .env.example                  # Environment variable template
├── .gitignore                    # Git ignore rules
├── SKILL.md                      # This file - skill documentation
├── references/
│   └── avatar-config.md          # Avatar ID mapping table
├── scripts/
│   ├── generate_video.ps1        # Main workflow script (v3.2 — with API health check)
│   ├── fish_audio_tts.py         # Fish Audio voice synthesis (Python)
│   └── subtitle_generator.py     # Subtitle generation with stable-ts
└── temp/                         # Runtime temp files (auto-generated)
```

## Usage

```powershell
# Standard mode (recommended) — pass confirmed script text
.\generate_video.ps1 -ScriptText "做助贷的看过来..." -ProxyUrl "http://127.0.0.1:7897" -VoiceId "bc5b778cb5814661b20e74133b2528de" -AvatarId "8d57dc38ef344538ae7fe069d0f6a876"
```

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `-ScriptText` | "" | **Required.** The script text (user-confirmed from chat) |
| `-ProxyUrl` | "" | Proxy URL (e.g. http://127.0.0.1:7897) |
| `-VoiceId` | "" | Fish Audio voice ID (from .env FISH_AUDIO_VOICE_ID if empty) |
| `-AvatarId` | "" | HeyGen avatar ID (defaults to Study/Marketing if empty) |

## Technical Details

### API Routing

| Service | Route | Proxy Required |
|---------|-------|---------------|
| Fish Audio | Via proxy | Yes |
| HeyGen | Via proxy | Yes |

### Proxy Compatibility
- Supported via `-ProxyUrl` parameter
- Fish Audio Python script passes proxy via `requests.proxies` parameter
- HeyGen curl calls use `-x` proxy flag

### Error Tolerance

| Scenario | Handling |
|----------|----------|
| Fish Audio proxy disconnect | Auto-retry 2 times max |
| **HeyGen request failure** | **Do NOT retry. Report to user.** Ask before next attempt |
| HeyGen render failure | Report error details, user decides next action |
| FFmpeg missing | Check dependencies, prompt installation |
| stable-ts not installed | Fall back to basic SRT generation |

### Implementation Details

- **Step 1**: Done in chat by AI — NO script calls to any API
- **Step 2**: Python script accepts `--voice-id` for `reference_id`, `--proxy` for proxy URL, `-k` for API key
- **Step 3**: Uses `curl.exe` via PowerShell for reliable proxy support; JSON body written via `ConvertTo-Json`; **only 1 POST request**
- **Step 4**: SRT file copied to short path to avoid Windows colon escaping issues in FFmpeg 8.0; explicit `original_size=720x1280` required

## Dependencies

```bash
# FFmpeg
# Windows: choco install ffmpeg or download from 官网
# macOS: brew install ffmpeg
# Linux: sudo apt install ffmpeg

# Stable-ts (replaces openai-whisper for better subtitle timing)
pip install stable-ts

# Python requests (for Fish Audio)
pip install requests

# Proxy (required for Fish Audio and HeyGen)
# Supports any HTTP proxy (e.g. Clash/V2Ray), default port 7897
```

## Changelog

### v3.2.1 (2026-05-10)
- **FIX**: Fish Audio TTS — replaced raw `requests.post` with `requests.Session` + retry adapter
- **FIX**: Step 4 (FFmpeg) now gracefully handles any failure by using original HeyGen video — NEVER re-requests HeyGen
- **FIX**: All ffmpeg calls use `--loglevel error` + `try/catch` to prevent version info output from interrupting the pipeline
- **FIX**: Fresh session per retry attempt to avoid stale proxy connections
- **FIX**: Increased connect timeout to 10s, backoff delay 2s/4s between attempts
- **FIX**: health_check.py uses same retry session pattern for Fish Audio

### v3.2.0 (2026-05-10)
- **NEW**: API Health Check at startup — validates Fish Audio + HeyGen connectivity before any work
- **NEW**: Clear abort message when either platform is unreachable, with suggested fixes
- **NEW**: Subtitle engine replaced with stable-ts (stable-whisper) for accurate timing and sentence-aware breaks
- **NEW**: `max_chars=15` per subtitle line — ideal for 720×1280 vertical video
- **FIX**: Avatar config updated: 商务/专业 (商务, e05b2...), 休闲/亲和 (居家, 72be2...), 科技/炫酷 (科技, 8d57d...)
- **FIX**: Fish Audio Voice ID updated to bc5b778cb5814661b20e74133b2528de

### v3.1.0 (2026-04-30)
- **BREAKING**: Removed all Kimi API integration from Step 1
- **NEW**: Step 1 is now manual script writing by the AI in the chat window
- **NEW**: AI writes 2-3 script versions → user selects → run pipeline
- **NEW**: `-ScriptText` parameter is now the only way to provide script content
- **FIX**: HeyGen v3 now creates EXACTLY ONE request per run (cost control)
- **FIX**: HeyGen errors are reported to user — no automatic retry
- **FIX**: Removed `-Topic`, `-Style`, `-Duration`, `-SkipEdit` parameters (no longer needed)
- **FIX**: FFmpeg 8.0 subtitle filter uses `filename=` + `original_size` syntax for Windows path compatibility
- **CLEANUP**: Removed KimiAPI function, edit flow, interactive menu from script
- **COST**: Saved ~$4 per video by eliminating HeyGen duplicate requests

### v3.0.0 (2026-04-29)
- Initial release with Kimi API, Fish Audio, HeyGen v3, FFmpeg
