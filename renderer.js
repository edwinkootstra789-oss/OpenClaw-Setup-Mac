const api = window.openclawAPI
const $ = (s) => document.querySelector(s)
const $$ = (s) => document.querySelectorAll(s)

let lockAttempts = 0
const MAX_LOCK_ATTEMPTS = 3

async function handleLockSubmit() {
  const input = $('#lock-password').value
  const errEl = $('#lock-error')
  const attemptsEl = $('#lock-attempts')
  const submitBtn = $('#lock-submit')
  const passwordInput = $('#lock-password')

  if (!input) {
    errEl.textContent = '请输入密码'
    return
  }

  if (lockAttempts >= MAX_LOCK_ATTEMPTS) return

  submitBtn.disabled = true
  submitBtn.textContent = '验证中...'

  const result = await api.verifyPassword(input)

  if (result.ok) {
    errEl.textContent = ''
    attemptsEl.textContent = ''
    $('#lock-page').classList.remove('visible')
    return
  }

  lockAttempts++
  const remaining = MAX_LOCK_ATTEMPTS - lockAttempts

  if (remaining > 0) {
    errEl.textContent = '密码错误'
    attemptsEl.textContent = `剩余尝试次数：${remaining}`
    passwordInput.value = ''
    passwordInput.focus()
    submitBtn.disabled = false
    submitBtn.textContent = '验证'
  } else {
    errEl.textContent = '错误次数过多，安装向导已锁定'
    attemptsEl.textContent = '请关闭后重新启动安装向导'
    passwordInput.disabled = true
    submitBtn.disabled = true
    submitBtn.textContent = '已锁定'
  }
}

$('#lock-submit').addEventListener('click', handleLockSubmit)
$('#lock-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleLockSubmit()
})
$('#lock-close').addEventListener('click', () => {
  api.windowClose()
})

let currentStep = 1
const TOTAL_STEPS = 6
let depsAllPassed = false
let installCompleted = false
let keepExisting = false
let skipApiConfig = false
let skillsInjected = false
let removeLogListener = null
let removeProgressListener = null

function switchStep(newStep) {
  if (newStep < 1 || newStep > TOTAL_STEPS) return
  if (newStep > currentStep && !canProceed()) return

  $(`#step-${currentStep}`).classList.remove('visible')
  currentStep = newStep
  $(`#step-${currentStep}`).classList.add('visible')

  updateNavButtons()
  onStepEnter(currentStep)
}

function canProceed() {
  if (currentStep === 1) return $('#eula-check').checked
  if (currentStep === 2) return depsAllPassed
  if (currentStep === 3) return installCompleted || keepExisting
  return true
}

function updateStepIndicator() {
  $$('.step-dot').forEach((dot) => {
    const s = parseInt(dot.dataset.step)
    dot.classList.remove('done', 'active')
    if (s < currentStep) dot.classList.add('done')
    if (s === currentStep) dot.classList.add('active')
    if (s < currentStep) dot.textContent = '✓'
    else dot.textContent = s
  })

  $$('.step-line').forEach((line) => {
    const s = parseInt(line.dataset.line)
    line.classList.remove('done')
    if (s < currentStep) line.classList.add('done')
  })

  $$('.step-label').forEach((label) => {
    const s = parseInt(label.dataset.label)
    label.classList.remove('done', 'active')
    if (s < currentStep) label.classList.add('done')
    if (s === currentStep) label.classList.add('active')
  })
}

function updateNavButtons() {
  const btnBack = $('#btn-back')
  const btnNext = $('#btn-next')

  btnBack.style.display = currentStep > 1 ? '' : 'none'

  if (currentStep === TOTAL_STEPS) {
    btnNext.style.display = 'none'
    return
  }

  btnNext.style.display = ''
  btnNext.textContent = '下一步'

  if (currentStep === 1) {
    btnNext.disabled = !$('#eula-check').checked
  } else if (currentStep === 2) {
    btnNext.disabled = !depsAllPassed
    btnNext.textContent = depsAllPassed ? '下一步' : '请安装必要环境后重试'
  } else if (currentStep === 3) {
    btnNext.disabled = !(installCompleted || keepExisting)
    if (keepExisting) {
      btnNext.textContent = '下一步'
    } else {
      btnNext.textContent = installCompleted ? '下一步' : '请先完成安装'
    }
  } else if (currentStep === 5) {
    btnNext.disabled = false
    btnNext.textContent = '下一步'
  } else {
    btnNext.disabled = false
  }
}

