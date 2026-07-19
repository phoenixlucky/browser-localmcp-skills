---
name: mcp-streamable-connect
description: 通过 Node.js 桥接脚本稳定连接 streamable-http MCP 服务（自动管理 session ID、支持所有 JSON-RPC 方法）
---

# mcp-streamable-connect

稳定连接 `streamable-http` 类型 MCP 服务的桥接技能。

## 适用场景

目标 MCP 服务：
- **URL**: `http://127.0.0.1:12306/mcp`
- **传输类型**: `streamable-http`（需要 HTTP POST + SSE 长连接管理）
- **痛点**: AI 代理的 bash 环境无法维持 SSE 长连接来分配和保持 session ID

## 前提

- Node.js v18+（支持 `fetch` API）
- MCP 服务已在 `http://127.0.0.1:12306/mcp` 运行（可用 `curl -v http://127.0.0.1:12306/mcp` 确认）

## 桥接脚本位置

```
.reasonix/skills/mcp-streamable-connect/mcp-bridge.js
```

## 快速开始

### 1. 初始化连接

```bash
node .reasonix/skills/mcp-streamable-connect/mcp-bridge.js init
```

成功后会返回服务端的能力信息（serverInfo、capabilities、protocolVersion 等），同时 session ID 自动保存到临时文件。

### 2. 列出可用工具

```bash
node .reasonix/skills/mcp-streamable-connect/mcp-bridge.js call tools/list
```

### 3. 调用工具

```bash
node .reasonix/skills/mcp-streamable-connect/mcp-bridge.js call tools/call '{"name":"工具名","arguments":{"参数1":"值1"}}'
```

### 4. 关闭连接

```bash
node .reasonix/skills/mcp-streamable-connect/mcp-bridge.js close
```

---

## 命令参考

| 命令 | 说明 | 示例 |
|------|------|------|
| `init` | 初始化连接，获取 session ID | `node mcp-bridge.js init` |
| `call <method>` | 调用 JSON-RPC 方法（不含参数） | `node mcp-bridge.js call tools/list` |
| `call <method> <json>` | 调用方法并传参 | `node mcp-bridge.js call tools/call '{"name":"x","arguments":{}}'` |
| `ping` | 心跳保活 | `node mcp-bridge.js ping` |
| `close` | 发送 close 通知并清理 session | `node mcp-bridge.js close` |

## Chrome MCP 工具参考

