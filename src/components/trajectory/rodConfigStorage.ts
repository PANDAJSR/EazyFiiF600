import { readDesktopTextFile, writeDesktopTextFile } from '../../utils/desktopBridge'
import { normalizeRodConfig, type RodConfig } from './rodConfig'

const CONFIG_FILE_NAME = 'eazyfii_config.json'
const CONFIG_VERSION = 1

type PersistedRodConfig = {
  version: number
  updatedAt: string
  rodConfig: RodConfig
}

const parseRodConfig = (rawText: string): RodConfig | null => {
  try {
    const parsed = JSON.parse(rawText) as unknown
    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    const candidate = 'rodConfig' in parsed ? (parsed as { rodConfig?: unknown }).rodConfig : parsed
    return normalizeRodConfig(candidate)
  } catch {
    return null
  }
}

export const loadRodConfigFromDirectory = async (directoryPath: string): Promise<RodConfig | null> => {
  try {
    const content = await readDesktopTextFile({
      directoryPath,
      relativePath: CONFIG_FILE_NAME,
    })

    if (!content) {
      return null
    }

    return parseRodConfig(content)
  } catch {
    return null
  }
}

export const saveRodConfigToDirectory = async (
  directoryPath: string,
  rodConfig: RodConfig,
): Promise<boolean> => {
  const payload: PersistedRodConfig = {
    version: CONFIG_VERSION,
    updatedAt: new Date().toISOString(),
    rodConfig,
  }

  try {
    return await writeDesktopTextFile({
      directoryPath,
      relativePath: CONFIG_FILE_NAME,
      content: `${JSON.stringify(payload, null, 2)}\n`,
    })
  } catch {
    return false
  }
}
