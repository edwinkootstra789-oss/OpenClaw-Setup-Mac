---
name: 视频字幕摘要
description: Use when user provides a short video platform URL (Douyin, Xiaohongshu, Bilibili, etc.) or a local video/audio file path and wants to extract subtitles and generate AI summary. Triggers on URLs like v.douyin.com, xhslink.com, xiaohongshu.com, bilibili.com, b23.tv, share links, or local file paths ending in .mp4/.mp3/.wav etc.
args: <video_url_or_file_path> - 视频链接（抖音/小红书/B站等）或本地视频/音频文件路径（必需）
---

# 视频转字幕与AI总结技能 — Workflow 2.0

> **去 TikHub API 依赖**（去 API 化），采用 **Playwright 纯浏览器自动化 + 开源下载器** 的本地提取方案，以对抗平台动态签名与反爬风控。

## Overview

将短视频平台（抖音、小红书、B站等）视频或本地视频/音频文件转换为字幕文本并生成AI摘要。

**核心流程变更 (Workflow 2.0)：**
- ❌ **移除** TikHub API 依赖（删除 token、API 调用）
- ✅ **新增** Playwright (Chromium) 浏览器自动化抓取视频直链
- ✅ **保留** Whisper 本地语音识别、FFmpeg 音频提取
- ✅ **保留** yt-dlp 用于 B 站下载

**架构总览：**

```
输入 (URL / 本地文件)
    │
    ├─ 本地文件 → FFmpeg提音频 → Whisper → 字幕 → AI总结
    │
    ├─ 抖音 ─→ Playwright 监听网络响应拦截video/mp4直链 → 下载 → FFmpeg → Whisper → ...
    │
    ├─ 小红书 → Playwright 解析<video>标签/SSR状态/监听XHR → 下载 → FFmpeg → Whisper → ...
    │
    └─ B站 ──→ yt-dlp 直接下载 → FFmpeg → Whisper → ...
```

---

## 外部依赖

| 依赖 | 用途 | 必需 |
|------|------|:----:|
| **Playwright** | 浏览器自动化抓取抖音/小红书视频直链 | ✅ |
| **openai-whisper** | 本地语音识别（`pip install openai-whisper`） | ✅ |
| **FFmpeg** | 视频 → 音频提取 | ✅ |
| **yt-dlp** | B 站视频下载（`pip install yt-dlp`） | ⚠️ 仅B站 |
| **aria2** | 多线程加速下载（可选） | 可选 |

### 依赖安装

```bash
# 核心依赖
pip install playwright openai-whisper

# Playwright 浏览器内核（Chromium）
playwright install chromium

# B站支持（可选）
pip install yt-dlp

# FFmpeg
# Windows: 下载 exe 放 PATH 或 choco install ffmpeg
# macOS: brew install ffmpeg
# Linux: sudo apt install ffmpeg
```

---

## 视频处理器(video_processor.py)

本技能的核心脚本为 `video_processor.py`，封装了全部处理逻辑。

### 命令行使用

```bash
# 检查环境（推荐先跑）
python video_processor.py --env-check

# 处理抖音视频
python video_processor.py "https://www.douyin.com/video/7628905409675414822"

# 处理小红书视频
python video_processor.py "https://www.xiaohongshu.com/explore/xxxxxxxx"

# 处理B站视频
python video_processor.py "https://www.bilibili.com/video/BV1xx411c7mD/"

# 处理本地视频文件
python video_processor.py "/path/to/video.mp4"

# 处理本地音频文件（跳过FFmpeg提取）
python video_processor.py "/path/to/audio.mp3"

# 指定Whisper模型（默认tiny，可选base/small/medium/large）
python video_processor.py "https://v.douyin.com/xxxx/" --model base

# 调整Playwright超时（毫秒）
python video_processor.py "https://..." --timeout 60000
```

---

## Workflow 2.0 详细流程

### Step 0: 路由判断

| 输入类型 | 示例 | 处理路径 |
|---------|------|---------|
| **抖音URL** | `douyin.com`, `v.douyin.com` | → Playwright 抓包 → 下载 → 提音频 → 识别 |
| **小红书URL** | `xiaohongshu.com`, `xhslink.com` | → Playwright 提取直链 → 下载 → ... |
| **B站URL** | `bilibili.com`, `b23.tv` | → yt-dlp 下载 → ... |
| **本地视频** | `.mp4`, `.mov`, `.avi` 等 | → FFmpeg 提音频 → 识别 |
| **本地音频** | `.mp3`, `.wav`, `.m4a` 等 | → 直接 Whisper 识别 |

### Step 0.5: 环境自检

前置检查以下依赖是否就绪：
- `ffmpeg`（系统 PATH）
- `openai-whisper`（Python 包）
- `playwright`（Python 包 + Chromium 内核）
- `yt-dlp`（仅 B 站需要，缺失时跳过 B 站处理但不禁用其他平台）
- `requests`（Python 包）

任何一项缺失 → 输出清晰提示并停止。