本技能对接的是 [mcp-chrome-2026](https://github.com/phoenixlucky/mcp-chrome-2026) 服务，以下是所有可用工具及调用示例。

### 📊 浏览器管理

```bash
# 列出所有窗口和标签页
node mcp-bridge.js call tools/call '{"name":"get_windows_and_tabs","arguments":{}}'

# 导航到 URL
node mcp-bridge.js call tools/call '{"name":"chrome_navigate","arguments":{"url":"https://example.com"}}'

# 新窗口打开
node mcp-bridge.js call tools/call '{"name":"chrome_navigate","arguments":{"url":"https://example.com","newWindow":true,"width":1920,"height":1080}}'

# 关闭标签页
node mcp-bridge.js call tools/call '{"name":"chrome_close_tabs","arguments":{"tabIds":[123,456]}}'

# 切换标签页
node mcp-bridge.js call tools/call '{"name":"chrome_switch_tab","arguments":{"tabId":456}}'

# 浏览器历史导航
node mcp-bridge.js call tools/call '{"name":"chrome_go_back_or_forward","arguments":{"direction":"back"}}'
```

### 📸 截图和视觉

```bash
# 截取全页截图（返回 base64）
node mcp-bridge.js call tools/call '{"name":"chrome_screenshot","arguments":{"fullPage":true,"storeBase64":true}}'

# 截取特定元素截图
node mcp-bridge.js call tools/call '{"name":"chrome_screenshot","arguments":{"selector":".main-content","storeBase64":true}}'
```

### 🌐 网络监控

```bash
# 开始捕获网络请求
node mcp-bridge.js call tools/call '{"name":"chrome_network_capture_start","arguments":{"maxCaptureTime":30000}}'

# 停止捕获并获取结果
node mcp-bridge.js call tools/call '{"name":"chrome_network_capture_stop","arguments":{}}'

# 发送自定义 HTTP 请求
node mcp-bridge.js call tools/call '{"name":"chrome_network_request","arguments":{"url":"https://api.example.com/data","method":"GET"}}'

# 阻止图片加载
node mcp-bridge.js call tools/call '{"name":"chrome_block_images","arguments":{"action":"start"}}'
```

### 🔍 内容分析

```bash
# 跨标签页语义搜索
node mcp-bridge.js call tools/call '{"name":"search_tabs_content","arguments":{"query":"搜索关键词"}}'

# 提取网页文本内容
node mcp-bridge.js call tools/call '{"name":"chrome_get_web_content","arguments":{"format":"text"}}'

# 查找页面可交互元素
node mcp-bridge.js call tools/call '{"name":"chrome_get_interactive_elements","arguments":{}}'
```

### 🎯 交互操作

```bash
# 点击元素
node mcp-bridge.js call tools/call '{"name":"chrome_click_element","arguments":{"selector":"#submit-button"}}'

# 填充表单字段
node mcp-bridge.js call tools/call '{"name":"chrome_fill_or_select","arguments":{"selector":"#email-input","value":"user@example.com"}}'

# 模拟键盘输入
node mcp-bridge.js call tools/call '{"name":"chrome_keyboard","arguments":{"keys":"Ctrl+A","selector":"#text-input"}}'
```

### 📚 数据管理

```bash
# 搜索浏览器历史
node mcp-bridge.js call tools/call '{"name":"chrome_history","arguments":{"text":"github","maxResults":50}}'

# 搜索书签
node mcp-bridge.js call tools/call '{"name":"chrome_bookmark_search","arguments":{"query":"文档","maxResults":20}}'

# 添加书签
node mcp-bridge.js call tools/call '{"name":"chrome_bookmark_add","arguments":{"url":"https://example.com","title":"示例网站","parentId":"工作/资源","createFolder":true}}'

# 删除书签
node mcp-bridge.js call tools/call '{"name":"chrome_bookmark_delete","arguments":{"url":"https://example.com"}}'
```

### 🕸️ 抓取与提取

```bash
# 获取标签页 URL 和标题
node mcp-bridge.js call tools/call '{"name":"chrome_get_tab_url","arguments":{"tabId":123}}'

# 滚动页面
node mcp-bridge.js call tools/call '{"name":"chrome_scroll","arguments":{"amount":500}}'

# 滚动到页面底部（懒加载模式）
node mcp-bridge.js call tools/call '{"name":"chrome_scroll","arguments":{"toBottom":true,"lazyLoad":true}}'

# 获取滚动状态
node mcp-bridge.js call tools/call '{"name":"chrome_get_scroll_state","arguments":{}}'

# 等待元素出现
node mcp-bridge.js call tools/call '{"name":"chrome_wait","arguments":{"selector":".product-list","waitFor":"visible","timeout":15000}}'

# 提取结构化数据
node mcp-bridge.js call tools/call '{"name":"chrome_extract","arguments":{"selector":".product-card","fields":[{"name":"title","selector":".product-title","type":"text"},{"name":"price","selector":".price","type":"number"}],"limit":20}}'

# 提取文章正文（Readability）
node mcp-bridge.js call tools/call '{"name":"chrome_get_page_text","arguments":{}}'

# 点击并等待
node mcp-bridge.js call tools/call '{"name":"chrome_click_and_wait","arguments":{"selector":"#load-more-button","waitSelector":".new-content","waitFor":"visible"}}'
```

## 完整工作流示例

以下是一个典型的浏览器自动化完整流程：

```bash
# 1️⃣ 初始化连接
node mcp-bridge.js init

# 2️⃣ 导航到目标页面
node mcp-bridge.js call tools/call '{"name":"chrome_navigate","arguments":{"url":"https://example.com"}}'

# 3️⃣ 等待页面加载
node mcp-bridge.js call tools/call '{"name":"chrome_wait","arguments":{"selector":".main-content","waitFor":"visible"}}'

# 4️⃣ 提取页面数据
node mcp-bridge.js call tools/call '{"name":"chrome_extract","arguments":{"selector":".data-item","fields":[{"name":"title","type":"text"}]}}'

# 5️⃣ 截图保存
node mcp-bridge.js call tools/call '{"name":"chrome_screenshot","arguments":{"fullPage":true,"storeBase64":true}}'

# 6️⃣ 关闭连接
node mcp-bridge.js close
```

## 连接生命周期

```bash
# 初始化
node mcp-bridge.js init

# 心跳保活
node mcp-bridge.js ping

# 关闭连接
node mcp-bridge.js close
```

---

## Session 管理说明

- Session ID 保存在 `%TEMP%\mcp-bridge-session.json`
- 每次 `call` 命令自动附加 `Mcp-Session-Id` 请求头
- 服务端返回新的 session ID 时自动更新保存
- **session 有超时时间**：如果服务端长时间未收到请求，可能自动关闭 session。此时脚本会自动检测错误、清理过期 session 并重试 init
- 如果遇到 `SessionNotFound` 错误，只需重新执行 `init` 即可

## 故障排除

### Q: `ECONNREFUSED` / 无法连接
→ MCP 服务未启动。请先启动你的 MCP 服务，再重试。

### Q: `SessionNotFound` / 类似 session 错误
→ Session 已超时或被服务端关闭。运行 `close` 清理，然后重新 `init`。

### Q: 返回 JSON 解析错误
→ 确认 params 参数是合法的 JSON 字符串（使用单引号包裹整个 JSON）。

### Q: 输出为空或 undefined
→ 某些 MCP 方法返回空结果或通知类消息是正常的。如果期望有数据但为空，检查方法名和参数是否正确。

### Q: Windows 上路径包含空格
→ 使用完整双引号包裹路径：`node ".reasonix/skills/mcp-streamable-connect/mcp-bridge.js" init`

---

## 技术原理

MCP Streamable HTTP Transport 的工作方式：
1. 客户端发送 HTTP POST 请求，含 `Content-Type: application/json` 和 `Accept: text/event-stream, application/json`
2. 服务端返回即时 JSON 响应（`Content-Type: application/json`）或 SSE 流式响应（`Content-Type: text/event-stream`）
3. Session ID 通过响应头 `Mcp-Session-Id` 传递，后续请求需带上
4. 关闭连接时发送 `close` 通知（无需响应）

本桥接脚本封装了以上全部细节，AI 只需通过 CLI 调用即可。
