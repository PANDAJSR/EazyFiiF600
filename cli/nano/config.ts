import process from 'node:process'
import OpenAI, { AzureOpenAI } from 'openai'

export type PermissionMode = 'manual' | 'accept-all'
export type ProviderMode = 'openai' | 'azure'

export interface CliConfig {
  model: string
  maxTokens: number
  permissionMode: PermissionMode
  timeoutSec: number
  provider: ProviderMode
  openaiApiKey: string
  openaiBaseUrl?: string
  azureApiKey: string
  azureEndpoint: string
  azureApiVersion: string
  azureDeployment?: string
}

export interface ClientBundle {
  client: OpenAI
  model: string
  provider: ProviderMode
}

export const loadConfig = (): CliConfig => {
  const azureApiVersion =
    process.env.AZURE_OPENAI_API_VERSION ??
    process.env.OPENAI_API_VERSION ??
    '2024-10-21'
  const providerEnv = process.env.NANO_PROVIDER
  const provider: ProviderMode =
    providerEnv === 'azure' || providerEnv === 'openai'
      ? providerEnv
      : (process.env.AZURE_OPENAI_ENDPOINT ? 'azure' : 'openai')

  return {
    model: process.env.NANO_MODEL ?? 'gpt-4o-mini',
    maxTokens: Number(process.env.NANO_MAX_TOKENS ?? 4096),
    permissionMode: (process.env.NANO_PERMISSION_MODE === 'accept-all' ? 'accept-all' : 'manual'),
    timeoutSec: Number(process.env.NANO_BASH_TIMEOUT_SEC ?? 30),
    provider,
    openaiApiKey: process.env.OPENAI_API_KEY ?? '',
    openaiBaseUrl: process.env.OPENAI_BASE_URL,
    azureApiKey: process.env.AZURE_OPENAI_API_KEY ?? '',
    azureEndpoint: process.env.AZURE_OPENAI_ENDPOINT ?? '',
    azureApiVersion,
    azureDeployment: process.env.AZURE_OPENAI_DEPLOYMENT || process.env.NANO_AZURE_DEPLOYMENT,
  }
}

export const ensureConfig = (config: CliConfig): void => {
  if (config.provider === 'openai' && !config.openaiApiKey) {
    throw new Error('缺少 OPENAI_API_KEY，请先设置环境变量后再运行。')
  }
  if (config.provider === 'azure') {
    if (!config.azureApiKey) {
      throw new Error('缺少 AZURE_OPENAI_API_KEY，请先设置环境变量后再运行。')
    }
    if (!config.azureEndpoint) {
      throw new Error('缺少 AZURE_OPENAI_ENDPOINT，请先设置环境变量后再运行。')
    }
  }
  if (Number.isNaN(config.maxTokens) || config.maxTokens <= 0) {
    throw new Error('NANO_MAX_TOKENS 必须是正整数。')
  }
  if (Number.isNaN(config.timeoutSec) || config.timeoutSec <= 0) {
    throw new Error('NANO_BASH_TIMEOUT_SEC 必须是正整数。')
  }
}

export const createClientBundle = (config: CliConfig): ClientBundle => {
  if (config.provider === 'azure') {
    const model = config.azureDeployment ?? config.model
    const client = new AzureOpenAI({
      apiKey: config.azureApiKey,
      endpoint: config.azureEndpoint,
      apiVersion: config.azureApiVersion,
      deployment: config.azureDeployment,
    })
    return { client, model, provider: 'azure' }
  }

  const client = new OpenAI({
    apiKey: config.openaiApiKey,
    baseURL: config.openaiBaseUrl,
  })
  return { client, model: config.model, provider: 'openai' }
}
