# browser-localmcp-skills

> **Reasonix 技能包** — 为 AI 代理提供稳定可靠的 Streamable HTTP MCP 连接能力

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 概述

Streamable HTTP 是 [MCP (Model Context Protocol)](https://modelcontextprotocol.io) 规范中定义的一种传输方式，它通过 HTTP POST + SSE (Server-Sent Events) 实现客户端与服务端之间的双向通信。

然而，AI 代理的 bash 执行环境**无法维持 SSE 长连接**，导致 session ID 无法分配和保持，连接频繁中断。

**browser-localmcp-skills** 通过一个 Node.js 桥接层解决了这个问题：

```
┌─────────────┐     CLI 调用     ┌──────────────────┐    HTTP POST     ┌─────────────────────┐
│  AI 代理     │ ──────────────→ │  mcp-bridge.js    │ ──────────────→ │  MCP 服务端          │
│  (Reasonix)  │ ←────────────── │  (Node.js 桥接)   │ ←────────────── │  (streamable-http)   │
└─────────────┘   JSON 响应      └──────────────────┘    SSE 流        └─────────────────────┘
                                        │
                                        ▼
                               Session ID 持久化
                              (%TEMP%/mcp-bridge-session.json)
```

桥接脚本自动管理 session 生命周期，支持即时 JSON 和 SSE 流式两种响应类型，并提供超时重试、断线重连等容错机制。

---

## 快速开始

### 前置条件

- [Node.js](https://nodejs.org) v18+（内置 `fetch` API，无需额外依赖）
- [Reasonix](https://reasonix.ai)（支持 MCP 技能的 AI Agent 框架）
- 一个运行中的 Streamable HTTP MCP 服务（默认地址：`http://127.0.0.1:12306/mcp`）

### 安装

```bash
# 克隆仓库
git clone https://github.com/phoenixlucky/browser-localmcp-skills.git
cd browser-localmcp-skills

# 技能已内置在 .reasonix/skills/mcp-streamable-connect/ 目录
# Reasonix 会自动发现并注册该技能
```

### 验证连接

```bash
# 1. 确认 MCP 服务已启动
curl -v http://127.0.0.1:12306/mcp

# 2. 初始化连接
node .reasonix/skills/mcp-streamable-connect/mcp-bridge.js init

# 3. 列出可用工具
node .reasonix/skills/mcp-streamable-connect/mcp-bridge.js call tools/list

# 4. 调用工具
node .reasonix/skills/mcp-streamable-connect/mcp-bridge.js call tools/call '{"name":"chrome_navigate","arguments":{"url":"https://example.com"}}'

# 5. 关闭连接
node .reasonix/skills/mcp-streamable-connect/mcp-bridge.js close
```

---

## 能力矩阵

本技能包对接的是 [mcp-chrome-2026](https://github.com/phoenixlucky/mcp-chrome-2026) 服务，涵盖 **7 大类共 28+ 个浏览器自动化工具**：

| 分类 | 工具 | 用途 |
|------|------|------|
| 📊 **浏览器管理** | `get_windows_and_tabs`, `chrome_navigate`, `chrome_close_tabs`, `chrome_switch_tab`, `chrome_go_back_or_forward` | 窗口标签页管理、页面导航 |
| 📸 **截图视觉** | `chrome_screenshot` | 全页/元素截图（支持 base64） |
| 🌐 **网络监控** | `chrome_network_capture_start/stop`, `chrome_network_debugger_start/stop`, `chrome_network_request`, `chrome_block_images` | 网络请求捕获与注入 |
| 🔍 **内容分析** | `search_tabs_content`, `chrome_get_web_content`, `chrome_get_interactive_elements` | AI 语义搜索、内容提取 |
| 🎯 **交互操作** | `chrome_click_element`, `chrome_fill_or_select`, `chrome_keyboard` | 点击、填表、键盘输入 |
| 📚 **数据管理** | `chrome_history`, `chrome_bookmark_search/add/delete` | 历史记录、书签 CRUD |
| 🕸️ **抓取提取** | `chrome_get_tab_url`, `chrome_scroll`, `chrome_get_scroll_state`, `chrome_wait`, `chrome_extract`, `chrome_get_page_text` (`Readability`), `chrome_click_and_wait` | 结构化数据提取、页面分析 |

---

## 桥接脚本参考

### CLI 命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `init` | 初始化 MCP 连接，获取 session ID | `node mcp-bridge.js init` |
| `call <method> [params]` | 调用 JSON-RPC 方法 | `node mcp-bridge.js call tools/list` |
| `ping` | 心跳保活 | `node mcp-bridge.js ping` |
| `close` | 关闭连接，清理 session | `node mcp-bridge.js close` |

### 完整工作流

```bash
# 初始化
node mcp-bridge.js init

# 导航
node mcp-bridge.js call tools/call '{"name":"chrome_navigate","arguments":{"url":"https://example.com"}}'

# 等待加载
node mcp-bridge.js call tools/call '{"name":"chrome_wait","arguments":{"selector":".main-content","waitFor":"visible"}}'

# 提取数据
node mcp-bridge.js call tools/call '{"name":"chrome_extract","arguments":{"selector":".data-item","fields":[{"name":"title","type":"text"}]}}'

# 截图
node mcp-bridge.js call tools/call '{"name":"chrome_screenshot","arguments":{"fullPage":true,"storeBase64":true}}'

# 关闭
node mcp-bridge.js close
```

### 技术特性

- **Session 自动管理** — session ID 持久化到 `%TEMP%\mcp-bridge-session.json`，跨调用复用
- **双响应类型** — 支持即时 JSON 和 SSE 流式两种 Content-Type
- **自动重试** — session 过期自动清理并重试 `init`，网络错误最多重试 2 次
- **超时保护** — 30 秒请求超时，防止卡死
- **零依赖** — 仅依赖 Node.js 内置 API（`fetch`、`fs`、`path`、`os`）

---

## 项目结构

```
browser-localmcp-skills/
├── .reasonix/
│   └── skills/
│       └── mcp-streamable-connect/      # 技能包
│           ├── SKILL.md                  # 技能指令（AI 操作手册）
│           └── mcp-bridge.js             # Node.js 桥接脚本
├── reasonix.toml                         # Reasonix 项目配置
├── .gitignore
└── README.md
```

---

## 相关资源

- [MCP 规范 — Streamable HTTP Transport](https://spec.modelcontextprotocol.io/2025-04-07/basic/transports/)
- [mcp-chrome-2026](https://github.com/phoenixlucky/mcp-chrome-2026) — Chrome 浏览器自动化 MCP 服务
- [Reasonix](https://reasonix.ai) — AI Agent 框架

---

## 许可证

[MIT](LICENSE)
