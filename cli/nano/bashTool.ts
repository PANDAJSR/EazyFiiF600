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

export const isSafeBashCommand = (command: string): boolean => {
  const normalized = command.trim()
  return SAFE_PREFIXES.some((prefix) => normalized.startsWith(prefix))
}

export const runBash = async (command: string, timeoutSec: number): Promise<string> => {
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
      const withStreams = error as Error & { stdout?: string; stderr?: string }
      const output = [withStreams.stdout, withStreams.stderr ? `[stderr]\n${withStreams.stderr}` : '']
        .filter(Boolean)
        .join('\n')
        .trim()
      if (output) {
        return output
      }
      return `Error: ${error.message}`
    }
    return `Error: ${String(error)}`
  }
}
