import process from 'node:process'

export type PermissionMode = 'manual' | 'accept-all'

export interface CliConfig {
  model: string
  maxTokens: number
  permissionMode: PermissionMode
  timeoutSec: number
  openaiApiKey: string
  openaiBaseUrl?: string
}

export const loadConfig = (): CliConfig => {
  return {
    model: process.env.NANO_MODEL ?? 'gpt-4o-mini',
    maxTokens: Number(process.env.NANO_MAX_TOKENS ?? 4096),
    permissionMode: (process.env.NANO_PERMISSION_MODE === 'accept-all' ? 'accept-all' : 'manual'),
    timeoutSec: Number(process.env.NANO_BASH_TIMEOUT_SEC ?? 30),
    openaiApiKey: process.env.OPENAI_API_KEY ?? '',
    openaiBaseUrl: process.env.OPENAI_BASE_URL,
  }
}

export const ensureConfig = (config: CliConfig): void => {
  if (!config.openaiApiKey) {
    throw new Error('缺少 OPENAI_API_KEY，请先设置环境变量后再运行。')
  }
  if (Number.isNaN(config.maxTokens) || config.maxTokens <= 0) {
    throw new Error('NANO_MAX_TOKENS 必须是正整数。')
  }
  if (Number.isNaN(config.timeoutSec) || config.timeoutSec <= 0) {
    throw new Error('NANO_BASH_TIMEOUT_SEC 必须是正整数。')
  }
}
