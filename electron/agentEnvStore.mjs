import fs from 'node:fs/promises'

const ALLOWED_AGENT_ENV_KEYS = [
  'NANO_PROVIDER',
  'NANO_MODEL',
  'NANO_PERMISSION_MODE',
  'NANO_BASH_TIMEOUT_SEC',
  'NANO_OPENAI_TIMEOUT_MS',
  'NANO_AGENT_REQUEST_TIMEOUT_MS',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_OPENAI_API_KEY',
  'AZURE_OPENAI_API_VERSION',
  'AZURE_OPENAI_DEPLOYMENT',
]

const isAllowedKey = (key) => ALLOWED_AGENT_ENV_KEYS.includes(key)

const sanitizeValues = (input) => {
  if (!input || typeof input !== 'object') {
    return {}
  }
  const next = {}
  for (const [key, value] of Object.entries(input)) {
    if (!isAllowedKey(key)) {
      continue
    }
    if (typeof value !== 'string') {
      continue
    }
    next[key] = value
  }
  return next
}

export const createAgentEnvStore = (filePath) => {
  let values = {}

  const load = async () => {
    try {
      const raw = await fs.readFile(filePath, 'utf8')
      values = sanitizeValues(JSON.parse(raw))
    } catch {
      values = {}
    }
  }

  const save = async () => {
    await fs.writeFile(filePath, `${JSON.stringify(values, null, 2)}\n`, 'utf8')
  }

  const get = () => ({ ...values })

  const setMany = async (patchValues) => {
    const sanitizedPatch = sanitizeValues(patchValues)
    const next = { ...values }
    for (const [key, value] of Object.entries(sanitizedPatch)) {
      if (!value.trim()) {
        delete next[key]
      } else {
        next[key] = value
      }
    }
    values = next
    await save()
    return get()
  }

  return {
    load,
    get,
    setMany,
    allowedKeys: [...ALLOWED_AGENT_ENV_KEYS],
  }
}
