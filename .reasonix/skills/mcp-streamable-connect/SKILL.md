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

## 常用 MCP 方法

### 工具相关
```bash
# 列出所有工具
node mcp-bridge.js call tools/list

# 调用工具
node mcp-bridge.js call tools/call '{"name":"get_weather","arguments":{"city":"北京"}}'
```

### 资源相关
```bash
# 列出资源
node mcp-bridge.js call resources/list

# 读取资源
node mcp-bridge.js call resources/read '{"uri":"resource://example"}'

# 订阅资源变更
node mcp-bridge.js call resources/subscribe '{"uri":"resource://example"}'
```

### Prompt 相关
```bash
# 列出 Prompt 模板
node mcp-bridge.js call prompts/list

# 获取 Prompt
node mcp-bridge.js call prompts/get '{"name":"example","arguments":{}}'
```

### 连接生命周期
```bash
# 初始化
node mcp-bridge.js init

# 心跳
node mcp-bridge.js ping

# 关闭
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
