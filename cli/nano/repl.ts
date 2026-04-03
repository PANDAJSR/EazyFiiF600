import process from 'node:process'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { cwd } from 'node:process'
import { createAgentState, runAgentTurn } from './agent.ts'
import { createClientBundle, ensureConfig, loadConfig, type CliConfig } from './config.ts'

const SYSTEM_PROMPT = `你是一个命令行编码助手，运行在 Node.js 里。
你只允许使用 Bash 工具，不要假装执行命令。
在执行危险命令前，先解释风险并等待权限。`

const printHelp = (): void => {
  console.log('\n可用命令:')
  console.log('  /help                 查看帮助')
  console.log('  /exit                 退出')
  console.log('  /model [name]         查看或设置模型')
  console.log('  /permissions [mode]   查看或设置权限模式(manual|accept-all)')
  console.log('  /clear                清空会话')
}

const askPermission = async (rl: readline.Interface, description: string): Promise<boolean> => {
  const answer = await rl.question(`\n[权限请求] ${description}\n允许执行? (y/N): `)
  return ['y', 'yes'].includes(answer.trim().toLowerCase())
}

const handleSlash = (line: string, config: CliConfig, clearMessages: () => void): boolean => {
  if (!line.startsWith('/')) {
    return false
  }

  const [command, ...rest] = line.slice(1).trim().split(/\s+/)
  const args = rest.join(' ').trim()

  if (command === 'help') {
    printHelp()
    return true
  }

  if (command === 'exit' || command === 'quit') {
    process.exit(0)
  }

  if (command === 'model') {
    if (!args) {
      console.log(`当前模型: ${config.model}`)
      return true
    }
    config.model = args
    console.log(`模型已切换为: ${config.model}`)
    return true
  }

  if (command === 'permissions') {
    if (!args) {
      console.log(`当前权限模式: ${config.permissionMode}`)
      return true
    }
    if (args !== 'manual' && args !== 'accept-all') {
      console.log('权限模式仅支持 manual 或 accept-all')
      return true
    }
    config.permissionMode = args
    console.log(`权限模式已切换为: ${config.permissionMode}`)
    return true
  }

  if (command === 'clear') {
    clearMessages()
    console.log('会话已清空。')
    return true
  }

  console.log(`未知命令: /${command}，输入 /help 查看可用命令。`)
  return true
}

export const startRepl = async (): Promise<void> => {
  const config = loadConfig()
  ensureConfig(config)

  const clientBundle = createClientBundle(config)
  const client = clientBundle.client
  config.model = clientBundle.model

  const state = createAgentState()
  state.messages.push({ role: 'system', content: SYSTEM_PROMPT })

  const rl = readline.createInterface({ input, output })

  console.log('Nano Bash CLI (TS)')
  console.log(`cwd: ${cwd()}`)
  console.log(`provider: ${clientBundle.provider}`)
  console.log(`model: ${config.model}`)
  console.log(`permissions: ${config.permissionMode}`)
  console.log('输入 /help 查看命令。\n')

  try {
    while (true) {
      const line = (await rl.question('> ')).trim()
      if (!line) {
        continue
      }

      if (handleSlash(line, config, () => {
        state.messages = [{ role: 'system', content: SYSTEM_PROMPT }]
      })) {
        continue
      }

      try {
        const result = await runAgentTurn(client, state, line, config, async (description) => {
          return askPermission(rl, description)
        })
        if (result.answer) {
          console.log(`\n${result.answer}\n`)
        } else {
          console.log('\n(模型未返回文本内容)\n')
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`\n[错误] ${message}\n`)
      }
    }
  } finally {
    rl.close()
  }
}
