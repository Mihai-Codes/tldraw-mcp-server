#!/usr/bin/env node

import { listToolsForConfig } from '../dist/index.js'

const baseConfig = {
  serverName: 'tldraw',
  serverVersion: '0.2.0',
  expressServerUrl: 'http://127.0.0.1:3000',
  transport: 'stdio',
  httpHost: '127.0.0.1',
  httpPort: 3333,
  httpPath: '/mcp',
  allowedOrigins: ['http://127.0.0.1', 'http://localhost'],
  allowedHosts: ['127.0.0.1', 'localhost'],
  client: 'generic',
  includeServerInToolNames: false,
}

const fullTools = listToolsForConfig({ ...baseConfig, performanceMode: false })
const compactTools = listToolsForConfig({ ...baseConfig, performanceMode: true })

const fullBytes = Buffer.byteLength(JSON.stringify(fullTools), 'utf8')
const compactBytes = Buffer.byteLength(JSON.stringify(compactTools), 'utf8')
const reduction = 1 - compactBytes / fullBytes

const result = {
  fullBytes,
  compactBytes,
  reductionPercent: Number((reduction * 100).toFixed(2)),
}

console.log(JSON.stringify(result, null, 2))

if (reduction < 0.30) {
  console.error(`Expected MCP_PERFORMANCE_MODE to reduce discovery payload by at least 30%, got ${result.reductionPercent}%`)
  process.exit(1)
}
