# 平台发布页面参考指南

本文档记录各平台创作者中心的页面结构和常见元素特征，帮助 browser 工具快照定位目标元素。

## 抖音创作者中心

### 上传页面 URL
`https://creator.douyin.com/creator-micro/content/upload`

### 常见页面元素
- **上传区域**: 页面中央大面积的"上传视频"虚线框区域，或"选择文件"按钮。
- **作品简介输入框**: 在视频上传后出现，一般位于视频预览下方，占位文字类似"输入作品描述..."。
- **标签/话题**: 输入框附近有"添加话题"、"#参与挑战"等区域。
- **封面设置**: 可选操作，可跳过。
- **发布按钮**: 页面底部或右下角的"发布"按钮。

### 常见弹窗
- **新功能引导**: 可能弹出半透明蒙层+引导气泡，描述新功能。气泡角落或底部有"我知道了"、"X"、"跳过"按钮。
- **系统公告**: 弹出式 Modal 窗口，有"关闭"或"X"按钮。
- **实名/验证提示**: 若账号未完成实名，可能出现"去实名"弹窗。
- **内容限制**: 若视频敏感，可能提示"内容不适宜发布"，需标记为"不适合公开"。

### 注意事项
- 上传后页面会显示上传进度条（类名 `upload-card-IBCFN_`、`uploading-container-kBnKYA`），需要等待进度完成（100%）才能进行后续操作。
- 上传成功后的标志：URL 从 `/content/upload` 跳转到 `/content/post/video`。进入编辑页后可以看到标题输入框、正文编辑器、封面设置、发布按钮等元素。
- 若长时间未上传完成，可能是文件过大或网络问题，需要报告用户。
- 上传后页面上会出现**发文助手**区域，内含快速检测（检测中xx%）、横/竖双封面缺失提示等，这些不影响发布。
- 发布成功后页面自动跳转到**作品管理**页面（URL 含 `/content/manage` 或侧边栏

## 小红书创作者中心

### 发布页面 URL
`https://creator.xiaohongshu.com/publish/publish`

### 🏗 页面架构（2026-05 新版）
- 使用 **QianKun 微前端** 架构，主框架加载微应用
- 微应用容器为 `<div id="creator-publish-dom">`，内部渲染 Vue 3 组件
- Vue 版本: **3.5.16**
- 全局对象: `window._publisher`（含 uploader、media、lifeCycle 等模块）
- 页面通过 `__vue_app__` 管理组件树

### 常见页面元素
- **上传标签页**: 页面顶部有"上传视频"、"上传图文"、"写长文"、"发播客"四个选项
- **标题输入框**: 单行输入框，占位文字"填写标题会有更多赞哦"
- **正文编辑区**: 富文本编辑器（TipTap 编辑器），占位文字"输入正文描述，真诚有价值的分享予人温暖"
- **上传视频区域**: `input.upload-input`，通过拖拽/点击触发
- **封面选择**: 可选操作，支持智能推荐封面
- **发布按钮**: 渲染为自定义元素 `<xhs-publish-btn>`，位于 `.publish-page-content` 底部
- **预览面板**: `.publish-page-preview`，可切换"笔记预览"和"封面预览"

### 🔮 Shadow DOM 发布按钮
- 自定义元素: `<xhs-publish-btn is-publish="true" is-save-draft="true">`
- Shadow Root 访问: `btn._sr`（非标准 `shadowRoot` 属性，因 Vue CE 实现方式）
- Shadow DOM 内按钮结构:
  ```html
  <style>:host { display: block; position: sticky; bottom: 0; ... }</style>
  <div class="publish-page-publish-btn">
    <button class="ce-btn">暂存离开</button>
    <button class="ce-btn">发布</button>
  </div>
  ```
- 按钮尺寸: 120×40px，圆角 20px
- 触发事件: `CustomEvent('publish', {bubbles: true, composed: true})`

### 重要属性
| 属性路径 | 说明 |
|---------|------|
| `btn._onPublish` | 发布回调函数 |
| `btn._onSave` | 存草稿回调 |
| `btn._props.submitDisabled` | 发布按钮是否禁用 |
| `btn._props.saveDisabled` | 存草稿按钮是否禁用 |
| `btn._app` | Vue 3 应用实例 |

### 注意事项
- 小红书使用 **QianKun 微前端** 加载微应用，部分内容通过异步渲染
- file input 有 CSS 类名 `upload-input`，data-v 属性 `data-v-412f1341`
- **upload API 不可靠**，优先使用 CDP `DOM.setFileInputFiles` 方案上传
- 文件上传后检查 `textbox "填写标题会有更多赞哦"` 是否出现来判断上传是否成功
- "视频分辨率较低，建议上传1080P及以上"是**警告而非错误**，不影响发布
- 若出现 "检测到视频文件无视频流信息" 的错误，说明 fake File 被检测，需手动拖拽
- 标题输入框和正文编辑区在视频上传成功后才会出现
- 正文编辑区使用 TipTap 编辑器（基于 ProseMirror），为 `[contenteditable="true"]` 可编辑区
- 发布按钮在视频上传完成前为 disabled 状态
- 小红书对视频时长有限制（最长 15 分钟/60 分钟视账号类型）
- 敏感词检测较严格，若包含敏感词可能发布失败需报告
- **发布按钮程序化点击可能被防爬机制拦截**，需要组合完整事件（pointerdown→pointerup→click）才可能成功

## 微信视频号助手

### 发布页面 URL
`https://channels.weixin.qq.com/platform/post/create`

### 常见页面元素
- **上传视频区域**: 页面中央的大型虚线区域，有"点击上传"或"拖拽视频到此处"提示。
- **视频信息**: 上传后显示视频缩略图、时长、大小。
- **文案/描述输入框**: 位于视频下方的多行文本输入框，占位文字"请输入视频描述..."。
- **话题标签**: 输入 # 符号可添加话题标签。
- **位置**: 可选标记位置。
- **发表按钮**: 页面底部的"发表"按钮。

### 常见弹窗
- **微信扫码**: 首次访问或 cookie 过期后，可能要求使用微信扫描二维码验证。
- **内容审核提示**: 发表后可能提示"内容正在审核中"。

### 注意事项
- 视频号助手对登录态要求严格，cookie 过期概率较大。若遇到大面积登录页面需果断熔断。
- 视频上传后需要较长的转码处理时间，需要等待完成再操作。
- 视频号对视频尺寸有要求（建议 1080×1920 竖屏）。
- 每次发布有次数限制（每天最多 3 条/7 条视账号认证情况）。

## 通用元素识别策略

当快照无法精确识别目标元素时，使用以下启发式策略：

### 上传按钮识别
- 寻找 text 包含"上传"、"选择文件"、"点击上传"、"Upload"、"Select File"的元素
- 寻找 type="file" 的 input 元素
- 寻找 label 中包含"视频"、"Video"的按钮

### 输入框识别
- 寻找 placeholder 或 aria-label 包含"标题"、"Title"、"描述"、"Description"、"文案"、"正文"、"Content"的输入框
- 寻找 role="textbox" 或 role="combobox" 的元素

### 发布按钮识别
- 寻找 text 包含"发布"、"发表"、"Publish"、"Post"的按钮
- 寻找颜色为红色/蓝色的关键操作按钮
- 寻找 aria-label="发布" 的元素

### 弹窗关闭
- 寻找 text 包含"关闭"、"我知道了"、"X"、"Close"、"Got it"、"Skip"的元素
- 寻找 role="dialog" 内的关闭按钮
