---
name: 智能社媒分发
description: 短视频智能跨平台分发技能。使用 OpenClaw browser 工具在抖音、小红书、视频号三个平台自动完成视频上传和文案发布。触发场景：(1) 用户生成了短视频文件并需要发布到社媒平台；(2) 需要为视频生成各平台专属文案并自动上传；(3) 需要跨平台的内容矩阵分发。包含完整的防风控处理、登录失效熔断、操作节奏控制。
---

# Smart Social Publisher - 智能社媒分发

## 核心工具约束

本技能使用 OpenClaw 的 `browser` 工具。以下规则基于 2026-05-06 / 2026-05-15 两次实际测试验证。

### 🎯 targetId 规则
标签打开后返回 `targetId`（UUID 格式）、`suggestedTargetId`（label）和 `tabId`。
- **优先使用完整的 UUID targetId**（测试表明兼容性最好）
- 若 label 报错 `targetId must match request targetId`，立即改用 UUID targetId
- snapshot 和所有 act 调用必须使用完全相同的 targetId

### 📸 snapshot → act 循环
- 用 `{ action:"snapshot", targetId:"xxx", refs:"aria" }` 获取可交互元素 ref
- 每次页面导航、弹窗后必须**重新 snapshot**（ref 会完全失效）
- 用 `{ action:"act", targetId:"xxx", kind:"click", ref:"eXX" }` 操作元素

### 🔮 Shadow DOM 元素处理（小红书专用）
小红书新版发布页将"发布"和"暂存离开"按钮渲染在自定义元素 `<xhs-publish-btn>` 的 **Shadow DOM** 中。
aria snapshot 无法捕获这些按钮，必须通过 JavaScript 访问其 Shadow Root：

```javascript
// 获取自定义元素的 Shadow Root（存在 _sr 而非 shadowRoot 属性）
const btn = document.querySelector('xhs-publish-btn');
const sr = btn._sr;  // nodeType=11 (DOCUMENT_FRAGMENT_NODE)

// 在 Shadow DOM 中找到发布按钮
const publishBtn = Array.from(sr.querySelectorAll('button'))
  .find(b => b.textContent.trim() === '发布');
```

**发布按钮触发方式**：点击按钮会 dispatch `CustomEvent("publish", {bubbles: true, composed: true})`，
可直接在元素上触发：
```javascript
btn.dispatchEvent(new CustomEvent('publish', {bubbles: true, composed: true}));
```

**重要属性**：
- `btn._onPublish` — 发布回调函数（等同于 dispatch publish 事件）
- `btn._onSave` — 存草稿回调
- `btn._props` — 组件属性：`isPublish`, `isSaveDraft`, `submitText`, `saveText`, `submitDisabled`, `saveDisabled`
- `btn._app` — Vue 3 应用实例
- `btn._sr` — Shadow Root 引用

**注意**：该自定义元素是一个 **Vue Custom Element**，实际渲染通过 Vue 的 Shadow DOM 模式。
程序化 `.click()` 可能被平台的防风控机制拦截；优先使用获取 shadow DOM 内按钮引用后
dispatch 原生事件序列（pointerdown → pointerup → click）的方式模拟真人点击。