### Step 1 & 2: 按平台分发下载 — 优先获取视频，降级到字幕提取

**核心原则：视频直链提取 → 下载 → Whisper 识别（首选）。**
**若视频获取失败，降级尝试从页面提取现有字幕/文本（不需要下载视频）。**

#### 降级流程图

```
打开视频页
    ↓
[首选] 提取视频直链 → 下载 → FFmpeg → Whisper → 字幕
    ↓（失败时）
[降级A] 提取页面字幕文本
    ├─ 抖音：提取 page 自动生成字幕 / SSR 文本
    ├─ 小红书：提取视频字幕 DOM
    ├─ B站：字幕 API / yt-dlp --write-subs
    └─ 所有平台：提取描述+评论作为补充文本
    ↓
[降级B] 仅提取描述/简介/评论（最差兜底）
```

#### 分支 A: 抖音 & 小红书（Playwright 浏览器自动化）

**抖音抓取策略（已验证通过）：**

```
打开抖音视频详情页 (浏览器)      ← 已有登录态
    ↓
使用 fetch() 调用抖音内部 API（方法A）：
  fetch('https://www.douyin.com/aweme/v1/web/aweme/detail/?
    aweme_id={VIDEO_ID}', { credentials: 'include' })
    ↓
解析响应，提取 video.play_addr.url_list[0] 作为视频直链
    ↓
使用 curl / Python requests 下载 → 保存为 video.mp4
    ↓
[失败时] 降级到字幕提取（方法B）：
    └─ API 响应中可能包含 subtitle 字段
    └─ 页面 DOM 中提取字幕元素
    └─ 提取标题 + 描述作为最差兜底
```

> **注意：** 不推荐使用 Playwright page.on('response') 方式（OpenClaw browser 工具无此接口）。
> 改用浏览器内部 fetch API（能携带用户登录 cookies），无需额外鉴权。
> 抖音 API 返回的 CDN 直链（douyinvod.com）可直接用外部工具下载。
> 若直链下载失败，从页面 DOM 提取字幕文本作为降级方案。

**小红书抓取策略（三级递进 + 字幕降级）：**

```
启动 Playwright (Headless Chromium)
    ↓
打开小红书笔记/视频页 (page.goto)
    ↓
[A] DOM 解析 <video> 标签的 src 属性（主方案）
    ├─ document.querySelector('video source, video')
    └─ 或 Shadow DOM 中的 video 元素
    │
    └── 失败时:
        ↓
[B] 监听 sns-video 相关 XHR 响应（备选）
    └─ 过滤: sns-video + xhscdn.com + .mp4
        │
        └── 失败时:
            ↓
[C] 从 __INITIAL_STATE__ SSR 提取（兜底）
    └─ window.__INITIAL_STATE__.note
        │
        └── 全部失败时:
            ↓
[D] 提取视频字幕降级
    ├─ 从 __INITIAL_STATE__ 提取 note.desc / title
    ├─ 从 DOM 提取字幕/说明文字
    └─ 提取评论区高赞文本
    ↓
获取直链后 → 关闭 Browser → 下载 → 保存为 video.mp4
```

**B站抓取策略（字幕提取增强）：**

```
yt-dlp 下载视频（主方案）
    ↓
[失败时] 降级到字幕提取：
    └─ yt-dlp --write-subs --sub-langs all --skip-download（仅下载字幕文件）
    └─ 或通过 bilibili API 获取字幕 JSON
        接口: https://api.bilibili.com/x/web-interface/view?bvid={BVID}
        字幕: https://api.bilibili.com/x/player/v2?cid={CID}&bvid={BVID}
```

#### 分支 B: B 站（yt-dlp）

```
直接调用 yt-dlp（不使用 Playwright）
    ↓
yt-dlp best[ext=mp4] → 下载 → video.mp4
```

### Step 3: 音频提取（FFmpeg）

```bash
ffmpeg -i video.mp4 -q:a 0 -map a audio.mp3
```

- 音频文件输入 → 跳过此步
- 超时：300 秒

### Step 4: 语音识别（Whisper）

```bash
whisper audio.mp3 --model tiny --language Chinese
```

**模型建议：**

| 模型 | 大小 | 速度 | 使用场景 |
|------|:----:|:----:|---------|
| `tiny` | 72MB | ⚡最快 | 🏆 默认推荐 |
| `base` | 151MB | 快 | 准确率稍高时 |
| `small` | 487MB | 中等 | 重要内容 |
| `medium` | 1.5GB | 慢 | 专业场景 |

**输出文件：**
- `text.txt` — 纯文本
- `subtitle.srt` — SRT 字幕（带时间戳）

### Step 5-7: AI 总结（由 AI 完成）

无论字幕来源（Whisper 识别 / 网页提取 / 描述降级），AI 统一生成：

读取 `text.txt` 的字幕文本后，AI 直接生成：

1. **标题**（≤30字）
2. **摘要**（200-300字）
3. **核心要点**（结构化列表）