async function onStepEnter(step) {
  switch (step) {
    case 2: await initDependencyCheck(); break
    case 3: await initInstallPage(); break
    case 5: initSkillsPage(); break
    case 6: await initFinishPage(); break
  }
}

/* ===== Step 1: EULA ===== */
$('#eula-check').addEventListener('change', () => {
  if (currentStep === 1) updateNavButtons()
})

/* ===== Step 2: Dependencies ===== */
async function initDependencyCheck() {
  depsAllPassed = false
  updateNavButtons()

  setDepStatus('node', 'checking', '检测中...')
  setDepStatus('python', 'checking', '检测中...')
  setDepStatus('git', 'checking', '检测中...')
  $('#retry-hint').classList.remove('visible')

  try {
    const results = await api.checkDependencies()
    renderDepResult('node', results.node)
    renderDepResult('python', results.python)
    renderDepResult('git', results.git)

    depsAllPassed = results.node.ok && results.python.ok && results.git.ok
    if (!depsAllPassed) {
      $('#retry-hint').classList.add('visible')
    }
    updateNavButtons()
    return results
  } catch (err) {
    setDepStatus('node', 'fail', '检测失败')
    setDepStatus('python', 'fail', '检测失败')
    setDepStatus('git', 'fail', '检测失败')
    $('#retry-hint').classList.add('visible')
  }
}

$('#btn-retry').addEventListener('click', async () => {
  const btn = $('#btn-retry')
  const btnText = $('#btn-retry-text')

  btn.disabled = true
  btn.classList.add('loading')
  btnText.textContent = '正在检测中...'

  try {
    await initDependencyCheck()
  } finally {
    btn.disabled = false
    btn.classList.remove('loading')
    btnText.textContent = '🔄 重新检测'
  }
})

function setDepStatus(name, state, text) {
  const container = $(`#status-${name}`)
  container.innerHTML = state === 'checking'
    ? '<div class="status-spinner"></div><span class="status-badge checking">' + text + '</span>'
    : '<span class="status-badge ' + (state === 'ok' ? 'ok' : 'fail') + '">' + text + '</span>'
}

function renderDepResult(name, result) {
  if (result.ok) {
    setDepStatus(name, 'ok', result.version)
  } else {
    setDepStatus(name, 'fail', result.error || '未安装')
  }
}

/* ===== Step 3: Installation ===== */
let installPath = ''

async function initInstallPage() {
  keepExisting = false
  skipApiConfig = false
  installCompleted = false
  updateNavButtons()

  $('#skip-api-config-check').checked = false
  $('#skip-config-row').style.display = 'none'

  $('#install-progress').style.width = '0%'
  $('#install-progress-pct').textContent = '0%'
  $('#install-progress-pct').classList.remove('visible')
  $('#console-output').textContent = ''
  $('#install-result').style.display = 'none'
  $('#btn-start-install').disabled = true
  $('#btn-start-install').textContent = '安装 OpenClaw'
  $('#btn-start-install').style.display = ''

  if (removeLogListener) { removeLogListener(); removeLogListener = null }
  if (removeProgressListener) { removeProgressListener(); removeProgressListener = null }

  try {
    installPath = await api.getInstallDir()
    $('#install-path-display').textContent = installPath
  } catch (e) {
    $('#install-path-display').textContent = '（无法获取路径）'
  }

  // Version detection
  $('#version-checking').style.display = ''
  $('#version-compare').style.display = 'none'

  try {
    const versions = await api.checkOpenclawVersions()
    $('#ver-existing').textContent = versions.hasExisting ? versions.existingVersion : '未安装'
    $('#ver-package').textContent = versions.packageVersion || '—'
    $('#desc-existing').textContent = versions.hasExisting
      ? '已安装在 ' + versions.existingVersion
      : '未检测到安装记录'

    $('#version-checking').style.display = 'none'
    $('#version-compare').style.display = ''

    if (versions.hasExisting) {
      $('#no-existing-msg').style.display = 'none'
      $('#card-existing').style.display = ''
      $('#card-package').style.display = ''
      $('#card-existing').classList.remove('selected')
      $('#card-package').classList.remove('selected')
    } else {
      $('#card-existing').style.display = 'none'
      $('#card-package').style.display = 'none'
      $('#no-existing-msg').style.display = ''
      $('#btn-start-install').disabled = false
    }
  } catch (e) {
    $('#ver-existing').textContent = '检测失败'
    $('#ver-package').textContent = '—'
    $('#version-checking').style.display = 'none'
    $('#version-compare').style.display = ''
    $('#card-existing').style.display = 'none'
    $('#card-package').style.display = 'none'
    $('#no-existing-msg').style.display = ''
    $('#btn-start-install').disabled = false
  }
}

