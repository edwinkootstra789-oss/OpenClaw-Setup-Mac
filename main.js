const { app, BrowserWindow, ipcMain, protocol, net, dialog } = require('electron')
const path = require('path')
const { pathToFileURL } = require('url')
const os = require('os')
const fs = require('fs')
const fse = require('fs-extra')
const { exec, spawn } = require('child_process')
const AdmZip = require('adm-zip')

let mainWindow = null
const HOME_DIR = os.homedir()
const DATA_DIR = path.join(HOME_DIR, '.openclaw')
let INSTALL_DIR = path.join(HOME_DIR, '.openclaw')
const IS_DEV = !app.isPackaged

function getBinDir() {
  return path.join(INSTALL_DIR, 'node_modules', '.bin')
}

function getAssetsPath() {
  if (IS_DEV) {
    return path.join(__dirname, 'assets')
  }
  return path.join(process.resourcesPath, 'assets')
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 720,
    height: 560,
    minWidth: 720,
    minHeight: 560,
    resizable: true,
    titleBarStyle: 'hiddenInset',
    frame: false,
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.loadFile('index.html')

  if (IS_DEV) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }
}

app.whenReady().then(() => {
  protocol.handle('asset', (request) => {
    const url = request.url.replace('asset://', '')
    const basePath = IS_DEV ? path.join(__dirname, 'assets') : path.join(process.resourcesPath, 'assets')
    const filePath = path.join(basePath, url)
    return net.fetch(pathToFileURL(filePath).toString())
  })
  return createWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

ipcMain.handle('get-home-dir', () => {
  return HOME_DIR
})

ipcMain.handle('verify-password', async (_event, input) => {
  const HARDCODED_PASSWORD = 'AILKXQ666888'
  if (input === HARDCODED_PASSWORD) {
    return { ok: true }
  }
  return { ok: false }
})

ipcMain.handle('get-install-dir', () => {
  return INSTALL_DIR
})

ipcMain.handle('select-install-dir', async () => {
  if (!mainWindow) return { canceled: true, path: '' }
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择 OpenClaw 安装目录',
    defaultPath: INSTALL_DIR,
    properties: ['openDirectory', 'createDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true, path: '' }
  }
  return { canceled: false, path: result.filePaths[0] }
})

ipcMain.handle('set-install-dir', async (_event, dir) => {
  if (!dir || typeof dir !== 'string') return { success: false, error: 'Invalid path' }
  INSTALL_DIR = path.resolve(dir)
  return { success: true, path: INSTALL_DIR }
})

ipcMain.handle('window-minimize', () => {
  mainWindow.minimize()
})

ipcMain.handle('window-close', () => {
  mainWindow.close()
})

ipcMain.handle('window-maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow.maximize()
  }
})

ipcMain.handle('window-toggle-fullscreen', () => {
  mainWindow.setFullScreen(!mainWindow.isFullScreen())
})

function runVersionCheck(command) {
  const depName = command.split(' ')[0]
  return new Promise((resolve) => {
    exec(command, { timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ ok: false, error: `${depName} 未安装或不在 PATH 中`, version: '' })
        return
      }
      const version = (stdout + stderr).trim()
      if (!version) {
        resolve({ ok: false, error: `${depName} 未安装或不在 PATH 中`, version: '' })
        return
      }
      resolve({ ok: true, version, error: '' })
    })
  })
}

function refreshEnvPath() {
  return new Promise((resolve) => {
    exec('zsh -l -c "echo $PATH"', { timeout: 10000 }, (error, stdout) => {
      if (!error && stdout.trim()) {
        process.env.PATH = stdout.trim()
      }
      resolve()
    })
  })
}

