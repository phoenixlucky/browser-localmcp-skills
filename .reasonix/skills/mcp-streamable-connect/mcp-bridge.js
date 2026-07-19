#!/usr/bin/env node
/**
 * mcp-bridge.js — Streamable HTTP MCP 桥接脚本
 *
 * 为 AI 代理提供稳定的 streamable-http MCP 连接能力。
 * Session ID 自动持久化到临时文件，跨调用复用。
 *
 * 用法:
 *   node mcp-bridge.js init                   初始化连接
 *   node mcp-bridge.js call <method> [params] 调用 JSON-RPC 方法
 *   node mcp-bridge.js ping                   心跳保活
 *   node mcp-bridge.js close                  关闭连接并清理 session
 *
 * 示例:
 *   node mcp-bridge.js init
 *   node mcp-bridge.js call tools/list
 *   node mcp-bridge.js call tools/call '{"name":"myTool","arguments":{}}'
 *   node mcp-bridge.js call resources/list
 *   node mcp-bridge.js ping
 *   node mcp-bridge.js close
 */

'use strict';

// ── 配置 ──────────────────────────────────────────────────────────────────
const MCP_URL = 'http://127.0.0.1:12306/mcp';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const SESSION_FILE = require('path').join(
  require('os').tmpdir(),
  'mcp-bridge-session.json'
);

// ── Session 持久化 ────────────────────────────────────────────────────────
const fs = require('fs');

function loadSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const raw = fs.readFileSync(SESSION_FILE, 'utf-8');
      return JSON.parse(raw).sessionId || null;
    }
  } catch {
    // 文件损坏等 — 忽略
  }
  return null;
}

function saveSession(sessionId) {
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify({ sessionId, savedAt: Date.now() }), 'utf-8');
  } catch (err) {
    console.error(`[桥接] 警告: 无法写入 session 文件: ${err.message}`);
  }
}

function clearSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE);
  } catch { /* 忽略 */ }
}

// ── SSE 解析 ──────────────────────────────────────────────────────────────
function parseSSEStream(text) {
  const events = [];
  const lines = text.split('\n');
  let currentEvent = {};

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentEvent.event = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      const dataStr = line.slice(6).trim();
      try {
        currentEvent.data = JSON.parse(dataStr);
      } catch {
        currentEvent.data = dataStr;
      }
    } else if (line === '' && Object.keys(currentEvent).length > 0) {
      events.push(currentEvent);
      currentEvent = {};
    }
  }

  // 处理最后可能没有空行结束的事件
  if (Object.keys(currentEvent).length > 0) {
    events.push(currentEvent);
  }

  return events;
}

// ── HTTP 请求 ─────────────────────────────────────────────────────────────
async function sendRequest(method, params = {}) {
  const sessionId = loadSession();

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream, application/json',
  };
  if (sessionId) {
    headers['Mcp-Session-Id'] = sessionId;
  }

  // 通知类（如 close）不需要 id
  const isNotification = method === 'close' || method === 'notifications/**';
  const body = isNotification
    ? { jsonrpc: '2.0', method, params }
    : { jsonrpc: '2.0', id: Date.now(), method, params };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(MCP_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error(`请求超时 (${REQUEST_TIMEOUT_MS}ms): ${method}`);
    }
    if (err.code === 'ECONNREFUSED') {
      throw new Error(`无法连接 MCP 服务: ${MCP_URL} — 请确认服务已启动`);
    }
    throw new Error(`网络错误: ${err.message}`);
  }
  clearTimeout(timeout);

  // 提取并保存新的 Session ID
  const newSessionId = response.headers.get('Mcp-Session-Id');
  if (newSessionId) {
    saveSession(newSessionId);
  }

  // 处理响应
  const contentType = (response.headers.get('Content-Type') || '').toLowerCase();

  if (contentType.includes('text/event-stream')) {
    // SSE 流式响应 — 读取完整流后解析
    const rawText = await response.text();
    const events = parseSSEStream(rawText);

    // 从 SSE 事件中提取 JSON-RPC 响应
    for (const evt of events) {
      if (evt.event === 'message' && evt.data) {
        return evt.data; // 返回第一个 message 事件的 data
      }
    }
    // 如果没有 event 字段但有 data，也返回
    if (events.length > 0 && events[0].data !== undefined) {
      return events[0].data;
    }
    return { _sseEvents: events };
  } else {
    // JSON 响应
    const json = await response.json();
    return json;
  }
}

async function callWithRetry(method, params = {}) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      return await sendRequest(method, params);
    } catch (err) {
      lastError = err;

      // 如果是 session 过期（服务端返回 SessionNotFound 或类似错误）
      if (
        err.message?.includes('Session') ||
        err.message?.includes('session')
      ) {
        // 清理过期的 session，下次会自动重新 init
        clearSession();
        if (attempt <= MAX_RETRIES) {
          console.error(`[桥接] Session 可能已过期，正在重试 (${attempt}/${MAX_RETRIES})...`);
          continue;
        }
      }

      // 其他错误 — 重试
      if (attempt <= MAX_RETRIES) {
        console.error(`[桥接] 请求失败，正在重试 (${attempt}/${MAX_RETRIES}): ${err.message}`);
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}

// ── CLI 入口 ──────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log(`
mcp-bridge.js — Streamable HTTP MCP 桥接工具

用法:
  node mcp-bridge.js init                   初始化连接
  node mcp-bridge.js call <method> [params] 调用 JSON-RPC 方法
  node mcp-bridge.js ping                   心跳保活
  node mcp-bridge.js close                  关闭连接并清理 session

示例:
  node mcp-bridge.js init
  node mcp-bridge.js call tools/list
  node mcp-bridge.js call tools/call '{"name":"myTool","arguments":{}}'
  node mcp-bridge.js ping
  node mcp-bridge.js close
`);
    process.exit(0);
  }

  try {
    let result;

    switch (command) {
      case 'init':
        result = await callWithRetry('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {
            roots: { listChanged: false },
            sampling: {},
          },
          clientInfo: {
            name: 'mcp-bridge',
            version: '1.0.0',
          },
        });
        break;

      case 'call': {
        const method = args[1];
        if (!method) {
          console.error('错误: 请指定要调用的方法名');
          console.error('用法: node mcp-bridge.js call <method> [params-json]');
          process.exit(1);
        }

        let params = {};
        if (args[2]) {
          try {
            params = JSON.parse(args[2]);
          } catch {
            console.error('错误: params 必须是一个有效的 JSON 字符串');
            console.error(`收到: ${args[2]}`);
            process.exit(1);
          }
        }

        result = await callWithRetry(method, params);

        // 对于 tools/call 的 SSE 流式响应，提取有用的信息
        if (method === 'tools/call' && result && result._sseEvents) {
          // 查找包含结果的 message 事件
          const msgEvent = result._sseEvents.find(e => e.event === 'message' && e.data?.result);
          if (msgEvent) result = msgEvent.data;
        }
        break;
      }

      case 'ping':
        result = await callWithRetry('ping');
        break;

      case 'close':
        // close 是通知，不需要等待响应
        try {
          await sendRequest('close');
        } catch { /* 忽略连接关闭后的错误 */ }
        clearSession();
        console.log('连接已关闭，session 已清理');
        process.exit(0);
        break;

      default:
        console.error(`错误: 未知命令 "${command}"`);
        console.error('可用命令: init, call, ping, close');
        process.exit(1);
    }

    // 输出结果 (JSON 格式，方便解析)
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(`[桥接] 错误: ${err.message}`);
    if (err.cause) console.error(`[桥接] 原因:`, err.cause);
    process.exit(1);
  }
}

main();
