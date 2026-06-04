#!/usr/bin/env node

/**
 * Startup performance budget check.
 * Measures MCP server startup time and memory usage.
 */

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

const MAX_STARTUP_MS = 2000 // 2 seconds max startup
const MAX_MEMORY_MB = 100 // 100 MB max memory

function measureStartup() {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    const startMemory = process.memoryUsage().heapUsed
    
    const child = spawn('node', [join(rootDir, 'dist', 'index.js')], {
      env: {
        ...process.env,
        EXPRESS_SERVER_URL: 'http://127.0.0.1:3000',
        MCP_TRANSPORT: 'stdio',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    
    let stdout = ''
    let stderr = ''
    
    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })
    
    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    
    // Kill after 500ms - we just want to measure startup
    setTimeout(() => {
      const endTime = Date.now()
      const endMemory = process.memoryUsage().heapUsed
      const startupMs = endTime - startTime
      const memoryUsedMB = (endMemory - startMemory) / 1024 / 1024
      
      child.kill('SIGTERM')
      
      resolve({
        startupMs,
        memoryUsedMB: Math.max(0, memoryUsedMB),
        exitCode: child.exitCode,
        stdout: stdout.slice(0, 500),
        stderr: stderr.slice(0, 500),
      })
    }, 500)
    
    child.on('error', reject)
  })
}

async function main() {
  console.log('Measuring MCP server startup performance...\n')
  
  try {
    const result = await measureStartup()
    
    console.log('Results:')
    console.log(`  Startup time: ${result.startupMs}ms (max: ${MAX_STARTUP_MS}ms)`)
    console.log(`  Memory used: ${result.memoryUsedMB.toFixed(2)}MB (max: ${MAX_MEMORY_MB}MB)`)
    console.log(`  Exit code: ${result.exitCode}`)
    
    if (result.stdout) {
      console.log(`\nStdout (first 500 chars): ${result.stdout}`)
    }
    if (result.stderr) {
      console.log(`\nStderr (first 500 chars): ${result.stderr}`)
    }
    
    const failures = []
    
    if (result.startupMs > MAX_STARTUP_MS) {
      failures.push(`Startup time ${result.startupMs}ms exceeds ${MAX_STARTUP_MS}ms budget`)
    }
    
    if (result.memoryUsedMB > MAX_MEMORY_MB) {
      failures.push(`Memory usage ${result.memoryUsedMB.toFixed(2)}MB exceeds ${MAX_MEMORY_MB}MB budget`)
    }
    
    if (failures.length > 0) {
      console.error('\n❌ Performance budget exceeded:')
      failures.forEach(f => console.error(`  - ${f}`))
      process.exit(1)
    }
    
    console.log('\n✅ Performance budget met')
    process.exit(0)
    
  } catch (error) {
    console.error('Failed to measure startup:', error)
    process.exit(1)
  }
}

main()