ipcMain.handle('check-dependencies', async () => {
  await refreshEnvPath()
  const results = {}

  const nodeResult = await runVersionCheck('node -v')
  if (nodeResult.ok) {
    const raw = nodeResult.version.replace(/^v/, '')
    const major = parseInt(raw.split('.')[0], 10)
    results.node = {
      ok: major >= 22,
      version: nodeResult.version,
      error: major < 22 ? `Node.js 版本不匹配，需要 >= 22，当前 ${nodeResult.version}` : ''
    }
  } else {
    results.node = { ok: false, version: '', error: nodeResult.error || 'Node.js not found' }
  }

  let pythonResult = await runVersionCheck('python3 --version')
  if (!pythonResult.ok) {
    pythonResult = await runVersionCheck('python --version')
  }
  results.python = {
    ok: pythonResult.ok,
    version: pythonResult.version,
    error: pythonResult.ok ? '' : (pythonResult.error || 'Python not found')
  }

  const gitResult = await runVersionCheck('git --version')
  results.git = {
    ok: gitResult.ok,
    version: gitResult.version,
    error: gitResult.ok ? '' : (gitResult.error || 'Git not found')
  }

  return results
})

ipcMain.handle('check-openclaw-versions', async () => {
  const assetsPath = getAssetsPath()
  const zipPath = path.join(assetsPath, 'openclaw-pack.zip')

  let packageVersion = ''
  if (fs.existsSync(zipPath)) {
    const nameMatch = path.basename(zipPath).match(/openclaw[_-]?pack[_-]?(\d+\.\d+\.\d+)?/i)
    if (nameMatch && nameMatch[1]) packageVersion = nameMatch[1]
  }

  const versionResult = await runVersionCheck('openclaw --version')
  let existingVersion = ''
  if (versionResult.ok) existingVersion = versionResult.version

  return {
    existingVersion,
    packageVersion: packageVersion || 'latest',
    hasExisting: !!existingVersion,
    hasZip: fs.existsSync(zipPath)
  }
})