$$('.version-card-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const choice = btn.dataset.choice
    $$('.version-card').forEach(c => c.classList.remove('selected'))
    btn.closest('.version-card').classList.add('selected')

    if (choice === 'keep') {
      keepExisting = true
      installCompleted = false
      skipApiConfig = $('#skip-api-config-check').checked
      $('#btn-start-install').style.display = 'none'
      $('#skip-config-row').style.display = ''
      $('#install-progress').style.width = '0%'
      $('#install-progress-pct').textContent = '0%'
      $('#install-progress-pct').classList.remove('visible')
      $('#console-output').textContent = ''
      $('#install-result').style.display = 'none'
      updateNavButtons()
    } else {
      keepExisting = false
      skipApiConfig = false
      $('#skip-api-config-check').checked = false
      $('#skip-config-row').style.display = 'none'
      $('#btn-start-install').style.display = ''
      $('#btn-start-install').disabled = false
      updateNavButtons()
    }
  })
})

$('#skip-api-config-check').addEventListener('change', () => {
  skipApiConfig = $('#skip-api-config-check').checked
})

$('#btn-choose-dir').addEventListener('click', async () => {
  try {
    const result = await api.selectInstallDir()
    if (result.canceled || !result.path) return
    await api.setInstallDir(result.path)
    installPath = result.path
    $('#install-path-display').textContent = installPath
    $('#btn-start-install').disabled = false
  } catch (e) {
    $('#install-path-display').textContent = '选择失败: ' + e.message
  }
})

$('#btn-start-install').addEventListener('click', async () => {
  const btn = $('#btn-start-install')
  btn.disabled = true
  btn.textContent = '正在安装...'
  $('#console-output').textContent = ''
  $('#install-result').style.display = 'none'
  $('#install-progress').style.width = '0%'
  $('#install-progress-pct').textContent = '0%'
  $('#install-progress-pct').classList.add('visible')

  removeLogListener = api.onInstallLog((data) => {
    const consoleEl = $('#console-output')
    consoleEl.textContent += data
    consoleEl.scrollTop = consoleEl.scrollHeight
  })

  removeProgressListener = api.onInstallProgress((pct) => {
    $('#install-progress').style.width = pct + '%'
    $('#install-progress-pct').textContent = pct + '%'
  })

  try {
    const result = await api.installOpenclaw()
    if (result.success) {
      $('#install-progress').style.width = '100%'
      $('#install-progress-pct').textContent = '100%'
      $('#console-output').textContent += '\n\n── 安装成功 ──\n'
      keepExisting = false
      installCompleted = true
      $('#btn-start-install').style.display = 'none'
      $('#install-result').style.display = ''
      $('#install-result-icon').textContent = '✓'
      $('#install-result-icon').style.color = 'var(--success)'
      $('#install-result-text').textContent = 'OpenClaw ' + (result.version || '') + ' 安装成功！系统 PATH 已配置，重启终端后可直接使用 openclaw 命令。'
      updateNavButtons()
    } else {
      $('#console-output').textContent += '\n\n✕ 安装失败: ' + result.error + '\n'
      btn.disabled = false
      btn.textContent = '重新安装'
      $('#install-result').style.display = ''
      $('#install-result-icon').textContent = '✕'
      $('#install-result-icon').style.color = 'var(--danger)'
      $('#install-result-text').textContent = result.error
    }
  } catch (err) {
    $('#console-output').textContent += '\n\n✕ 出现异常: ' + err.message + '\n'
    btn.disabled = false
    btn.textContent = '重新安装'
    $('#install-result').style.display = ''
    $('#install-result-icon').textContent = '✕'
    $('#install-result-icon').style.color = 'var(--danger)'
    $('#install-result-text').textContent = err.message
  }
})

