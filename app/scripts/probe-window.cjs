const { execFile } = require('node:child_process')
const { setTimeout: sleep } = require('node:timers/promises')

function hyprlandWindows(timeout) {
  return new Promise((resolve, reject) => {
    execFile('hyprctl', ['-j', 'clients'], { timeout }, (error, stdout) => {
      if (error) return reject(new Error(`cannot query Hyprland windows: ${error.message}`))
      try { resolve(JSON.parse(stdout)) } catch (error) { reject(error) }
    })
  })
}

async function waitForMappedWindow(title, pid, { query = hyprlandWindows, timeout = 10000, interval = 50 } = {}) {
  const deadline = performance.now() + timeout
  let timer
  const expired = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`probe window "${title}" not mapped within ${timeout} ms`)), timeout)
  })
  try {
    await Promise.race([expired, (async () => {
      while (performance.now() < deadline) {
        const windows = await query(Math.max(1, Math.ceil(deadline - performance.now())))
        if (windows.some(window => window.title === title && window.pid === pid && window.mapped && !window.hidden)) return
        await sleep(Math.min(interval, Math.max(0, deadline - performance.now())))
      }
      throw new Error(`probe window "${title}" not mapped within ${timeout} ms`)
    })()])
  } finally { clearTimeout(timer) }
}

module.exports = { waitForMappedWindow }
