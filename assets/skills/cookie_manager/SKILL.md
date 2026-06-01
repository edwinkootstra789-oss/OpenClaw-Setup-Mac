---
name: cookie_manager
description: 管理浏览器 Cookie 的保存、加载和持久化，用于保持登录状态。特别适用于千里马等需要避免频繁登录触发风控的平台。使用场景：(1) 保存登录后的 Cookie 到本地文件，(2) 加载已保存的 Cookie 恢复登录状态，(3) 检查 Cookie 是否过期，(4) 管理多个账号的 Cookie。
---

# Cookie Manager - 登录状态保持

## 概述

本技能用于管理浏览器 Cookie，实现登录状态的持久化保存。主要解决 AI 自动化操作时需要频繁登录的问题，避免触发平台的风控机制（验证码、封号等）。

## 核心功能

1. **保存 Cookie** - 将当前浏览器的 Cookie 保存到本地 JSON 文件
2. **加载 Cookie** - 从本地文件读取 Cookie 并注入到浏览器
3. **检查过期** - 验证 Cookie 是否仍然有效
4. **多账号管理** - 支持保存多个账号的 Cookie

## 使用流程

### 1. 首次登录并保存 Cookie

```python
# 使用 Playwright 登录并保存 Cookie
from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    context = browser.new_context()
    page = context.new_page()
    
    # 访问登录页面
    page.goto("https://qianlima.com/login")
    
    # 手动完成登录（或自动化填写）
    # ... 登录代码 ...
    
    # 等待登录成功
    page.wait_for_selector(".user-avatar")  # 登录成功后的元素
    
    # 保存 Cookie
    cookies = context.cookies()
    with open("cookies/qianlima_user1.json", "w") as f:
        json.dump(cookies, f, indent=2)
    
    browser.close()
```

### 2. 后续使用已保存的 Cookie

```python
from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()
    
    # 加载已保存的 Cookie
    with open("cookies/qianlima_user1.json", "r") as f:
        cookies = json.load(f)
    context.add_cookies(cookies)
    
    # 直接访问需要登录的页面（无需再次登录）
    page = context.new_page()
    page.goto("https://qianlima.com/dashboard")
    
    # 执行自动化操作...
    
    browser.close()
```

## 脚本工具

本技能提供以下脚本工具：

### scripts/save_cookies.py
保存当前浏览器上下文的 Cookie 到指定文件。

```bash
python scripts/save_cookies.py --url https://qianlima.com --output cookies/qianlima.json
```

### scripts/load_cookies.py
从文件加载 Cookie 并验证是否有效。

```bash
python scripts/load_cookies.py --input cookies/qianlima.json --url https://qianlima.com
```

### scripts/check_cookie_expiry.py
检查 Cookie 是否过期，无需启动浏览器。

```bash
python scripts/check_cookie_expiry.py cookies/qianlima.json
```

## 最佳实践

1. **Cookie 存储位置**: 建议统一存放在 `cookies/` 目录，按平台+账号命名，如 `cookies/qianlima_user1.json`

2. **定期更新**: Cookie 有过期时间，建议定期（如每周）重新登录并更新

3. **多账号管理**: 使用不同的文件名区分账号，如 `qianlima_admin.json`、`qianlima_test.json`

4. **安全注意**: 
   - Cookie 文件包含敏感信息，不要提交到 Git
   - 在 `.gitignore` 中添加 `cookies/*.json`
   - 定期清理不再使用的 Cookie 文件

5. **异常处理**: 使用 Cookie 登录失败时，应自动回退到手动登录流程

## 千里马平台专用

千里马平台的风控策略：
- 频繁登录会触发验证码
- 短时间内多设备登录可能封号
- Cookie 有效期通常为 7-30 天

建议方案：
1. 首次运行：手动登录并保存 Cookie
2. 后续运行：自动加载 Cookie，避免登录步骤
3. 定期（每周）检查 Cookie 有效性，过期前重新登录

## 依赖安装

```bash
pip install playwright
playwright install chromium
```