### 📁 文件上传规范
文件必须先复制到 `%TEMP%\openclaw\uploads\` 目录下，然后用相对路径通过 upload API 上传：
```json
{ "action": "upload", "targetId": "xxx", "selector": "input[type=\"file\"]", "paths": ["output_final.mp4"] }
```
**注意：upload API 在不同标签页/不同 session 间可能不保持一致行为。** 若 upload API 返回 ok 但 `input.files` 仍为空，需要使用 CDP 方式（详见各平台具体流程）。

### 📝 React/Vue 受控输入框处理
简单的 `type`/`fill` 可能不触发框架的受控组件。使用 evaluate 注入值并手动触发事件：

**对于 `<input>` / `<textarea>`（React 或 Vue）：**
```javascript
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
setter.call(input, '内容');
input.dispatchEvent(new Event('input', { bubbles: true }));
input.dispatchEvent(new Event('change', { bubbles: true }));
```

**对于 `[contenteditable="true"]` 富文本编辑器（抖音、小红书均使用）：**
```javascript
const editor = document.querySelector('[contenteditable="true"]');
editor.focus();
document.execCommand('selectAll', false);
document.execCommand('delete', false);
document.execCommand('insertText', false, '正文内容 #标签1 #标签2');
```

### ⏱ 操作节奏
- 平台切换间等待 60 秒
- 文件上传后等待 8-15 秒让平台处理
- 发布点击后等待 5-10 秒验证结果

---

## Browser 工具调用参考速查

| 操作 | 调用方式 |
|------|---------|
| 打开页面 | `{ action:"open", url:"https://...", label:"tag" }` |
| 快照 | `{ action:"snapshot", targetId:"tag/UID", refs:"aria" }` |
| 点击 ref | `{ action:"act", targetId:"tag/UID", kind:"click", ref:"eXX" }` |
| 执行 JS | `{ action:"act", targetId:"tag/UID", kind:"evaluate", fn:"() => {...}" }` |
| 上传文件 | `{ action:"upload", targetId:"tag/UID", selector:"input[type=\"file\"]", paths:["file.mp4"] }` |
| 关闭标签 | `{ action:"close", targetId:"tag/UID" }` |
| CDP 设文件 | 编写 Node.js 脚本通过 WebSocket 调用 `DOM.setFileInputFiles`（见小红书流程） |

---

## 标准工作流 (SOP)

### Step 0: 文件预处理

```powershell
Copy-Item "源文件路径" "$env:TEMP\openclaw\uploads\output_final.mp4"
```

### Step 1: 智能物料生成

生成三套平台专属文案，展示给用户确认后进入 Step 2：

- **[抖音文案]**：30字以内悬念标题 + 正文 + 4个热门标签（含 `#AI`）
- **[小红书文案]**：Emoji 开头 + 分段干货笔记（笔记体风格）
- **[视频号文案]**：沉稳专业风格 + 结尾引导互动

---

### Step 2: 驱动 Browser 进行拟人化发布

#### 准备工作
`browser({ action: "status" })` 确认浏览器可用。

---

#### 👉 任务一：抖音 — 已验证 2/2 次成功

##### 1️⃣ 打开并检查
```json
{ "action": "open", "url": "https://creator.douyin.com/creator-micro/content/upload", "label": "douyin" }
```
等待 3-5 秒。快照检查：
- **弹窗处理**：若有"我知道了"、"关闭"、"X"等弹窗 → 先点击关闭
- **登录熔断**：若有"扫码登录"、"二维码"字样 → 停止，跳过该平台
- 若无异常 → 继续

##### 2️⃣ 上传视频

**方法（已验证成功）：**
- 快照中通常有 `button "Choose File" [ref=eXX]` 或 `button "上传视频" [ref=eXX]`
- 直接用 upload API：
  ```json
  { "action": "upload", "targetId": "douyin_UID", "selector": "input[type=\"file\"]", "paths": ["output_final.mp4"] }
  ```
- 等待 8-12 秒
- 再次 snapshot，检查 URL 是否跳转为 `/content/post/video`
- 若未跳转 → 等待 5 秒后再检查
- 或者先点击上传区域（`{ kind:"click", ref:"eXX" }`），URL 跳转后继续

**验证成功标志**：URL 从 `/content/upload` → `/content/post/video`，页面中出现 `textbox "填写作品标题..."`、`添加作品简介`、`button "发布"`

##### 3️⃣ 填入抖音文案

**标题**（30字限制）- 使用 evaluate 设置 React input：
```javascript
const inp = document.querySelector('input[placeholder*="填写作品标题"]');
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
setter.call(inp, '助贷逼单十句封神话术🔥');
inp.dispatchEvent(new Event('input', { bubbles: true }));
inp.dispatchEvent(new Event('change', { bubbles: true }));
```

**正文 + 标签** - 使用 contenteditable 注入：
```javascript
const editor = document.querySelector('[contenteditable="true"]');
editor.focus();
document.execCommand('selectAll', false);
document.execCommand('delete', false);
document.execCommand('insertText', false, '正文内容\n\n#标签1 #标签2');
```

**验证**：snapshot → 预览区应显示完整文案（`"标题 正文 #标签..."`）

##### 4️⃣ 发布
```json
{ "action": "act", "targetId": "douyin_UID", "kind": "click", "ref": 发布按钮的ref }
```
等待 5-8 秒。snapshot 检查：
- ✅ 页面跳转到**作品管理**页面（URL 含 `/content/manage` 或出现"作品管理"字样、"共 N 个作品"）→ **发布成功**
- 若弹出满意度调查，说明已发布

