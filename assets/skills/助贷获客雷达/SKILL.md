---
name: 助贷获客雷达
description: Vecspa 金融助贷自动化获客雷达（Auto Client Acquisition Radar for Finance）。接收博主列表，对每个博主依次深度监控，自动浏览最新3条视频的评论区，批量挖掘高意向贷款客户，生成合规高转化破冰私信并自动发送。触发场景：(1) 用户提供一组合对标博主主页链接要求监控；(2) 需要从评论区提取高意向贷款客户；(3) 需要生成合规私信文案。使用 OpenClaw browser 工具执行。
---

# Vecspa-ACARF-Service

## Workflow

### 步骤 1：博主主页巡查与最新内容定位
- 接收用户提供的【博主主页链接列表】
- 依次处理列表中的每一个博主
- 对当前博主：访问其主页，识别 **最新发布的 3 条非置顶视频或图文内容**，提取其独立链接（URL）

### 步骤 2：多视频评论批量抓取
- 依次打开提取到的 **3 个内容链接**
- 对每个视频：向下滚动以加载评论区，提取前 **30 条有效评论**
- 合并 3 个视频的评论，去重（按用户昵称+评论内容去重）
- 提取字段：
  - 来源视频标题
  - 用户昵称
  - 用户主页链接
  - 评论完整内容
  - 评论时间

### 步骤 3：大模型意向清洗（核心过滤）
> ⚠️ 必须严格执行以下过滤规则。

**直接剔除（Reject）：**
- 同行打广告（含 "主页查收"、"看我头像" 等）
- 无意义表情包 / 纯打卡
- 无明确需求的闲聊

**锁定意向（Target）：** 包含以下任意特征：
- 明确需求词：如 "怎么贷"、"什么条件"、"利息多少"
- 资质描述：如 "征信花了"、"逾期能办吗"、"房抵"
- 地域咨询
- 以下关键词：*"我可以办理吗"、"为啥我办不了"、"怎么办"、"有按揭房，有车，有保单，有公司可以贷吗"、"装修贷可以做吗"、"利息多少"、"有手续费吗"、"我也想办"、"能不能办"、"被拒绝了"、"房子抵押，车子抵押"、"有营业执照"、"有公司流水"、"征信好"、"有网贷可以办吗"、"黑户了"、"个人贷可以吗"、"有公积金"、"有社保"*

### 步骤 4：生成定制化私信破冰（30字内）
- 针对锁定的高意向客户，结合其痛点生成专属私信
- 留言话术方向：*"可以办，找我"、"私我"、"免费咨询"、"我办过跟你情况一样的"*
- **⛔ 红线合规（绝对禁止）：** "加微信、V、电话、包过、黑户可做"
- **结构：** `称呼 + 痛点确认 + 抛出价值（如发评估表）`
- **字数：** 严格控制在 30 字以内，口吻自然亲切

### 步骤 5：发送私信（Clipboard + Paste + Enter 方案）

> ⚠️ 抖音网页端私信使用 Draft.js 编辑器，SVG 箭头发送按钮无法通过标准点击触发。必须使用以下方案。

对每个高意向线索，按顺序执行：

#### 5.1 进入用户主页并打开私信面板
- 访问该用户的 Douyin 主页 URL
- 找到页面上文本为"私信"的 `<button>`，使用 `isTrusted: true` 的 MouseEvent 点击：
  ```javascript
  let evt = new MouseEvent('click', { bubbles: true, cancelable: true, view: window, isTrusted: true });
  btn.dispatchEvent(evt);
  ```
- 等待 1.5 秒让面板弹出

#### 5.2 写入剪贴板
- 执行 JavaScript 将私信内容写入系统剪贴板：
  ```javascript
  await navigator.clipboard.writeText('你的私信内容');
  ```

#### 5.3 激活输入框
- 找到页面中的 `div[contenteditable="true"]`（Draft.js 编辑器）
- 调用 `.focus()` 并分派 `isTrusted: true` 的 `click` 事件，让光标闪烁：
  ```javascript
  let div = document.querySelector('[contenteditable]');
  div.focus();
  let clickEvt = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: rect.x + 10, clientY: rect.y + 10, view: window, isTrusted: true });
  div.dispatchEvent(clickEvt);
  ```

#### 5.4 模拟粘贴 (Ctrl+V)
- 使用 OpenClaw 的 `press` 动作发送组合键：
  ```
  browser act kind=press key=Control+v
  ```
- Draft.js 会接管粘贴事件并同步到内部状态

#### 5.5 回车发送 (Enter)
- 确保光标仍在输入框内，使用 OpenClaw 的 `press` 动作：
  ```
  browser act kind=press key=Enter
  ```
- 等待 1 秒后检查私信面板：`[草稿]` 标签消失、出现消息操作按钮（点赞/回复/撤回/删除）即表示发送成功

### 步骤 6：博主循环与汇总输出
- 完成当前博主的所有步骤（1→5）后，回到步骤 1，处理列表中的下一个博主
- 直到【博主主页链接列表】中所有博主都处理完毕
- 停止浏览器
- 输出汇总的最终 JSON 格式报告（包含所有博主的累加数据 + 分博主明细）

## Output Format

```json
{
  "Scan_Report": {
    "Total_Bloggers_Scanned": "博主总数",
    "Total_Videos_Processed": "处理视频总数（博主数×3）",
    "Total_Comments_Processed": "处理的评论总数",
    "Total_High_Intent_Leads": "发现的高意向线索总数",
    "Total_DM_Sent": "成功发送私信数"
  },
  "Per_Blogger_Summary": [
    {
      "Blogger_Name": "博主名称",
      "Blogger_URL": "博主主页链接",
      "Videos_Scanned": "扫描的视频数",
      "Comments_Processed": "处理的评论数",
      "Leads_Found": "发现的线索数",
      "DM_Sent": "发送私信数"
    }
  ],
  "Leads_Data": [
    {
      "Source_Blogger": "线索来源的博主名称",
      "Source_Video": "来源视频标题",
      "Username": "提取的用户昵称",
      "Profile_URL": "用户主页链接",
      "Identified_Pain_Point": "客户核心痛点",
      "Custom_Icebreaker": "生成的专属30字内破冰私信",
      "DM_Status": "已发送/失败/跳过"
    }
  ]
}
```

## Browser Automation Tips
- 使用 OpenClaw `browser` 工具操作
- 多平台兼容：抖音、小红书、快手等
- 若评论区需要点击 "展开" 或 "查看更多" 按钮才能加载，需先展开再抓取
- 遇到登录/验证码等风控时停止并报告当前进度

## 私信发送关键方案

抖音网页端 DM 私信使用 Draft.js 编辑器，发送按钮为 SVG 箭头图标。**标准点击/SVG.click() 无法触发发送**。

**正确发送流程（已验证通过）：**
```
① isTrusted click → 打开私信面板
② navigator.clipboard.writeText() → 写入剪贴板
③ 点击 contenteditable → 聚焦光标
④ Ctrl + V (press) → 粘贴
⑤ Enter (press) → 发送成功
```

注意：`KeyboardEvent` 和 `MouseEvent` 需要通过 JavaScript 构造时设置 `isTrusted: true`，否则 Draft.js 会忽略。OpenClaw 的 `kind=press` 发出的按键事件是系统级别，不在浏览器 JS 沙箱中，Draft.js 可以正确接收。
