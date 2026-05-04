import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { AddressInfo } from 'net'
import { elements, httpServer, wss } from '../src/canvas-server.js'

let baseUrl = ''

async function request(path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
}

describe('canvas-server REST edge cases', () => {
  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => resolve())
    })
    const address = httpServer.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  beforeEach(() => {
    elements.clear()
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => wss.close(() => resolve()))
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  })

  it('returns 409 instead of overwriting an existing custom id', async () => {
    const first = await request('/api/elements', {
      method: 'POST',
      body: JSON.stringify({ id: 'duplicate', type: 'rectangle', x: 0, y: 0 }),
    })
    expect(first.status).toBe(201)

    const second = await request('/api/elements', {
      method: 'POST',
      body: JSON.stringify({ id: 'duplicate', type: 'ellipse', x: 100, y: 100 }),
    })
    expect(second.status).toBe(409)

    expect(elements.size).toBe(1)
    expect(elements.get('duplicate')?.type).toBe('rectangle')
  })

  it('rejects invalid batch creates atomically', async () => {
    const res = await request('/api/elements/batch', {
      method: 'POST',
      body: JSON.stringify({
        elements: [
          { id: 'valid', type: 'rectangle', x: 0, y: 0 },
          { id: 'invalid', type: 'ellipse', x: 100 },
        ],
      }),
    })

    expect(res.status).toBe(400)
    expect(elements.size).toBe(0)
  })

  it('rejects duplicate ids in batch creates atomically', async () => {
    const res = await request('/api/elements/batch', {
      method: 'POST',
      body: JSON.stringify({
        elements: [
          { id: 'same', type: 'rectangle', x: 0, y: 0 },
          { id: 'same', type: 'ellipse', x: 100, y: 0 },
        ],
      }),
    })

    expect(res.status).toBe(409)
    expect(elements.size).toBe(0)
  })

  it('updates multiple elements atomically via batch update', async () => {
    await request('/api/elements/batch', {
      method: 'POST',
      body: JSON.stringify({
        elements: [
          { id: 'a', type: 'rectangle', x: 0, y: 0 },
          { id: 'b', type: 'rectangle', x: 100, y: 0 },
        ],
      }),
    })

    const res = await request('/api/elements/batch', {
      method: 'PUT',
      body: JSON.stringify({
        updates: [
          { id: 'a', changes: { x: 10 } },
          { id: 'b', changes: { x: 110 } },
        ],
      }),
    })

    expect(res.status).toBe(200)
    expect(elements.get('a')?.x).toBe(10)
    expect(elements.get('b')?.x).toBe(110)
  })

  it('rejects missing batch update targets atomically', async () => {
    await request('/api/elements', {
      method: 'POST',
      body: JSON.stringify({ id: 'a', type: 'rectangle', x: 0, y: 0 }),
    })

    const res = await request('/api/elements/batch', {
      method: 'PUT',
      body: JSON.stringify({
        updates: [
          { id: 'a', changes: { x: 10 } },
          { id: 'missing', changes: { x: 110 } },
        ],
      }),
    })

    expect(res.status).toBe(404)
    expect(elements.get('a')?.x).toBe(0)
  })
})