/* ===== Step 4: API Config ===== */
$('#api-moonshot').addEventListener('input', () => {
  if (currentStep === 4) {
    const hasAnyKey = $('#api-moonshot').value.trim() || $('#api-deepseek').value.trim()
    $('#btn-next').disabled = false
  }
})

$('#api-deepseek').addEventListener('input', () => {
  if (currentStep === 4) {
    const hasAnyKey = $('#api-moonshot').value.trim() || $('#api-deepseek').value.trim()
    $('#btn-next').disabled = false
  }
})

async function saveApiConfigAndProceed() {
  const moonshotKey = $('#api-moonshot').value.trim()
  const deepseekKey = $('#api-deepseek').value.trim()

  try {
    const result = await api.saveApiConfig({ moonshotKey, deepseekKey })
    if (!result.success) {
      alert('配置保存失败: ' + result.error)
      return false
    }
    return true
  } catch (err) {
    alert('配置保存异常: ' + err.message)
    return false
  }
}

/* ===== Step 5: Skills ===== */
function initSkillsPage() {
  if (skillsInjected) {
    $('#skills-idle').style.display = 'none'
    $('#skills-loading').style.display = 'none'
    $('#skills-result').style.display = ''
    $('#skills-done').style.display = ''
    return
  }
  $('#skills-idle').style.display = ''
  $('#skills-loading').style.display = 'none'
  $('#skills-result').style.display = 'none'
  $('#skills-done').style.display = 'none'
  updateNavButtons()
}

$('#btn-inject-skills').addEventListener('click', async () => {
  $('#skills-idle').style.display = 'none'
  $('#skills-loading').style.display = ''
  $('#skills-result').style.display = 'none'
  $('#skills-done').style.display = 'none'
  $('#skills-status-text').textContent = '正在注入技能...'
  $('#skills-summary-txt').textContent = ''
  $('#skills-list-container').innerHTML = ''

  let result
  try {
    result = await api.injectSkills()
  } catch (err) {
    $('#skills-loading').style.display = 'none'
    $('#skills-idle').style.display = ''
    $('#skills-idle-hint').textContent = '注入失败: ' + err.message
    $('#skills-idle-hint').style.color = 'var(--error, #ff5240)'
    return
  }

  if (!result.success) {
    $('#skills-loading').style.display = 'none'
    $('#skills-idle').style.display = ''
    $('#skills-idle-hint').textContent = '注入失败: ' + result.error
    $('#skills-idle-hint').style.color = 'var(--error, #ff5240)'
    return
  }

  skillsInjected = true
  $('#skills-loading').style.display = 'none'

  $('#skills-result').style.display = ''
  $('#skills-summary-txt').innerHTML =
    `共 <b>${result.total}</b> 个预设技能，全部已安装`

  const container = $('#skills-list-container')
  container.innerHTML = ''

  let delay = 0
  for (const name of result.installedNames) {
    const row = document.createElement('div')
    row.className = 'skill-row installed'
    row.style.animationDelay = delay + 'ms'
    row.innerHTML =
      '<span class="skill-name">' + name + '</span>' +
      '<span class="skill-tag new">✓ 已安装</span>'
    container.appendChild(row)
    delay += 60
  }

  setTimeout(() => {
    $('#skills-done').style.display = ''
  }, delay + 200)

  updateNavButtons()
})

