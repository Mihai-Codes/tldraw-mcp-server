import 'dotenv/config'

export type McpTransportKind = 'stdio' | 'http'
export type McpClientKind = 'adal' | 'claude' | 'cursor' | 'openai' | 'generic'

export interface TldrawMcpConfig {
  serverName: string
  serverVersion: string
  expressServerUrl: string
  transport: McpTransportKind
  httpHost: string
  httpPort: number
  httpPath: string
  allowedOrigins: string[]
  allowedHosts: string[]
  authToken?: string
  client: McpClientKind
  includeServerInToolNames: boolean
  performanceMode: boolean
}

function readBool(name: string, fallback = false): boolean {
  const value = process.env[name]
  if (value === undefined) return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function readList(name: string, fallback: string[]): string[] {
  const value = process.env[name]
  if (!value) return fallback
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function readClient(): McpClientKind {
  const value = (process.env.MCP_CLIENT ?? 'generic').toLowerCase()
  if (value === 'adal' || value === 'claude' || value === 'cursor' || value === 'openai') {
    return value
  }
  return 'generic'
}

export function loadConfig(): TldrawMcpConfig {
  const httpHost = process.env.MCP_HTTP_HOST ?? '127.0.0.1'
  const httpPort = Number(process.env.MCP_HTTP_PORT ?? 3333)

  return {
    serverName: process.env.MCP_SERVER_NAME ?? 'tldraw',
    serverVersion: process.env.MCP_SERVER_VERSION ?? '0.2.0',
    expressServerUrl: process.env.EXPRESS_SERVER_URL ?? 'http://127.0.0.1:3000',
    transport: process.env.MCP_TRANSPORT === 'http' ? 'http' : 'stdio',
    httpHost,
    httpPort,
    httpPath: process.env.MCP_HTTP_PATH ?? '/mcp',
    allowedOrigins: readList('MCP_ALLOWED_ORIGINS', [
      'http://127.0.0.1',
      'http://localhost',
      'http://127.0.0.1:3000',
      'http://localhost:3000',
    ]),
    allowedHosts: readList('MCP_ALLOWED_HOSTS', [
      httpHost,
      `${httpHost}:${httpPort}`,
      '127.0.0.1',
      `127.0.0.1:${httpPort}`,
      'localhost',
      `localhost:${httpPort}`,
    ]),
    authToken: process.env.MCP_AUTH_TOKEN,
    client: readClient(),
    includeServerInToolNames: readBool('INCLUDE_SERVER_IN_TOOL_NAMES', false),
    performanceMode: readBool('MCP_PERFORMANCE_MODE', false),
  }
}
