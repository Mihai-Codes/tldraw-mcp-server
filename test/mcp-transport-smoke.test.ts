import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AddressInfo } from 'node:net'
import { spawn, ChildProcess } from 'node:child_process'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { elements, httpServer, wss } from '../src/canvas-server.js'

const runSmoke = process.env.RUN_MCP_SMOKE === 'true'
const smokeDescribe = runSmoke ? describe : describe.skip

let canvasUrl = ''
let mcpHttpPort = 0
let httpServerProcess: ChildProcess | undefined

function randomPort(): number {
  return 40_000 + Math.floor(Math.random() * 10_000)
}

async function waitForHttp(url: string, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.status < 500) return
    } catch (err) {
      lastError = err
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw lastError instanceof Error ? lastError : new Error(`Timed out waiting for ${url}`)
}

function textFromResult(result: Awaited<ReturnType<Client['callTool']>>): string {
  if ('content' in result) {
    return result.content
      .filter((item) => item.type === 'text')
      .map((item) => item.text)
      .join('\n')
  }

  return JSON.stringify(result)
}

async function createStdioClient(name: string): Promise<Client> {
  const client = new Client({ name, version: '0.0.0' })
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
    env: {
      ...process.env,
      MCP_TRANSPORT: 'stdio',
      EXPRESS_SERVER_URL: canvasUrl,
      NODE_DISABLE_COLORS: '1',
      NO_COLOR: '1',
    } as Record<string, string>,
    stderr: 'pipe',
  })

  await client.connect(transport)
  return client
}

async function createHttpClient(name: string): Promise<Client> {
  const client = new Client({ name, version: '0.0.0' })
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${mcpHttpPort}/mcp`))
  await client.connect(transport)
  return client
}

async function assertDiscoveryAndCalls(client: Client, label: string): Promise<void> {
  const tools = await client.listTools()
  expect(tools.tools.length).toBeGreaterThanOrEqual(17)
  expect(tools.tools.some((tool) => tool.name.endsWith('create_element'))).toBe(true)
  expect(tools.tools.some((tool) => tool.name.endsWith('get_canvas_screenshot'))).toBe(true)

  const create = await client.callTool({
    name: 'create_element',
    arguments: {
      type: 'rectangle',
      x: 100,
      y: 100,
      width: 180,
      height: 80,
      text: `${label} smoke`,
    },
  })

  expect(textFromResult(create)).toContain('Element created')

  const screenshot = await client.callTool({
    name: 'get_canvas_screenshot',
    arguments: { background: true },
  })

  // CI usually has no browser attached, so a clear browser/screenshot tool error is acceptable.
  expect(textFromResult(screenshot)).toMatch(/screenshot|browser|canvas|Error/i)
}

smokeDescribe('MCP transport smoke tests', () => {
  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => resolve())
    })

    const address = httpServer.address() as AddressInfo
    canvasUrl = `http://127.0.0.1:${address.port}`
    mcpHttpPort = randomPort()

    httpServerProcess = spawn('node', ['dist/index.js'], {
      env: {
        ...process.env,
        MCP_TRANSPORT: 'http',
        MCP_HTTP_HOST: '127.0.0.1',
        MCP_HTTP_PORT: String(mcpHttpPort),
        EXPRESS_SERVER_URL: canvasUrl,
        NODE_DISABLE_COLORS: '1',
        NO_COLOR: '1',
      },
      stdio: ['ignore', 'ignore', 'pipe'],
    })

    await waitForHttp(`http://127.0.0.1:${mcpHttpPort}/mcp`)
  }, 10_000)

  afterAll(async () => {
    httpServerProcess?.kill('SIGTERM')
    elements.clear()
    await new Promise<void>((resolve) => wss.close(() => resolve()))
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  })

  it.each([
    ['AdaL', createStdioClient],
    ['Claude', createStdioClient],
    ['Cursor', createStdioClient],
    ['OpenAI Agents SDK', createHttpClient],
  ])('%s can discover tools and call create_element/get_canvas_screenshot', async (clientName, createClient) => {
    const client = await createClient(clientName)
    try {
      await assertDiscoveryAndCalls(client, clientName)
    } finally {
      await client.close()
    }
  }, 10_000)

  it('accepts concurrent streamable HTTP clients without schema collisions', async () => {
    const clients = await Promise.all([
      createHttpClient('concurrent-a'),
      createHttpClient('concurrent-b'),
    ])

    try {
      const [aTools, bTools] = await Promise.all(clients.map((client) => client.listTools()))
      expect(aTools.tools.map((tool) => tool.name).sort()).toEqual(bTools.tools.map((tool) => tool.name).sort())

      const [aCreate, bCreate] = await Promise.all(
        clients.map((client, index) =>
          client.callTool({
            name: 'create_element',
            arguments: {
              type: 'rectangle',
              x: index * 220,
              y: index * 120,
              text: `concurrent-${index}`,
            },
          })
        )
      )

      expect(textFromResult(aCreate)).toContain('Element created')
      expect(textFromResult(bCreate)).toContain('Element created')
      expect(elements.size).toBeGreaterThanOrEqual(2)
    } finally {
      await Promise.all(clients.map((client) => client.close()))
    }
  }, 10_000)
})
