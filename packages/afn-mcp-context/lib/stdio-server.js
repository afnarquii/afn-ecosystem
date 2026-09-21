/**
 * Servidor MCP stdio mínimo (JSON-RPC + Content-Length / newline).
 */

/**
 * @param {object} msg
 * @returns {string}
 */
function encodeFrame(msg) {
  const body = JSON.stringify(msg);
  const len = Buffer.byteLength(body, 'utf8');
  return `Content-Length: ${len}\r\n\r\n${body}`;
}

/**
 * @param {{ name: string, version?: string, tools: object[], onCallTool: (name: string, args: object) => Promise<unknown> }} opts
 */
export function startMcpStdioServer(opts) {
  const name = String(opts.name || 'afn-mcp');
  const version = String(opts.version || '1.0.0');
  const tools = Array.isArray(opts.tools) ? opts.tools : [];
  const onCallTool = opts.onCallTool;

  /** @type {string} */
  let buf = '';
  /** @type {'frame'|'line'|null} */
  let writeMode = null;

  function writeMsg(msg) {
    const useLine = writeMode === 'line';
    process.stdout.write(useLine ? `${JSON.stringify(msg)}\n` : encodeFrame(msg));
  }

  function drain() {
    while (true) {
      const lower = buf.toLowerCase();
      const clIdx = lower.indexOf('content-length:');
      if (clIdx >= 0) {
        const headerSlice = buf.slice(clIdx);
        const sep = headerSlice.match(/\r?\n\r?\n/);
        if (!sep || sep.index == null) return;
        const header = headerSlice.slice(0, sep.index);
        const m = header.match(/content-length:\s*(\d+)/i);
        if (!m) {
          buf = buf.slice(clIdx + 14);
          continue;
        }
        const len = Number(m[1]);
        const bodyStart = clIdx + sep.index + sep[0].length;
        if (buf.length < bodyStart + len) return;
        const body = buf.slice(bodyStart, bodyStart + len);
        buf = buf.slice(bodyStart + len);
        try {
          handleMessage(JSON.parse(body), 'frame');
        } catch {
          /* frame inválido */
        }
        continue;
      }

      const nl = buf.indexOf('\n');
      if (nl < 0) return;
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line || line.toLowerCase().startsWith('content-length:')) continue;
      try {
        handleMessage(JSON.parse(line), 'line');
      } catch {
        /* ruido */
      }
    }
  }

  /**
   * @param {object} msg
   * @param {'frame'|'line'} mode
   */
  async function handleMessage(msg, mode) {
    if (!msg || typeof msg !== 'object') return;
    if (writeMode == null) writeMode = mode;

    const { id, method, params } = msg;

    if (method === 'initialize') {
      writeMsg({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name, version },
        },
      });
      return;
    }

    if (method === 'notifications/initialized') return;

    if (method === 'tools/list') {
      writeMsg({ jsonrpc: '2.0', id, result: { tools } });
      return;
    }

    if (method === 'tools/call') {
      const toolName = String(params?.name || '').trim();
      const args =
        params?.arguments && typeof params.arguments === 'object' ? params.arguments : {};
      try {
        const result = await onCallTool(toolName, args);
        writeMsg({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(result ?? null) }],
            structuredContent: result ?? null,
          },
        });
      } catch (e) {
        writeMsg({
          jsonrpc: '2.0',
          id,
          error: { code: -32000, message: e?.message || String(e) },
        });
      }
      return;
    }

    if (id != null) {
      writeMsg({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      });
    }
  }

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buf += chunk;
    drain();
  });

  process.stdin.on('end', () => process.exit(0));
}