ipcMain.handle('install-openclaw', async () => {
  const assetsPath = getAssetsPath()
  const zipPath = path.join(assetsPath, 'openclaw-pack.zip')

  if (!fs.existsSync(zipPath)) {
    return { success: false, error: `ZIP archive not found: ${zipPath}` }
  }

  try {
    const zipSize = fs.statSync(zipPath).size
    const zipSizeMB = (zipSize / 1024 / 1024).toFixed(1)

    mainWindow.webContents.send('install-progress', 0)
    mainWindow.webContents.send('install-log', `Target: ${INSTALL_DIR}\nZip size: ${zipSizeMB} MB\n`)

    mainWindow.webContents.send('install-log', 'Cleaning previous installation...\n')
    try {
      await fs.promises.rm(INSTALL_DIR, { recursive: true, force: true })
    } catch (_) {}
    await new Promise(r => setImmediate(r))
    await fs.promises.mkdir(INSTALL_DIR, { recursive: true })
    mainWindow.webContents.send('install-progress', 10)

    mainWindow.webContents.send('install-log', 'Extracting openclaw-pack.zip...\n')
    const zip = new AdmZip(zipPath)
    const entries = zip.getEntries()
    const entryCount = entries.length
    for (let i = 0; i < entries.length; i++) {
      if (i % 80 === 0) {
        await new Promise(r => setImmediate(r))
        const pct = 10 + Math.floor((i / entryCount) * 35)
        mainWindow.webContents.send('install-progress', pct)
      }
      const entry = entries[i]
      const entryPath = path.join(INSTALL_DIR, entry.entryName)
      if (entry.isDirectory) {
        await fs.promises.mkdir(entryPath, { recursive: true }).catch(() => {})
      } else {
        await fs.promises.mkdir(path.dirname(entryPath), { recursive: true }).catch(() => {})
        await fs.promises.writeFile(entryPath, entry.getData())
      }
    }
    mainWindow.webContents.send('install-log', 'Extraction complete.\n')
    mainWindow.webContents.send('install-progress', 50)

    const topEntries = await fs.promises.readdir(INSTALL_DIR, { withFileTypes: true })
    const topDirs = topEntries.filter(e => e.isDirectory())
    const topFiles = topEntries.filter(e => e.isFile())
    if (topDirs.length === 1 && topFiles.length === 0) {
      const wrapperName = topDirs[0].name
      const wrapperPath = path.join(INSTALL_DIR, wrapperName)
      mainWindow.webContents.send('install-log', `Detected top-level wrapper: ${wrapperName}/ — flattening...\n`)
      const wrapperEntries = await fs.promises.readdir(wrapperPath, { withFileTypes: true })
      for (const entry of wrapperEntries) {
        const srcPath = path.join(wrapperPath, entry.name)
        const destPath = path.join(INSTALL_DIR, entry.name)
        if (entry.isDirectory()) {
          await fse.move(srcPath, destPath, { overwrite: true })
        } else {
          await fs.promises.rename(srcPath, destPath)
        }
      }
      await fs.promises.rmdir(wrapperPath)
      mainWindow.webContents.send('install-log', 'Flattened: contents moved up one level.\n')
    }

    const binDir = getBinDir()
    if (!fs.existsSync(binDir)) {
      const listing = fs.existsSync(INSTALL_DIR)
        ? (await fs.promises.readdir(INSTALL_DIR)).join(', ')
        : '(dir missing)'
      mainWindow.webContents.send('install-log',
        `[WARN] Binary dir not found at: ${binDir}\nDir listing: ${listing}\n`)
      return { success: false, error: `Binary dir missing: ${binDir}` }
    }
    mainWindow.webContents.send('install-log', `Binary dir verified: ${binDir}\n`)
    mainWindow.webContents.send('install-progress', 60)

    mainWindow.webContents.send('install-log', 'Registering system PATH...\n')
    const pathResult = await registerPath(binDir)
    if (!pathResult.success) {
      mainWindow.webContents.send('install-log', `[WARN] PATH registration: ${pathResult.error}\n`)
    } else {
      mainWindow.webContents.send('install-log',
        pathResult.alreadyExists ? 'PATH entry already exists.\n' : 'PATH entry added.\n')
    }
    mainWindow.webContents.send('install-progress', 80)

    mainWindow.webContents.send('install-log', 'Verifying installation...\n')
    const verifyResult = await verifyInstallation(binDir)
    mainWindow.webContents.send('install-progress', 95)

    if (!verifyResult.ok) {
      mainWindow.webContents.send('install-log', `[FAIL] Verification failed: ${verifyResult.error}\n`)
      return { success: false, error: verifyResult.error }
    }

    mainWindow.webContents.send('install-log',
      `[OK] openclaw --version: ${verifyResult.version}\n`)
    mainWindow.webContents.send('install-progress', 100)

    return { success: true, error: '', version: verifyResult.version }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('copy-launcher-to-desktop', async () => {
  try {
    const assetsPath = getAssetsPath()
    const shSource = path.join(assetsPath, 'OpenClaw启动.sh')
    if (!fs.existsSync(shSource)) {
      return { success: false, error: `Launcher not found: ${shSource}` }
    }
    const desktopDir = path.join(HOME_DIR, 'Desktop')
    const shDest = path.join(desktopDir, 'OpenClaw启动.sh')
    await fs.promises.copyFile(shSource, shDest)
    await fs.promises.chmod(shDest, 0o755)
    return { success: true, path: shDest }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('open-terminal', async () => {
  return new Promise((resolve) => {
    exec(`open -a Terminal "${HOME_DIR}"`, (error) => {
      if (error) {
        resolve({ success: false, error: error.message })
      } else {
        resolve({ success: true })
      }
    })
  })
})

function registerPath(binPath) {
  return new Promise((resolve) => {
    const zshrcPath = path.join(HOME_DIR, '.zshrc')
    const exportLine = `\nexport PATH="${binPath}:$PATH"\n`

    try {
      let content = ''
      if (fs.existsSync(zshrcPath)) {
        content = fs.readFileSync(zshrcPath, 'utf-8')
      }
      if (content.includes(binPath)) {
        resolve({ success: true, alreadyExists: true, error: '' })
        return
      }
      fs.appendFileSync(zshrcPath, exportLine, 'utf-8')
      process.env.PATH = binPath + ':' + process.env.PATH
      resolve({ success: true, alreadyExists: false, error: '' })
    } catch (err) {
      resolve({ success: false, alreadyExists: false, error: err.message })
    }
  })
}

function verifyInstallation(binPath) {
  return new Promise((resolve) => {
    const cmdPath = path.join(binPath, 'openclaw')
    exec(`"${cmdPath}" --version`, { timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ ok: false, version: '', error: error.message })
        return
      }
      const version = (stdout + stderr).trim()
      resolve({ ok: true, version, error: '' })
    })
  })
}

ipcMain.handle('save-api-config', async (_event, apiKeys) => {
  const targetPath = path.join(DATA_DIR, 'openclaw.json')
  const workspacePath = path.join(DATA_DIR, 'workspace')

  try {
    const configTemplate = {
      "meta": {
        "lastTouchedVersion": "2026.5.18",
        "lastTouchedAt": new Date().toISOString()
      },
      "wizard": {
        "lastRunAt": new Date().toISOString(),
        "lastRunVersion": "2026.5.18",
        "lastRunCommand": "onboard",
        "lastRunMode": "local"
      },
      "browser": {
        "enabled": true,
        "defaultProfile": "user",
        "profiles": {
          "user": {
            "cdpPort": 9222,
            "driver": "openclaw",
            "color": "#ff5240"
          }
        }
      },
      "auth": {
        "profiles": {
          "moonshot:default": {
            "provider": "moonshot",
            "mode": "api_key"
          },
          "deepseek:default": {
            "provider": "deepseek",
            "mode": "api_key"
          }
        }
      },
      "models": {
        "mode": "merge",
        "providers": {
          "moonshot": {
            "baseUrl": "https://api.moonshot.cn/v1",
            "api": "openai-completions",
            "apiKey": "",
            "models": [
              {
                "id": "kimi-k2.5",
                "name": "Kimi K2.5",
                "reasoning": false,
                "input": ["text", "image"],
                "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
                "contextWindow": 256000,
                "maxTokens": 8192
              }
            ]
          },
          "deepseek": {
            "baseUrl": "https://api.deepseek.com",
            "api": "openai-completions",
            "apiKey": "",
            "models": [
              {
                "id": "deepseek-v4-flash",
                "name": "DeepSeek V4 Flash",
                "reasoning": true,
                "input": ["text"],
                "contextWindow": 1000000,
                "maxTokens": 384000,
                "cost": { "input": 0.14, "output": 0.28, "cacheRead": 0.028, "cacheWrite": 0 },
                "compat": { "supportsUsageInStreaming": true, "supportsReasoningEffort": true, "maxTokensField": "max_tokens" },
                "api": "openai-completions"
              },
              {
                "id": "deepseek-v4-pro",
                "name": "DeepSeek V4 Pro",
                "reasoning": true,
                "input": ["text"],
                "contextWindow": 1000000,
                "maxTokens": 384000,
                "cost": { "input": 1.74, "output": 3.48, "cacheRead": 0.145, "cacheWrite": 0 },
                "compat": { "supportsUsageInStreaming": true, "supportsReasoningEffort": true, "maxTokensField": "max_tokens" },
                "api": "openai-completions"
              },
              {
                "id": "deepseek-chat",
                "name": "DeepSeek Chat",
                "reasoning": false,
                "input": ["text"],
                "contextWindow": 131072,
                "maxTokens": 8192,
                "cost": { "input": 0.28, "output": 0.42, "cacheRead": 0.028, "cacheWrite": 0 },
                "compat": { "supportsUsageInStreaming": true, "maxTokensField": "max_tokens" },
                "api": "openai-completions"
              },
              {
                "id": "deepseek-reasoner",
                "name": "DeepSeek Reasoner",
                "reasoning": true,
                "input": ["text"],
                "contextWindow": 131072,
                "maxTokens": 65536,
                "cost": { "input": 0.28, "output": 0.42, "cacheRead": 0.028, "cacheWrite": 0 },
                "compat": { "supportsUsageInStreaming": true, "supportsReasoningEffort": false, "maxTokensField": "max_tokens" },
                "api": "openai-completions"
              }
            ]
          }
        }
      },
      "agents": {
        "defaults": {
          "model": { "primary": "deepseek/deepseek-v4-flash" },
          "models": {
            "moonshot/kimi-k2.5": { "alias": "Kimi" },
            "deepseek/deepseek-v4-flash": { "alias": "DeepSeek" }
          },
          "workspace": workspacePath,
          "memorySearch": { "enabled": false },
          "compaction": { "mode": "safeguard" }
        }
      },
      "tools": { "profile": "full", "sessions": { "visibility": "all" } },
      "commands": { "native": "auto", "nativeSkills": "auto", "restart": true, "ownerDisplay": "raw" },
      "session": { "dmScope": "per-channel-peer" },
      "hooks": {
        "internal": {
          "enabled": true,
          "entries": {
            "boot-md": { "enabled": true },
            "bootstrap-extra-files": { "enabled": true },
            "command-logger": { "enabled": true },
            "session-memory": { "enabled": true }
          }
        }
      },
      "channels": {},
      "gateway": {
        "port": 18789,
        "mode": "local",
        "bind": "loopback",
        "auth": { "mode": "token", "token": "YOUR_GATEWAY_AUTH_TOKEN" },
        "tailscale": { "mode": "off", "resetOnExit": false },
        "nodes": {
          "denyCommands": [
            "camera.snap", "camera.clip", "screen.record",
            "contacts.add", "calendar.add", "reminders.add", "sms.send"
          ]
        },
        "controlUi": { "allowInsecureAuth": true }
      },
      "skills": {
        "entries": {
          "apple-notes": { "enabled": false },
          "apple-reminders": { "enabled": true },
          "1password": { "enabled": false },
          "smart-social-publisher": { "enabled": true }
        }
      },
      "mcp": { "servers": {} },
      "plugins": {
        "allow": ["browser", "moonshot", "memory-core", "deepseek"],
        "entries": {
          "moonshot": { "enabled": true },
          "browser": { "enabled": true },
          "memory-core": { "config": { "dreaming": { "enabled": false } }, "enabled": true },
          "deepseek": { "enabled": true }
        },
        "load": { "paths": [] }
      }
    }

    if (apiKeys.moonshotKey) {
      configTemplate.models.providers.moonshot.apiKey = apiKeys.moonshotKey
    }
    if (apiKeys.deepseekKey) {
      configTemplate.models.providers.deepseek.apiKey = apiKeys.deepseekKey
    }

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }

    fs.writeFileSync(targetPath, JSON.stringify(configTemplate, null, 2), 'utf-8')

    return { success: true, error: '' }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('inject-skills', async () => {
  const assetsPath = getAssetsPath()
  const skillsSource = path.join(assetsPath, 'skills')
  const skillsTarget = path.join(DATA_DIR, 'workspace', 'skills')

  if (!fs.existsSync(skillsSource)) {
    return { success: false, error: `Skills source not found: ${skillsSource}` }
  }

  try {
    fse.emptyDirSync(skillsTarget)

    const sourceDirs = fs.readdirSync(skillsSource, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)

    for (const dir of sourceDirs) {
      fse.copySync(path.join(skillsSource, dir), path.join(skillsTarget, dir))
    }

    return {
      success: true,
      total: sourceDirs.length,
      installed: sourceDirs.length,
      installedNames: sourceDirs
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
})