---

## 输出格式

```markdown
## 视频分析结果

### 视频信息
| 项目 | 内容 |
|------|------|
| 输入 | xxx |
| 平台 | 抖音/小红书/B站/本地 |
| 时长 | xxx |

### AI生成标题
xxx

### AI摘要
xxx

### 核心要点
1. xxx
2. xxx

### 生成文件
- 视频: /tmp/video_analysis/{id}/video.mp4
- 音频: /tmp/video_analysis/{id}/audio.mp3
- SRT字幕: /tmp/video_analysis/{id}/subtitle.srt
- 纯文本: /tmp/video_analysis/{id}/text.txt
```

---

## AI 调用方式

**推荐工作流：AI 执行 Python 脚本 → 读取输出 → 生成 AI 总结**

```
1. AI 接收用户输入（URL 或文件路径）
2. AI 调用 `python video_processor.py <input>`
3. 脚本处理完成，生成字幕文件
4. AI 读取 text.txt → 生成标题、摘要、要点
5. AI 输出结构化报告
```

**备用方案（手动模式）：**
如果 AI 无法直接执行脚本，可引导用户：

```bash
python video_processor.py "https://..." --model tiny
# 然后将 text.txt 内容发给 AI 生成总结
```

---

## 异常处理

| 场景 | 处理方式 |
|------|---------|
| Playwright 未安装 | 提示 `pip install playwright && playwright install chromium` |
| 抖音抓包超时 | 捕获超时异常，尝试 yt-dlp 兜底 |
| 抖音/小红书视频直链获取失败 | **降级：提取页面字幕/描述文本** |
| 小红书 DOM 无 video | 递进到网络监听 / SSR 方案 |
| B 站 yt-dlp 失败 | 降级：字幕 API / yt-dlp --write-subs |
| Whisper 模型下载慢 | 首次使用 tiny 模型（72MB），之后自动缓存 |
| FFmpeg 找不到 | 提示安装 FFmpeg |
| 所有平台都失败 | 输出详细错误信息，指导用户手动提供字幕文件 |

### 字幕提取降级策略详解

#### 抖音页面字幕提取
当视频获取失败时，通过浏览器从页面提取字幕文本：

```javascript
// 1. 从页面提取字幕元素
const subtitles = document.querySelectorAll('[class*="caption"], [class*="subtitle"], [class*="subtitle-below"], ' +
  '[class*="video-caption"], [class*="caption-content"]');

// 2. 从 SSR 数据提取 subtitle 字段
const detail = await fetch(
  'https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=' + vid,
  { credentials: 'include' }
).then(r => r.json());
if (detail.aweme_detail?.subtitle) {
  // subtitle 对象可能包含下载 URL 或文本
}

// 3. 最差兜底：提取标题和描述
const title = document.querySelector('h1')?.textContent;
const desc = document.querySelector('[class*="desc"]')?.textContent;
```

#### 小红书页面字幕提取
```javascript
// 从 SSR 状态提取笔记描述
const state = window.__INITIAL_STATE__;
// note.noteDetailMap 中的 note.desc 包含完整文本
// 部分视频笔记有手动添加的字幕
```

#### B站字幕 API
```python
# 使用 B站 API 获取字幕
import requests

# 先获取视频基本信息
info = requests.get(f'https://api.bilibili.com/x/web-interface/view?bvid={bvid}').json()
cid = info['data']['cid']

# 获取字幕列表
subs = requests.get(f'https://api.bilibili.com/x/player/v2?cid={cid}&bvid={bvid}').json()
for sub in subs['data'].get('subtitle', {}).get('subtitles', []):
    subtitle_url = sub['subtitle_url']
    if subtitle_url.startswith('//'):
        subtitle_url = 'https:' + subtitle_url
    content = requests.get(subtitle_url).json()
    # content.body 包含字幕片段
    text = '\n'.join([item['content'] for item in content['body']])
```

---

## 文件结构

```
video-to-subtitle-summary-skill-main/
├── SKILL.md              # 技能说明文档（本文）
├── video_processor.py    # 核心处理脚本 (Workflow 2.0)
└── .env                  # 清空（不再需要 TikHub Token）
```

---

## Changelog

### v2.0.0 (2026-05-27)
- ❌ **移除 TikHub API 依赖**：删除所有 TikHub API 调用
- ✅ **新增 Playwright 浏览器自动化**：抖音/小红书视频直链抓取
- ✅ **抖音策略**：`page.on('response')` 拦截 `video/mp4` 及 CDN 响应
- ✅ **小红书策略**：DOM 解析 `<video>` → XHR 监听 → SSR 三级递进
- ✅ **B 站策略**：yt-dlp 独立下载（不受影响）
- ✅ **环境自检**：前置检查所有依赖，缺失即提示
- ✅ **统一 CLI**：`video_processor.py` 一条命令完成全流程
- ✅ 删除文档目录和旧 README

### v1.x (历史版本)
- 基于 TikHub API 下载（已归档）
