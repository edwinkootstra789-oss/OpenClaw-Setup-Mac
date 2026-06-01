---
name: 爆款复刻工坊
description: Browser-based video search for Douyin (抖音) and Xiaohongshu (小红书). Use this skill when searching videos by keyword on these platforms with filtering by most likes and time range (24h/week/month). Also supports full pipeline: search → ASR transcription → DeepSeek rewrite → Excel export. Uses browser automation for accurate data vs. third-party APIs.
---

# Vecspa Video Search — 视频搜索与全自动获客流水线

Browser-based video search for **Douyin (抖音)** and **Xiaohongshu (小红书)**, plus a local **ASR → DeepSeek洗稿 → Excel导出** automation pipeline.

## When to Use

- Search videos by keyword on Douyin or Xiaohongshu
- Filter results by time range (24h / week / month) and sort by most likes
- Get top N results with structured data (likes, title, author, time, URL)
- **Full pipeline**: Automatically extract video transcripts via local ASR, rewrite with DeepSeek, export to Excel

## Overview

TikHub third-party API returns incomplete/inaccurate search data vs. the actual platform. This skill uses **browser automation** to scrape results directly from official websites. The full pipeline adds **local faster-whisper ASR** (zero API cost, fully offline) and **DeepSeek rewriting** for content repurposing.

---

## Pipeline Architecture (4 Phases)

```
Phase 1 (Browser)         Phase 2 (Python exec)       Phase 3 (DeepSeek)      Phase 4 (Python exec)
┌─────────────────┐      ┌─────────────────────────┐ ┌─────────────────┐     ┌───────────────────┐
│ 搜索+过滤 TOP 10  │ ──→ │ 浏览器提取CDN视频直链    │ ──→ │ 逐条洗稿翻新     │ ──→ │ pandas → Excel    │
│ aweme_id/标题   │      │ ffmpeg 提音频 → Whisper  │     │ 200字口播稿     │     │ 爆款复刻库.xlsx   │
│ 点赞数/作者     │      │ 本地离线转写完整台词     │     │ 情绪痛点+留资  │     │                   │
└─────────────────┘      └─────────────────────────┘ └─────────────────┘     └───────────────────┘
    ↓ JSON                  ↓ JSON                       ↓ 对话输出              ↓ .xlsx
    top10_videos.json       asr_result.json               rewrite_table
```

---

## Phase 1: Browser Search & Filter (获取视频列表)

### 1.1 Open Browser Tab

```
{ "action": "open", "url": "about:blank", "label": "search" }
```
Save returned `tabId` (e.g. `t9`).

### 1.2 Select Video Tab

Navigate to search page with video tab:
```
{ "action": "navigate", "targetId": "t9", "url": "https://www.douyin.com/search/{keyword}?type=video" }
```

⚠️ **Important**: Douyin drops unknown URL params — `sort=likes&time=week` do NOT work via URL. They must be applied via the UI filter panel.

### 1.3 Apply Filters via UI Panel

Use `evaluate` with TreeWalker to click filter options:

```javascript
// Step 1: Open filter panel
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
let node;
while (node = walker.nextNode()) {
  if (node.textContent.trim() === '筛选') {
    node.parentElement.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, view: window}));
    break;
  }
}

// Step 2: Click sort/time options
const walker2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
while (node = walker2.nextNode()) {
  const t = node.textContent.trim();
  if (t === '最多点赞' || t === '一周内' || t === '一天内') {
    node.parentElement.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, view: window}));
  }
}

// Step 3: Close panel to apply (click "综合" tab then "视频" tab back)
const walker3 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
while (node = walker3.nextNode()) {
  if (node.textContent.trim() === '综合') {
    node.parentElement.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, view: window}));
    break;
  }
}
```

### 1.4 Extract Results from Snapshot

After filters are applied, take a snapshot:
```
{ "action": "snapshot", "targetId": "t9", "compact": true }
```

Each video card shows as:
```
text: "57 #公积金#公积金买房 @宋行长聊金融 22小时前"
```

Parse pattern: `{likes} {title} #{hashtags} @{author} {time}`

### 1.5 Navigate to Each Video Page for CDN URL

For Phase 2, navigate to each video's page to extract CDN stream URLs:
```
{ "action": "navigate", "targetId": "t9", "url": "https://www.douyin.com/video/{aweme_id}" }
```

Extract CDN URL from the `<video>` element:
```javascript
const video = document.querySelector('video');
const sources = [];
video.querySelectorAll('source').forEach(s => sources.push(s.src));
// First CDN source is usually the best quality
return sources[0];
```

### Xiaohongshu Alternative
```
navigate: https://www.xiaohongshu.com/search_result?keyword={keyword}&source=web_search_result_notes&type=video&sort=likes&time=day
```
Wait 3-5s for SPA rendering. Extract from SSR state:
```
"fn": "() => JSON.stringify(window.__INITIAL_STATE__.search.feeds._rawValue)"
```