##### 5️⃣ 关闭标签页
```json
{ "action": "close", "targetId": "douyin_UID" }
```

---

#### 👉 任务二：小红书 — 已验证 2026-05-15（CDP+Shadow DOM 方案）

> **架构说明**：小红书新版发布页使用 **QianKun 微前端 + Vue 3 (v3.5.16)** 架构。
> 发布按钮渲染在 `<xhs-publish-btn>` 自定义元素的 **Shadow DOM** 中，
> aria snapshot 无法捕获，需要通过 JS 操作 Shadow Root。

##### 1️⃣ 等待 60 秒，打开页面
```json
{ "action": "open", "url": "https://creator.xiaohongshu.com/publish/publish", "label": "xiaohongshu" }
```
等待 3-5 秒，snapshot 检查登录熔断。

##### 2️⃣ 上传视频（使用 CDP 方案，upload API 不可靠）

**前置准备**：将以下脚本保存为 `cdp_upload.js`（替换 TARGET_UID 为当前标签页 targetId）：

```javascript
const WebSocket = require('ws');
const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/TARGET_UID');
const filePath = 'C:\\Users\\USERNAME\\AppData\\Local\\Temp\\openclaw\\uploads\\output_final.mp4';
ws.on('open', () => ws.send(JSON.stringify({id:1, method:'DOM.getDocument'})));
ws.on('message', (data) => {
  const m = JSON.parse(data.toString());
  if (m.id === 1) ws.send(JSON.stringify({id:2, method:'DOM.querySelector',
    params:{nodeId:m.result.root.nodeId, selector:'input[type="file"]'}}));
  else if (m.id === 2 && m.result.nodeId) ws.send(JSON.stringify({id:3,
    method:'DOM.setFileInputFiles', params:{nodeId:m.result.nodeId, files:[filePath]}}));
  else if (m.id === 3) { console.log('CDP OK'); ws.close(); }
});
setTimeout(() => process.exit(0), 5000);
```

**执行上传**：
```powershell
node cdp_upload.js
```

**触发 Vue change 事件**：
```javascript
// 通过 evaluate 执行
document.querySelector('input.upload-input')
  .dispatchEvent(new Event('change', { bubbles: true }));
```

等待 8-15 秒后 snapshot 验证：
- ✅ `textbox "填写标题会有更多赞哦" [ref=eXX]` — 标题输入框出现
- ✅ `textbox [ref=eXX]` — 正文编辑器出现
- ❌ `"上传失败"` 或 `"检测到视频文件无视频流信息"` → 重试 CDP

**注意**：出现"视频分辨率较低，建议上传1080P及以上"是**警告而非错误**，不影响。

##### 3️⃣ 填入小红书文案

**标题：**
```javascript
const inp = document.querySelector('input[placeholder*="填写标题"]');
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
setter.call(inp, '标题内容🔥');
inp.dispatchEvent(new Event('input', { bubbles: true }));
inp.dispatchEvent(new Event('change', { bubbles: true }));
```

**正文**（使用 contenteditable 注入）：
```javascript
const editor = document.querySelector('[contenteditable="true"]');
editor.focus();
document.execCommand('selectAll', false);
document.execCommand('delete', false);
document.execCommand('insertText', false, '🌟🔥 Emoji开头\n\n分段内容...');
```

##### 4️⃣ 发布（通过 Shadow DOM 操作）

**方式 A — 调用回调函数（推荐优先尝试）：**
```javascript
const btn = document.querySelector('xhs-publish-btn');
btn._onPublish();  // dispatch CustomEvent('publish', {bubbles:true, composed:true})
```

**方式 B — 直接触发自定义事件：**
```javascript
const btn = document.querySelector('xhs-publish-btn');
btn.dispatchEvent(new CustomEvent('publish', {bubbles: true, composed: true}));
```

**方式 C — 访问 Shadow Root 内按钮并点击（模拟真人操作）：**
```javascript
const btn = document.querySelector('xhs-publish-btn');
const sr = btn._sr;  // nodeType=11 (DOCUMENT_FRAGMENT)
const publishBtn = Array.from(sr.querySelectorAll('button'))
  .find(b => b.textContent.trim() === '发布');
publishBtn.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
publishBtn.dispatchEvent(new PointerEvent('pointerup', {bubbles: true}));
publishBtn.dispatchEvent(new MouseEvent('click', {bubbles: true, composed: true}));
```

