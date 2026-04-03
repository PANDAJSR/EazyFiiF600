import { startRepl } from './nano/repl.ts'

startRepl().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[启动失败] ${message}`)
  process.exit(1)
})
