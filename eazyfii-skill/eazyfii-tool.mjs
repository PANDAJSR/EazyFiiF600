#!/usr/bin/env node
import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

const AGENT_PORT_FILE = '.eazyfii-agent-port'
const DEFAULT_TIMEOUT_MS = 60000
const MAX_WAIT_TIME_MS = 10000

const getHomeDir = () => {
  const home = os.homedir()
  return home
}

const getPortFilePath = () => {
  return path.join(getHomeDir(), AGENT_PORT_FILE)
}

const readPortFile = async (maxWaitMs = MAX_WAIT_TIME_MS) => {
  const portFilePath = getPortFilePath()
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const content = await fs.readFile(portFilePath, 'utf8')
      const port = parseInt(content.trim(), 10)
      if (Number.isFinite(port) && port > 0 && port < 65536) {
        return port
      }
    } catch {
      // File doesn't exist yet, wait and retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  return null
}

const request = (port, payload, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload)
    const options = {
      hostname: '127.0.0.1',
      port,
      path: '/agent',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: timeoutMs,
    }

    const req = http.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => {
        body += chunk
      })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body)
          resolve(parsed)
        } catch {
          resolve({ ok: false, error: `Invalid response: ${body.slice(0, 200)}` })
        }
      })
    })

    req.on('error', (err) => {
      reject(err)
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Request timeout after ${timeoutMs}ms`))
    })

    req.write(data)
    req.end()
  })
}

const readInput = async () => {
  const chunks = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

const parseInput = (input) => {
  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }
  try {
    return JSON.parse(trimmed)
  } catch {
    return { method: trimmed, params: {} }
  }
}

const run = async () => {
  const input = await readInput()
  const parsed = parseInput(input)

  if (!parsed) {
    console.error(JSON.stringify({ ok: false, error: 'No input provided' }))
    process.exit(1)
  }

  const { method, params = {}, id = null } = parsed

  if (!method) {
    console.error(JSON.stringify({ ok: false, error: 'No method specified', id }))
    process.exit(1)
  }

  const port = await readPortFile()
  if (!port) {
    const error = {
      ok: false,
      error: `Port file not found after ${MAX_WAIT_TIME_MS}ms. Make sure EazyFii is running with agent HTTP server enabled.`,
      hint: `Expected port file at: ${getPortFilePath()}`,
      id,
    }
    console.error(JSON.stringify(error))
    process.exit(1)
  }

  const timeout = typeof params.timeout === 'number' ? params.timeout * 1000 : DEFAULT_TIMEOUT_MS

  try {
    const result = await request(port, { method, params, id }, timeout)
    console.log(JSON.stringify(result))
  } catch (err) {
    const error = {
      ok: false,
      error: `Request failed: ${err.message}`,
      port,
      id,
    }
    console.error(JSON.stringify(error))
    process.exit(1)
  }
}

run()