等待 10-15 秒。

**验证发布结果**：
- ✅ URL 变化为 `?published=true` 或页面回到上传首页 → **发布成功**
- ✅ 侧边栏"笔记管理"出现新笔记
- ❌ 页面无变化 → 可能被防风控拦截，告知用户手动点击

##### 5️⃣ 关闭标签页

---

#### 👉 任务三：视频号助手（未测试，流程为预设）

1. 等待 60 秒
2. 打开 `https://channels.weixin.qq.com/platform/post/create`
3. 登录熔断：若出现大面积二维码 → 跳过
4. 上传视频：参考抖音流程
5. 填入文案：定位编辑区，type/slowly 填入
6. 发表：寻找"发表"按钮
7. 关闭标签页

---

### Step 3: 任务收尾与报表

```markdown
## 📊 社媒分发报告

| 平台 | 状态 | 详情 |
|------|------|------|
| 🎵 抖音 | ✅ 已发布 | 作品管理页已验证 |
| 📕 小红书 | ✅ 已发布 / ⚠️ 需手动 / ✅ 已填文案 | URL published=true 确认 / Shadow DOM 发布可能被防爬拦截 |
| 📺 视频号 | ⏭ 跳过 / ❌ 失败 | 原因说明 |

**文案预览：**
- **抖音**: [标题]
- **小红书**: [前20字]...
- **视频号**: [前20字]...
```

---

## ⚠️ 防风控与异常处理

### 文件上传 — 已验证的方法

| 方法 | 适用平台 | 可靠性 |
|------|---------|--------|
| upload API | 抖音 | ✅ 稳定可靠 |
| CDP `DOM.setFileInputFiles` | 小红书 | ✅ 推荐作为主要方案（upload API 不可靠） |
| upload API | 小红书 | ⚠️ 不推荐，常出现 `ok=true` 但文件未实际设置的情况 |

### CDP 上传脚本模板（用于小红书 — 推荐方案）

保存以下内容为 `cdp_upload.js`，替换 TARGET_UID 后执行 `node cdp_upload.js`：

```javascript
const WebSocket = require('ws');
const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/TARGET_UID');
const filePath = 'C:\\Users\\USERNAME\\AppData\\Local\\Temp\\openclaw\\uploads\\output_final.mp4';
ws.on('open', () => ws.send(JSON.stringify({id:1, method:'DOM.getDocument'})));
ws.on('message', (data) => {
  const m = JSON.parse(data.toString());
  if (m.id === 1) ws.send(JSON.stringify({id:2, method:'DOM.querySelector',
    params:{nodeId:m.result.root.nodeId, selector:'input[type="file"]'}}));
  else if (m.id === 2 && m.result.nodeId) ws.send(JSON.stringify({id:3,
    method:'DOM.setFileInputFiles', params:{nodeId:m.result.nodeId, files:[filePath]}}));
  else if (m.id === 3) { console.log('CDP OK'); ws.close(); }
});
setTimeout(() => process.exit(0), 5000);
```

CDP 完成后执行 evaluate 手动触发 change 事件：
```javascript
document.querySelector('input.upload-input')
  .dispatchEvent(new Event('change', { bubbles: true }));
```

### targetId 兼容处理
- 使用 label 报错 → 切换为 UUID targetId
- 所有 snapshot 和 act 调用使用完全相同的 targetId

### Ref 失效恢复
1. 重新 snapshot → 获取新 ref
2. 用新 ref 重试操作
3. 若元素确实不在 DOM 中，根据页面实际状态调整流程

### React/Vue 输入处理总结
- `input[type="text"]`：用 evaluate + setter + dispatch
- `input[type="file"]`：用 upload API / CDP
- `[contenteditable="true"]`：用 execCommand('insertText')
- 注意：单纯 `type`/`fill` 可能不触发受控组件

### 登录熔断
每进入新平台页面，检查快照中是否含："扫码登录"、"二维码"、"请先登录"、"密码输入"、"验证码"。发现即停止该平台。

### 文件上传失败兜底
1. 抖音：upload API 通常可靠，若失败尝试先 click 上传区域再 upload
2. 小红书：upload API → CDP → 用户手动拖拽上传
3. 告知用户：打开页面，AI 已填好文案，只需拖拽视频到上传区域

---

## 资源文件

### references/
`platform-guide.md` — 各平台页面 DOM 结构参考。