---

## Phase 2: Local ASR Pipeline (本地音频转写)

### 2.1 Install Dependencies

```bash
pip install faster-whisper openpyxl pandas
```

ffmpeg must be in PATH:
```
winget install "FFmpeg (Essentials Build)"
```

### 2.2 CDN URL Extraction (替代 yt-dlp)

**⚠️ yt-dlp 在 Windows 上不可用**——Chrome Cookie 数据库被 Windows DPAPI 加密，
`--cookies-from-browser chrome` 会失败。

**替代方案**：直接从浏览器 `video` 元素提取 CDN mp4 直链。

导航到视频详情页后，执行：

```javascript
// 获取视频 CDN 直链
const video = document.querySelector('video');
if (!video) return null;
const sources = video.querySelectorAll('source');
// 返回第一个 CDN URL（通常质量最高、速度最快）
return sources[0] ? sources[0].src : video.src;
```

### 2.3 Manual Single-Video ASR

```
# From extracted CDN URL (Step 1)
ffmpeg -i "{CDN_URL}" -vn -acodec pcm_s16le -ar 16000 -ac 1 -y temp_audio.wav

# (Step 2)
python -c "
from faster_whisper import WhisperModel
model = WhisperModel('base', device='cpu', compute_type='int8')
segments, info = model.transcribe('temp_audio.wav', beam_size=5, language='zh')
print(''.join(s.text for s in segments))
"
```

### 2.4 Expected Performance

实测数据（37秒视频, CPU base模型）:

| Step | Tool | Time | Output |
|------|------|:----:|--------|
| CDN URL提取 | Browser JS | 3s | mp4直链 |
| 音频提取 | ffmpeg | **0.3s** | 1.1MB WAV |
| 语音转写 | faster-whisper base | **29s** | ~190字中文 |
| **总计** | | **~32s/条** | |

For 10 videos: ~5.5 minutes on CPU. Use `small` model for better accuracy (~2x slower).

### 2.5 Automatic Script

The script at `scripts/phase2_asr_pipeline.py` automates the full process when yt-dlp and cookies work. On Windows, use the manual approach above.

---

## Phase 3: DeepSeek Rewriting (智能洗稿)

Paste the transcript from Phase 2 into OpenClaw with this prompt:

```
我现在有一条今日抖音爆款视频的完整真人台词。

【原文】
{transcript_text}

【业务线】推广低息房产抵押贷款（利息低至2.X%，不看负债，征信花可沟通，下款快）

【防AI味】句子短平快，像真人信贷经理大白话。严禁出现：众所周知、在这快节奏的时代、总之、希望对你有所帮助、想象一下、不仅如此

【输出格式】
1. 原爆款框架解析（一句话点破）
2. 翻新口播稿（200字，情绪痛点开头 + 自然留资结尾）
```

---

## Phase 4: Excel Export

```bash
python scripts/phase4_export_excel.py --input rewrite_results.json
```

Output columns:
| 序号 | 作者 | 原点赞量 | 原标题 | 发布时间 | 原真人台词 | 翻新口播稿 | 翻新标题 | 视频链接 | ASR方式 |

---

## Scripts Reference

| Script | Phase | Purpose |
|--------|-------|---------|
| `scripts/phase1_hook_search.js` | 1 | JS fetch hook + extract top videos |
| `scripts/phase2_asr_pipeline.py` | 2 | (yt-dlp approach, Windows-limited) |
| `scripts/phase4_export_excel.py` | 4 | Export rewrite results to .xlsx |

---

## Known Behaviors & Limitations

### Douyin
- **URL params**: `sort=likes&time=week` are **dropped** by Douyin redirect → must use UI filter panel
- **Filter panel**: Use TreeWalker + dispatchEvent to click "筛选" and filter options
- **CDN URLs**: Extract from `<video>` `<source>` elements on the video detail page
- **No pagination**: Phase 1 only extracts first page (~10-30 videos)

### Windows-Specific Issues
- **yt-dlip cookies**: Unusable due to Chrome DPAPI encryption. Use browser JS extraction instead.
- **GBK encoding**: Set `$env:PYTHONIOENCODING='utf-8'` before running Python scripts

### ASR Quality
- **Whisper base** (CPU, 1.3x realtime): ~90-95% accuracy. Fast for batch processing.
- **Whisper small** (CPU, 0.5x realtime): ~95-98% accuracy. Recommended for single video.
- **Common errors**: Domain-specific terms (公积金→供金金) — fix with post-processing regex.

### General
- **Xiaohongshu**: SPA with URL-param based filtering
- **Time filter**: "一天内" is approximate ~24h
- **Rate limit**: Add ~2s delay between sequential video navigations
