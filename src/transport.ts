import { randomUUID } from 'node:crypto'
import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Request, Response, NextFunction } from 'express'
import type { TldrawMcpConfig } from './config.js'

export type McpServerFactory = () => Server

function isAllowedOrigin(config: TldrawMcpConfig, origin?: string): boolean {
  if (!origin) return true
  return config.allowedOrigins.some((allowed) => origin === allowed || origin.startsWith(`${allowed}:`))
}

function isAuthorized(config: TldrawMcpConfig, authorization?: string): boolean {
  if (!config.authToken) return true
  return authorization === `Bearer ${config.authToken}`
}

function securityMiddleware(config: TldrawMcpConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!isAllowedOrigin(config, req.header('origin') ?? undefined)) {
      res.status(403).json({ error: 'Origin not allowed' })
      return
    }

    if (!isAuthorized(config, req.header('authorization') ?? undefined)) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    next()
  }
}

function isInitializeRequest(body: unknown): boolean {
  if (!body || Array.isArray(body) || typeof body !== 'object') return false
  return (body as { method?: unknown }).method === 'initialize'
}

export async function startMcpServer(createServer: McpServerFactory, config: TldrawMcpConfig): Promise<void> {
  if (config.transport === 'stdio') {
    await createServer().connect(new StdioServerTransport())
    return
  }

  const app = createMcpExpressApp({
    host: config.httpHost,
    allowedHosts: config.allowedHosts,
  })

  app.use(securityMiddleware(config))

  const transports = new Map<string, StreamableHTTPServerTransport>()

  app.all(config.httpPath, async (req, res) => {
    const requestedSessionId = req.header('mcp-session-id')
    let transport = requestedSessionId ? transports.get(requestedSessionId) : undefined

    if (!transport) {
      if (!isInitializeRequest(req.body)) {
        res.status(requestedSessionId ? 404 : 400).json({
          error: requestedSessionId ? 'Unknown MCP session' : 'Missing MCP session; initialize first',
        })
        return
      }

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        allowedHosts: config.allowedHosts,
        allowedOrigins: config.allowedOrigins,
        enableDnsRebindingProtection: true,
        onsessioninitialized: (sessionId) => {
          transports.set(sessionId, transport!)
        },
        onsessionclosed: (sessionId) => {
          transports.delete(sessionId)
        },
      })

      transport.onclose = () => {
        if (transport?.sessionId) transports.delete(transport.sessionId)
      }

      await createServer().connect(transport)
    }

    await transport.handleRequest(req, res, req.body)
  })

  await new Promise<void>((resolve) => {
    app.listen(config.httpPort, config.httpHost, () => resolve())
  })
}
