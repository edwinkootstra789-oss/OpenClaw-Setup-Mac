#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Video to Subtitle Summary — Workflow 2.0
==========================================
纯浏览器自动化（Playwright） + 开源下载器 的视频转字幕与AI总结工具。

依赖:
  - playwright (pip install playwright && playwright install chromium)
  - openai-whisper (pip install openai-whisper)
  - ffmpeg (系统 PATH 中可用)
  - yt-dlp (pip install yt-dlp, 仅B站需要)
  - aria2 (可选, 加速下载)
"""

import os
import re
import sys
import json
import time
import shutil
import logging
import argparse
import subprocess
import tempfile
from pathlib import Path
from typing import Optional, Dict, List, Tuple
from urllib.parse import urlparse, unquote

# ── 日志设置 ──────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("v2s")

# ── 常量 ────────────────────────────────────────────────────
WORK_DIR = Path(tempfile.gettempdir()) / "video_analysis"
DOUYIN_DOMAINS = ("douyin.com", "v.douyin.com", "tiktok.com")
XHS_DOMAINS = ("xiaohongshu.com", "xhslink.com")
BILIBILI_DOMAINS = ("bilibili.com", "b23.tv")

# ── 环境检查 ──────────────────────────────────────────────

def check_environment() -> List[str]:
    """检查运行环境是否就绪，返回缺失项列表"""
    missing = []

    # FFmpeg
    if shutil.which("ffmpeg") is None:
        missing.append("ffmpeg")

    # Whisper (Python 包)
    try:
        import whisper
        log.info(f"Whisper OK (v{whisper.__version__ if hasattr(whisper, '__version__') else '?'})")
    except ImportError:
        missing.append("openai-whisper (pip install openai-whisper)")

    # Playwright (Python 包)
    try:
        from playwright.sync_api import sync_playwright
        log.info("Playwright (Python) OK")
    except ImportError:
        missing.append("playwright (pip install playwright)")

    # yt-dlp (可选，仅B站需要)
    try:
        import yt_dlp
        log.info("yt-dlp OK")
    except ImportError:
        log.warning("yt-dlp 未安装 — B站视频将无法处理")
        # 不标记为缺失，因为只有B站需要

    # aria2 (可选)
    if shutil.which("aria2c"):
        log.info("aria2c OK (可选加速)")
    else:
        log.info("aria2c 未安装 — 使用 Python requests 下载 (可选)")

    return missing


# ── 平台识别 ──────────────────────────────────────────────

def detect_platform(url: str) -> str:
    """识别视频平台"""
    parsed = urlparse(url)
    domain = parsed.netloc.lower()

    for dl in DOUYIN_DOMAINS:
        if dl in domain:
            return "douyin"
    for dl in XHS_DOMAINS:
        if dl in domain:
            return "xiaohongshu"
    for dl in BILIBILI_DOMAINS:
        if dl in domain:
            return "bilibili"
    return "unknown"


# ── Playwright 抖音抓取 ──────────────────────────────────

def extract_douyin_url(url: str, timeout_ms: int = 30000) -> Optional[str]:
    """
    使用 Playwright 监听抖音视频页面的网络响应，拦截视频直链。

    策略：
    1. 打开 video/aweme 详情页
    2. 通过 page.on('response') 监听所有响应
    3. 过滤 video/mp4 类型或抖音 CDN (douyinvod.com, p3a.bytecdn.cn 等) 的请求
    4. 返回第一个匹配的真实直链
    """
    from playwright.sync_api import sync_playwright

    video_url = None
    cdn_pattern = re.compile(r'(douyinvod|bytecdn|p[0-9]\.pstatp|snssdk\.com)', re.I)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()

        def on_response(response):
            nonlocal video_url
            if video_url:
                return  # 已找到，忽略后续

            resp_url = response.url
            content_type = response.headers.get("content-type", "").lower()

            # 策略1: content-type 含 video/mp4
            if "video/mp4" in content_type:
                log.info(f"[抖音·抓包] 匹配 content-type=video/mp4 → {resp_url[:120]}")
                video_url = resp_url
                return

            # 策略2: URL 符合抖音 CDN 特征且为视频文件
            if cdn_pattern.search(resp_url) and (resp_url.endswith(".mp4") or ".mp4?" in resp_url):
                log.info(f"[抖音·抓包] 匹配 CDN + .mp4 → {resp_url[:120]}")
                video_url = resp_url
                return

        page.on("response", on_response)

        try:
            log.info(f"[抖音] 打开页面: {url}")
            page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
            # 等待页面充分渲染（SPA 加载 + 视频请求触发）
            time.sleep(5)
            # 尝试滚动触发懒加载
            page.evaluate("window.scrollTo(0, 500)")
            time.sleep(2)
            page.evaluate("window.scrollTo(0, 0)")
            time.sleep(1)

            # 额外等待响应
            wait_start = time.time()
            while video_url is None and (time.time() - wait_start) < 10:
                time.sleep(0.5)

        except Exception as e:
            log.warning(f"[抖音] 页面加载异常: {e}")

        finally:
            browser.close()

    return video_url


def extract_xiaohongshu_url(url: str, timeout_ms: int = 30000) -> Optional[str]:
    """
    使用 Playwright 提取小红书视频直链。

    策略：
    A（主方案）: 解析 DOM 中的 <video> 标签的 src 属性
    B（备选）  : 监听 sns-video 相关 XHR 响应
    C（兜底）  : 尝试从 window.__INITIAL_STATE__ 中提取
    """
    from playwright.sync_api import sync_playwright

    video_url = None

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()

        # 备选B: 监听网络响应
        def on_response(response):
            nonlocal video_url
            if video_url:
                return
            resp_url = response.url
            # 小红书视频 CDN
            if "sns-video" in resp_url and ("xhscdn.com" in resp_url or "xiaohongshu.com" in resp_url):
                if resp_url.endswith(".mp4") or ".mp4?" in resp_url or "video" in resp_url:
                    log.info(f"[小红书·抓包] 匹配 sns-video → {resp_url[:120]}")
                    video_url = resp_url

        page.on("response", on_response)

        try:
            log.info(f"[小红书] 打开页面: {url}")
            page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
            time.sleep(5)

            # 主方案A: 解析 <video> 标签
            if video_url is None:
                try:
                    src = page.evaluate("""
                        () => {
                            const v = document.querySelector('video source, video');
                            if (v) return v.src || v.getAttribute('src');
                            // 尝试 shadow DOM
                            const el = document.querySelector('div[class*="video"] video');
                            return el ? (el.src || el.getAttribute('src')) : null;
                        }
                    """)
                    if src and src.startswith("http"):
                        log.info(f"[小红书·DOM] 从 <video> 标签提取直链 ✓")
                        video_url = src
                except Exception as e:
                    log.warning(f"[小红书·DOM] <video> 标签解析失败: {e}")

            # 备选C: 从 SSR 状态提取
            if video_url is None:
                try:
                    state_data = page.evaluate("""
                        () => {
                            try {
                                const s = window.__INITIAL_STATE__;
                                if (s && s.note) {
                                    const note = s.note.noteDetailMap || s.note;
                                    const val = Object.values(note)[0];
                                    if (val && val.note && val.note.video) {
                                        return JSON.stringify(val.note.video);
                                    }
                                }
                            } catch(e) {}
                            return null;
                        }
                    """)
                    if state_data:
                        log.info(f"[小红书·SSR] 尝试从 __INITIAL_STATE__ 提取直链")
                        # 这里只是日志，识别工作留给 evaluate 或外部
                except Exception as e:
                    log.warning(f"[小红书·SSR] SSR 提取失败: {e}")

            # 额外等待网络响应
            wait_start = time.time()
            while video_url is None and (time.time() - wait_start) < 8:
                time.sleep(0.5)

        except Exception as e:
            log.warning(f"[小红书] 页面加载异常: {e}")

        finally:
            browser.close()

    return video_url


# ── B站下载 ──────────────────────────────────────────────

def download_bilibili(url: str, output_dir: Path) -> Optional[Path]:
    """使用 yt-dlp 下载 B 站视频"""
    import yt_dlp

    output_path = output_dir / "video.mp4"
    ydl_opts = {
        "format": "best[ext=mp4]/best",
        "outtmpl": str(output_path),
        "quiet": True,
        "no_warnings": True,
    }

    try:
        log.info(f"[B站] yt-dlp 开始下载: {url}")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        if output_path.exists() and output_path.stat().st_size > 0:
            log.info(f"[B站] 下载完成: {output_path}")
            return output_path
        else:
            log.error("[B站] 下载失败：文件为空")
            return None
    except Exception as e:
        log.error(f"[B站] yt-dlp 下载异常: {e}")
        return None


# ── 字幕提取降级方案 ──────────────────────────────────
# 当视频下载失败时，尝试从页面直接提取字幕/文本

def extract_douyin_subtitle(detail_data: dict, page_text: str = "") -> Optional[str]:
    """
    从抖音 API 响应或页面文本中提取字幕。
    
    策略：
    1. API 响应 subtitle 字段（如果有）
    2. 页面中的字幕 DOM 文本
    3. 最差：标题 + 描述
    """
    texts = []

    # 策略1: 检查 API 中的 subtitle 字段
    try:
        subtitle = detail_data.get("aweme_detail", {}).get("subtitle", {})
        if subtitle:
            # 某些版本有 subtitle 的 URL 列表
            url_list = subtitle.get("url_list", []) or []
            for url in url_list:
                if url:  # 可以进一步下载字幕文件
                    pass
            # 或者 inline 文本
            if subtitle.get("text"):
                texts.append(subtitle["text"])
    except Exception:
        pass

    # 策略2: 从 aweme_detail 提取 rich text 描述
    try:
        desc = detail_data.get("aweme_detail", {}).get("desc", "")
        if desc:
            texts.append(f"[标题]: {desc}")
        # 提取 text_extra 中的标签文本
        text_extra = detail_data.get("aweme_detail", {}).get("text_extra", []) or []
        for te in text_extra:
            if isinstance(te, dict) and te.get("text"):
                texts.append(te["text"])
    except Exception:
        pass

    # 策略3: API 中的 caption 字段
    try:
        caption = detail_data.get("aweme_detail", {}).get("caption", "")
        if caption and caption not in texts:
            texts.append(caption)
    except Exception:
        pass

    # 策略4: 页面 DOM 文本（当有页面文本传入时）
    if page_text and page_text not in texts:
        texts.append(f"[页面文本]: {page_text[:2000]}")

    if texts:
        result = "\n".join(t for t in texts if t)
        log.info(f"[抖音·字幕] 从 API/页面提取到 {len(texts)} 段文本, 共 {len(result)} 字符")
        return result
    return None


def extract_xiaohongshu_subtitle(page, output_dir: Path) -> Optional[str]:
    """
    从小红书页面提取字幕/文本。
    
    策略：
    1. SSR 中的 note.desc 完整描述
    2. 视频字幕 DOM
    3. 标题 + 标签
    """
    texts = []

    try:
        # 策略1: SSR 状态中的描述
        state_data = page.evaluate("""
            () => {
                try {
                    const s = window.__INITIAL_STATE__;
                    if (!s) return JSON.stringify({error: 'no state'});
                    
                    let noteData = null;
                    if (s.note && s.note.noteDetailMap) {
                        const vals = Object.values(s.note.noteDetailMap);
                        if (vals.length > 0) noteData = vals[0].note;
                    } else if (s.note && s.note.currentNoteId) {
                        noteData = s.note[s.note.currentNoteId];
                    }
                    
                    if (!noteData) return JSON.stringify({error: 'no noteData'});
                    
                    const result = {};
                    if (noteData.desc) result.desc = noteData.desc;
                    if (noteData.title) result.title = noteData.title;
                    if (noteData.tagList) result.tags = noteData.tagList.map(t => t.name || t.text || '').filter(Boolean);
                    if (noteData.subtitle) result.subtitle = noteData.subtitle;
                    if (noteData.video && noteData.video.subtitle) result.videoSubtitle = noteData.video.subtitle;
                    
                    return JSON.stringify(result);
                } catch(e) { return JSON.stringify({error: e.message}); }
            }
        """)

        if state_data:
            parsed = json.loads(state_data)
            if parsed.get("desc"):
                texts.append(parsed["desc"])
            if parsed.get("title"):
                texts.append(parsed["title"])
            if parsed.get("videoSubtitle"):
                texts.append(parsed["videoSubtitle"])
            if parsed.get("subtitle"):
                texts.append(parsed["subtitle"])
            if parsed.get("tags"):
                texts.extend(parsed["tags"])
    except Exception as e:
        log.warning(f"[小红书·字幕] SSR 提取失败: {e}")

    # 策略2: DOM 字幕元素
    if not texts:
        try:
            caption_text = page.evaluate("""
                () => {
                    const els = document.querySelectorAll('[class*="caption"], [class*="subtitle-content"], [class*="video-caption"]');
                    return Array.from(els).map(e => e.textContent).filter(Boolean).join('\n').substring(0, 5000);
                }
            """)
            if caption_text and len(caption_text) > 20:
                texts.append(caption_text)
        except Exception:
            pass

    # 策略3: 提取页面可见文本（最后的兜底）
    if not texts:
        try:
            visible_text = page.evaluate("""
                () => {
                    const note = document.querySelector('[class*="note"]') || 
                                 document.querySelector('main') || 
                                 document.querySelector('article');
                    if (note) return note.textContent.substring(0, 3000);
                    return document.body?.textContent?.substring(0, 1000) || '';
                }
            """)
            if visible_text:
                texts.append(f"[页面文本]: {visible_text[:2000]}")
        except Exception:
            pass

    if texts:
        result = "\n".join(t for t in texts if t)
        # 保存到文件
        text_path = output_dir / "text.txt"
        with open(text_path, "w", encoding="utf-8") as f:
            f.write(result)
        log.info(f"[小红书·字幕] 从页面提取到 {len(texts)} 段文本, 共 {len(result)} 字符 → {text_path}")
        return result
    return None


def extract_bilibili_subtitle(bvid: str, output_dir: Path) -> Optional[str]:
    """
    使用 B站 API 提取视频字幕。
    """
    import requests

    try:
        # 1. 获取视频基本信息
        log.info(f"[B站·字幕] 获取视频信息: {bvid}")
        info = requests.get(f"https://api.bilibili.com/x/web-interface/view?bvid={bvid}",
                             headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
        if info.status_code != 200:
            log.warning(f"[B站·字幕] API 返回 {info.status_code}")
            return None

        data = info.json()
        if data.get("code") != 0:
            log.warning(f"[B站·字幕] API 错误: {data.get('message')}")
            return None

        cid = data["data"]["cid"]
        title = data["data"]["title"]
        desc = data["data"].get("desc", "")

        # 2. 获取字幕列表
        subs = requests.get(f"https://api.bilibili.com/x/player/v2?cid={cid}&bvid={bvid}",
                            headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
        if subs.status_code != 200:
            log.warning(f"[B站·字幕] 字幕 API 返回 {subs.status_code}")
            # 退回到标题+描述
            result = f"[标题]: {title}\n[描述]: {desc}"
            text_path = output_dir / "text.txt"
            with open(text_path, "w", encoding="utf-8") as f:
                f.write(result)
            log.info(f"[B站·字幕] 仅提取到标题+描述 (无字幕API)")
            return result

        sub_data = subs.json()
        if sub_data.get("code") != 0:
            return None

        # 3. 遍历字幕列表
        subtitle_list = sub_data["data"].get("subtitle", {}).get("subtitles", [])
        texts = [f"[标题]: {title}"]
        if desc:
            texts.append(f"[描述]: {desc}")

        for sub in subtitle_list:
            sub_url = sub.get("subtitle_url", "")
            lang = sub.get("lan_doc", "unknown")
            if sub_url:
                if sub_url.startswith("//"):
                    sub_url = "https:" + sub_url
                try:
                    sub_content = requests.get(sub_url, timeout=10).json()
                    if "body" in sub_content:
                        lines = [item.get("content", "") for item in sub_content["body"]]
                        texts.append(f"\n[{lang}字幕]:")
                        texts.append("\n".join(lines))
                        log.info(f"[B站·字幕] 提取到 {lang} 字幕: {len(lines)} 条")
                except Exception as e:
                    log.warning(f"[B站·字幕] 下载字幕文件失败: {e}")

        if len(texts) > 1:
            result = "\n".join(texts)
            text_path = output_dir / "text.txt"
            with open(text_path, "w", encoding="utf-8") as f:
                f.write(result)
            log.info(f"[B站·字幕] 完成! 共 {len(result)} 字符 → {text_path}")
            return result

    except Exception as e:
        log.warning(f"[B站·字幕] 异常: {e}")

    return None


# ── 通用下载 ──────────────────────────────────────────────

def download_video(direct_url: str, output_dir: Path) -> Optional[Path]:
    """使用 Python requests 下载视频文件"""
    import requests

    output_path = output_dir / "video.mp4"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/125.0.0.0 Safari/537.36"
        ),
        "Referer": "https://www.douyin.com/",
    }

    try:
        log.info(f"[下载] 开始下载视频...")
        resp = requests.get(direct_url, headers=headers, stream=True, timeout=60)
        resp.raise_for_status()

        total = int(resp.headers.get("content-length", 0))
        downloaded = 0
        chunk_size = 8192

        with open(output_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=chunk_size):
                f.write(chunk)
                downloaded += len(chunk)
                if total > 0:
                    pct = downloaded / total * 100
                    if int(pct) % 25 == 0 and int(pct) > 0:
                        log.info(f"[下载] 进度: {pct:.0f}%")

        if output_path.exists() and output_path.stat().st_size > 0:
            log.info(f"[下载] 完成: {output_path} ({output_path.stat().st_size / 1024 / 1024:.1f} MB)")
            return output_path
        else:
            log.error("[下载] 失败：文件为空")
            return None

    except Exception as e:
        log.error(f"[下载] 异常: {e}")
        return None


# ── 音频提取 ──────────────────────────────────────────────

def extract_audio(video_path: Path, output_dir: Path) -> Optional[Path]:
    """使用 FFmpeg 提取音频"""
    audio_path = output_dir / "audio.mp3"

    cmd = [
        "ffmpeg", "-y",
        "-i", str(video_path),
        "-q:a", "0",
        "-map", "a",
        str(audio_path),
    ]

    log.info(f"[音频] 提取音频...")
    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=300)
        if audio_path.exists() and audio_path.stat().st_size > 0:
            log.info(f"[音频] 完成: {audio_path}")
            return audio_path
        else:
            log.error("[音频] 提取失败：文件为空")
            return None
    except subprocess.CalledProcessError as e:
        log.error(f"[音频] FFmpeg 错误: {e.stderr.decode('utf-8', errors='replace')[:200]}")
        return None
    except subprocess.TimeoutExpired:
        log.error("[音频] FFmpeg 超时")
        return None


# ── 语音识别 ──────────────────────────────────────────────

def transcribe_audio(audio_path: Path, output_dir: Path, model_name: str = "tiny") -> Optional[str]:
    """使用 Whisper 进行语音识别"""
    import whisper

    log.info(f"[Whisper] 加载模型: {model_name}")
    try:
        model = whisper.load_model(model_name)

        log.info(f"[Whisper] 开始识别: {audio_path}")
        result = model.transcribe(str(audio_path), language="zh")

        text = result.get("text", "").strip()
        segments = result.get("segments", [])

        # 保存纯文本
        text_path = output_dir / "text.txt"
        with open(text_path, "w", encoding="utf-8") as f:
            f.write(text)
        log.info(f"[Whisper] 纯文本已保存: {text_path} ({len(text)} 字符)")

        # 保存 SRT 字幕
        srt_path = output_dir / "subtitle.srt"
        with open(srt_path, "w", encoding="utf-8") as f:
            for i, seg in enumerate(segments, 1):
                f.write(f"{i}\n")
                f.write(f"{_fmt_srt_time(seg['start'])} --> {_fmt_srt_time(seg['end'])}\n")
                f.write(f"{seg['text'].strip()}\n\n")
        log.info(f"[Whisper] SRT 字幕已保存: {srt_path} ({len(segments)} 条)")

        return text

    except Exception as e:
        log.error(f"[Whisper] 识别异常: {e}")
        return None


def _fmt_srt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds - int(seconds)) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


# ── 本地文件处理 ──────────────────────────────────────────

def is_video_file(path: str) -> bool:
    return any(path.lower().endswith(ext) for ext in (".mp4", ".mov", ".avi", ".mkv", ".webm", ".flv", ".wmv"))

def is_audio_file(path: str) -> bool:
    return any(path.lower().endswith(ext) for ext in (".mp3", ".wav", ".m4a", ".flac", ".aac", ".ogg", ".wma"))


# ── 主流程 ────────────────────────────────────────────────

def process_video(input_path: str, whisper_model: str = "tiny", timeout_ms: int = 30000) -> Dict:
    """
    主处理函数。

    参数:
        input_path: 视频 URL 或本地文件路径
        whisper_model: Whisper 模型名称 (tiny/base/small/medium/large)
        timeout_ms: Playwright 超时（毫秒）

    返回:
        包含处理结果的字典
    """
    result = {
        "success": False,
        "input": input_path,
        "platform": None,
        "video_path": None,
        "audio_path": None,
        "subtitle_path": None,
        "text_path": None,
        "text": None,
        "error": None,
    }

    # 创建输出目录
    job_id = f"video_{int(time.time())}"
    output_dir = WORK_DIR / job_id
    output_dir.mkdir(parents=True, exist_ok=True)

    local_video_path = None

    # ── STEP 0: 判断输入类型 ──────────────────────────────
    is_url = input_path.startswith(("http://", "https://"))
    is_local = not is_url

    if is_local:
        if not os.path.exists(input_path):
            result["error"] = f"本地文件不存在: {input_path}"
            return result
        platform = "local"
        log.info(f"[路由] 本地文件模式: {input_path}")
    else:
        platform = detect_platform(input_path)
        if platform == "unknown":
            result["error"] = f"无法识别的平台: {input_path}"
            return result
        log.info(f"[路由] 在线视频模式 → 平台: {platform}, URL: {input_path[:100]}")

    result["platform"] = platform

    # ── STEP 1 & 2: 获取视频文件 ──────────────────────────
    if is_local:
        # 本地文件：直接使用
        if is_video_file(input_path) or is_audio_file(input_path):
            local_video_path = Path(input_path)
            log.info(f"[本地] 使用本地文件: {local_video_path}")
        else:
            result["error"] = f"不支持的文件格式: {input_path}"
            return result

    elif platform == "douyin":
        log.info(f"[抖音] 启动 Playwright 抓取视频直链...")
        direct_url = extract_douyin_url(input_path, timeout_ms)
        if direct_url:
            log.info(f"[抖音] 视频直链获取成功，开始下载")
            downloaded = download_video(direct_url, output_dir)
            if downloaded:
                local_video_path = downloaded
            else:
                log.warning("[抖音] 下载失败，尝试降级到字幕提取")
        if local_video_path is None:
            # 尝试 yt-dlp 兜底
            log.warning("[抖音] 视频直链获取失败，尝试 yt-dlp 兜底")
            try:
                bili_result = download_bilibili(input_path, output_dir)
                if bili_result:
                    local_video_path = bili_result
            except Exception:
                pass

        # 降级：尝试提取页面字幕
        if local_video_path is None:
            log.info("[抖音] ★ 降级方案: 尝试从页面提取字幕文本")
            try:
                from playwright.sync_api import sync_playwright

                with sync_playwright() as pw:
                    browser = pw.chromium.launch(headless=True)
                    context = browser.new_context(
                        user_agent=(
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                            "AppleWebKit/537.36 (KHTML, like Gecko) "
                            "Chrome/125.0.0.0 Safari/537.36"
                        ),
                    )
                    page = context.new_page()
                    try:
                        page.goto(input_path, wait_until="domcontentloaded", timeout=timeout_ms)
                        time.sleep(5)

                        # 策略A: 从页面字幕元素提取
                        caption_text = page.evaluate("""
                            () => {
                                // 尝试各种可能的字幕/文本元素
                                const selectors = [
                                    '[class*="subtitle-below"]',
                                    '[class*="video-caption"]',
                                    '[class*="caption-content"]',
                                    '[class*="desc-text"]',
                                    '.video-info .desc',
                                    '[class*="detail-desc"]',
                                ];
                                for (const sel of selectors) {
                                    const el = document.querySelector(sel);
                                    if (el && el.textContent.trim().length > 20) {
                                        return el.textContent.trim();
                                    }
                                }
                                // 提取 h1 标题
                                const h1 = document.querySelector('h1');
                                if (h1) return h1.textContent.trim();
                                return '';
                            }
                        """)

                        if caption_text and len(caption_text) > 20:
                            log.info(f"[抖音·字幕] 从 DOM 提取到 {len(caption_text)} 字符")
                            subtitle_result = caption_text
                        else:
                            # 策略B: 通过 fetch API 获取详情（带 cookie）
                            fetch_result = page.evaluate("""
                                async (vid) => {
                                    try {
                                        const r = await fetch(
                                            'https://www.douyin.com/aweme/v1/web/aweme/detail/?' +
                                            'device_platform=webapp&aid=6383&aweme_id=' + vid,
                                            { credentials: 'include' }
                                        );
                                        const d = await r.json();
                                        const ad = d.aweme_detail;
                                        if (!ad) return '';
                                        const parts = [];
                                        if (ad.desc) parts.push('[标题]: ' + ad.desc);
                                        if (ad.caption) parts.push('[字幕]: ' + ad.caption);
                                        return parts.join('\n');
                                    } catch(e) { return ''; }
                                }
                            """, input_path.split('/')[-1].split('?')[0])
                            if fetch_result:
                                subtitle_result = fetch_result
                            else:
                                subtitle_result = None

                        if subtitle_result:
                            text_path = output_dir / "text.txt"
                            with open(text_path, "w", encoding="utf-8") as f:
                                f.write(subtitle_result)
                            log.info(f"[抖音·字幕] 降级完成 → {text_path} ({len(subtitle_result)} 字符)")
                            result["text"] = subtitle_result
                            result["text_path"] = str(text_path)
                            result["subtitle_source"] = "page_extra"
                            # 标记完成，不继续走 FFmpeg + Whisper
                            result["success"] = True
                            return result

                    except Exception as e:
                        log.warning(f"[抖音·字幕] 页面提取异常: {e}")
                    finally:
                        browser.close()
            except ImportError:
                log.warning("[抖音·字幕] Playwright 未安装，无法降级")
            except Exception as e:
                log.warning(f"[抖音·字幕] 降级失败: {e}")

    elif platform == "xiaohongshu":
        log.info(f"[小红书] 启动 Playwright 抓取视频直链...")
        direct_url = extract_xiaohongshu_url(input_path, timeout_ms)
        if direct_url:
            log.info(f"[小红书] 视频直链获取成功，开始下载")
            downloaded = download_video(direct_url, output_dir)
            if downloaded:
                local_video_path = downloaded

        # 降级：尝试提取页面字幕
        if local_video_path is None:
            log.info("[小红书] ★ 降级方案: 尝试从页面提取字幕文本")
            try:
                from playwright.sync_api import sync_playwright

                with sync_playwright() as pw:
                    browser = pw.chromium.launch(headless=True)
                    context = browser.new_context(
                        user_agent=(
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                            "AppleWebKit/537.36 (KHTML, like Gecko) "
                            "Chrome/125.0.0.0 Safari/537.36"
                        ),
                    )
                    page = context.new_page()
                    try:
                        page.goto(input_path, wait_until="domcontentloaded", timeout=timeout_ms)
                        time.sleep(5)

                        sub_text = extract_xiaohongshu_subtitle(page, output_dir)
                        if sub_text:
                            log.info(f"[小红书·字幕] 降级完成 → 共 {len(sub_text)} 字符")
                            result["text"] = sub_text
                            result["text_path"] = str(output_dir / "text.txt")
                            result["subtitle_source"] = "page_extra"
                            result["success"] = True
                            return result

                    except Exception as e:
                        log.warning(f"[小红书·字幕] 页面提取异常: {e}")
                    finally:
                        browser.close()
            except ImportError:
                log.warning("[小红书·字幕] Playwright 未安装，无法降级")
            except Exception as e:
                log.warning(f"[小红书·字幕] 降级失败: {e}")

    elif platform == "bilibili":
        log.info(f"[B站] 调用 yt-dlp 下载...")
        downloaded = download_bilibili(input_path, output_dir)
        if downloaded:
            local_video_path = downloaded

        # 降级：尝试提取字幕（即使下载成功，也可以顺带提取字幕增强内容）
        if local_video_path is None:
            log.info("[B站] ★ 降级方案: 通过 API 提取字幕")
            # 从 URL 提取 BVID
            bvid_match = re.search(r'(BV[a-zA-Z0-9]+)', input_path, re.I)
            if bvid_match:
                bvid = bvid_match.group(1)
                sub_text = extract_bilibili_subtitle(bvid, output_dir)
                if sub_text:
                    log.info(f"[B站·字幕] 降级完成 → 共 {len(sub_text)} 字符")
                    result["text"] = sub_text
                    result["text_path"] = str(output_dir / "text.txt")
                    result["subtitle_source"] = "api_subtitle"
                    result["success"] = True
                    return result

    # 检查是否成功获取视频
    if local_video_path is None:
        # 检查是否已经有字幕提取结果（降级方案已处理）
        if result.get("subtitle_source"):
            return result
        result["error"] = "视频获取失败且字幕降级也未能提取到有效文本"
        return result

    result["video_path"] = str(local_video_path)

    # ── STEP 3: 提取音频 ──────────────────────────────────
    if is_audio_file(str(local_video_path)):
        # 已经是音频文件，跳过提取
        audio_path = local_video_path
        log.info(f"[音频] 输入已是音频文件，跳过提取: {audio_path}")
    else:
        audio_path = extract_audio(local_video_path, output_dir)
        if audio_path is None:
            result["error"] = "音频提取失败"
            return result

    result["audio_path"] = str(audio_path)

    # ── STEP 4: 语音识别 ──────────────────────────────────
    text = transcribe_audio(audio_path, output_dir, whisper_model)
    if text is None:
        result["error"] = "语音识别失败"
        return result

    result["text"] = text
    result["text_path"] = str(output_dir / "text.txt")
    result["subtitle_path"] = str(output_dir / "subtitle.srt")
    result["subtitle_source"] = "whisper" if local_video_path else result.get("subtitle_source", "whisper")
    result["success"] = True

    source_tag = "Whisper 识别" if result["subtitle_source"] == "whisper" else "页面字幕提取"
    log.info(f"[完成] 处理成功！来源: {source_tag} | 字幕: {result['text_path']}")
    return result


# ── CLI 入口 ──────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Video to Subtitle Summary — 视频转字幕与AI总结 (Workflow 2.0)"
    )
    parser.add_argument("input", help="视频 URL 或本地文件路径")
    parser.add_argument("--model", default="tiny", choices=["tiny", "base", "small", "medium", "large"],
                        help="Whisper 模型 (默认: tiny)")
    parser.add_argument("--timeout", type=int, default=30000, help="Playwright 超时毫秒 (默认: 30000)")
    parser.add_argument("--env-check", action="store_true", help="仅检查环境，不执行处理")

    args = parser.parse_args()

    # 环境检查
    print("=" * 60)
    print("  Video to Subtitle Summary — Workflow 2.0")
    print("=" * 60)

    if args.env_check:
        print("\n[环境检查]")
        missing = check_environment()
        if missing:
            print(f"\n❌ 缺失依赖:")
            for m in missing:
                print(f"   - {m}")
            sys.exit(1)
        else:
            print("\n✅ 所有必需依赖就绪")
            sys.exit(0)

    missing = check_environment()
    if missing:
        print(f"\n❌ 环境检查失败，缺失依赖:")
        for m in missing:
            print(f"   - {m}")
        print("请先安装所需依赖后再运行。")
        sys.exit(1)

    # 执行处理
    print(f"\n处理中: {args.input}\n")
    result = process_video(args.input, args.model, args.timeout)

    print("\n" + "=" * 60)
    if result["success"]:
        print("  ✅ 处理成功")
        print(f"     字幕:  {result['text_path']}")
        print(f"     SRT:   {result['subtitle_path']}")
        print(f"     文本:  {result['text'][:100]}..." if result["text"] and len(result["text"]) > 100
              else f"     文本:  {result['text']}")
    else:
        print(f"  ❌ 处理失败: {result['error']}")
    print("=" * 60)


if __name__ == "__main__":
    main()
