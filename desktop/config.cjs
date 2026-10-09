const fs = require('node:fs')
const path = require('node:path')

const configPath = userDataPath => path.join(userDataPath, 'courtdesk-config.json')

function readConfig(userDataPath) {
  const p = configPath(userDataPath)
  if (!fs.existsSync(p)) return { mode: null }
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'))
    return { mode: parsed.mode || null, serverUrl: parsed.serverUrl || null }
  } catch { return { mode: null } }
}

function writeConfig(userDataPath, config) {
  const p = configPath(userDataPath)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  const tmp = p + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2))
  fs.renameSync(tmp, p)
}

module.exports = { readConfig, writeConfig }
