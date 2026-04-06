import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

const SAFE_PREFIXES = [
  'ls',
  'cat',
  'head',
  'tail',
  'wc',
  'pwd',
  'echo',
  'printf',
  'date',
  'which',
  'type',
  'env',
  'printenv',
  'uname',
  'whoami',
  'id',
  'git status',
  'git log',
  'git diff',
  'git show',
  'find ',
  'grep ',
  'rg ',
]

export const parseToolArgs = (raw) => {
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed?.command !== 'string' || parsed.command.trim().length === 0) {
      throw new Error('参数 command 缺失')
    }
    const timeout = typeof parsed.timeout === 'number' ? parsed.timeout : undefined
    return { command: parsed.command, timeout }
  } catch {
    throw new Error(`工具参数不是合法 JSON: ${raw}`)
  }
}

const isSafeBashCommand = (command) => {
  const normalized = String(command ?? '').trim()
  return SAFE_PREFIXES.some((prefix) => normalized.startsWith(prefix))
}

const runBash = async (command, timeoutSec, onPhase) => {
  onPhase('tool-running', `Bash: ${command.slice(0, 80)}`)
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: timeoutSec * 1000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    })
    const output = [stdout, stderr ? `[stderr]\n${stderr}` : ''].filter(Boolean).join('\n').trim()
    return output || '(no output)'
  } catch (error) {
    if (error instanceof Error && 'stdout' in error && 'stderr' in error) {
      const output = [error.stdout, error.stderr ? `[stderr]\n${error.stderr}` : ''].filter(Boolean).join('\n').trim()
      return output || `Error: ${error.message}`
    }
    return `Error: ${String(error)}`
  }
}

export const executeBashWithPolicy = async ({
  command,
  timeoutSec,
  traces,
  permissionMode,
  onPhase,
}) => {
  onPhase('tool-check', `校验命令权限: ${command.slice(0, 80)}`)
  traces.push({ phase: 'start', tool: 'Bash', command, timeoutSec })

  const acceptAll = permissionMode === 'accept-all'
  const granted = acceptAll || isSafeBashCommand(command)
  const output = granted
    ? await runBash(command, timeoutSec, onPhase)
    : 'Denied: 当前前端面板只允许安全命令。可设置 NANO_PERMISSION_MODE=accept-all 关闭限制。'

  traces.push({
    phase: 'end',
    tool: 'Bash',
    command,
    timeoutSec,
    granted,
    resultPreview: output,
  })

  return { output, granted }
}