/* ===== Step 6: Finish ===== */
async function initFinishPage() {
  const homeDir = await api.getHomeDir()
  const dataDir = homeDir + '\\.openclaw'

  let desktopStatus = ''
  const launcherResult = await api.copyLauncherToDesktop()
  if (launcherResult.success) {
    desktopStatus = '启动快捷方式已放置到桌面。<br>'
  } else {
    desktopStatus = '启动快捷方式放置失败，可手动运行 openclaw gateway 启动。<br>'
  }

  $('#btn-desktop-status').innerHTML =
    desktopStatus +
    '程序安装至：<b>' + installPath + '</b><br>' +
    '数据存储至：<b>' + dataDir + '</b><br>' +
    '系统 PATH 已配置，重启终端后可直接运行 <code>openclaw</code> 命令。'
}

$('#btn-exit').addEventListener('click', () => {
  api.windowClose()
})

function updateInitSteps() {
  const totalSteps = 4
  let allDone = true

  for (let i = 1; i <= totalSteps; i++) {
    const stepEl = document.querySelector(`.init-step[data-step="${i}"]`)
    const checkbox = document.querySelector(`.init-confirm[data-step="${i}"]`)
    if (!stepEl || !checkbox) continue

    const prevChecked = i === 1 || document.querySelector(`.init-confirm[data-step="${i - 1}"]`).checked

    if (checkbox.checked) {
      stepEl.classList.remove('active')
      stepEl.classList.add('done')
    } else {
      allDone = false
      if (prevChecked) {
        stepEl.classList.add('active')
        stepEl.classList.remove('done')
      } else {
        stepEl.classList.remove('active', 'done')
      }
    }

    checkbox.disabled = !prevChecked
  }

  const btnExit = $('#btn-exit')
  if (allDone) {
    btnExit.disabled = false
    btnExit.textContent = '完成'
  } else {
    btnExit.disabled = true
    btnExit.textContent = '请先完成上述步骤'
  }
}

document.querySelectorAll('.init-confirm').forEach(cb => {
  cb.addEventListener('change', updateInitSteps)
})
updateInitSteps()

document.querySelectorAll('.btn-copy-code').forEach(btn => {
  btn.addEventListener('click', () => {
    const text = btn.getAttribute('data-copy')
    navigator.clipboard.writeText(text).then(() => {
      btn.textContent = '已复制'
      setTimeout(() => { btn.textContent = '复制' }, 1500)
    })
  })
})

$('#btn-open-terminal').addEventListener('click', async () => {
  await api.openTerminal()
})

/* ===== Navigation ===== */
$('#btn-next').addEventListener('click', async () => {
  if (currentStep === 2 && !depsAllPassed) {
    await initDependencyCheck()
    return
  }

  if (currentStep === 3 && keepExisting && skipApiConfig) {
    $(`#step-${currentStep}`).classList.remove('visible')
    currentStep = 5
    $(`#step-${currentStep}`).classList.add('visible')
    updateNavButtons()
    onStepEnter(currentStep)
    return
  }

  if (currentStep === 4) {
    const saved = await saveApiConfigAndProceed()
    if (!saved) return
  }

  switchStep(currentStep + 1)
})

$('#btn-back').addEventListener('click', () => {
  if (currentStep === 5 && keepExisting) {
    $(`#step-${currentStep}`).classList.remove('visible')
    currentStep = 3
    $(`#step-${currentStep}`).classList.add('visible')
    updateNavButtons()
    onStepEnter(currentStep)
    return
  }
  switchStep(currentStep - 1)
})

$('#btn-cancel').addEventListener('click', () => {
  if (currentStep >= 3 && !installCompleted) {
    const ok = confirm('安装尚未完成，确定要退出吗？')
    if (!ok) return
  }
  api.windowClose()
})

/* ===== Titlebar ===== */
$('#btn-minimize').addEventListener('click', () => {
  api.windowMinimize()
})

$('#btn-maximize').addEventListener('click', () => {
  api.windowMaximize()
})

$('#btn-close').addEventListener('click', () => {
  if (currentStep >= 3 && !installCompleted) {
    const ok = confirm('安装尚未完成，确定要退出吗？')
    if (!ok) return
  }
  api.windowClose()
})

/* ===== Init ===== */
updateNavButtons()
