const initial = () => ({
  busy: false,
  phase: 'idle',
  detail: '空闲',
  startedAt: null,
  updatedAt: Date.now(),
  requestCount: 0,
  lastError: null,
})

let status = initial()

export const resetAgentStatus = () => {
  status = initial()
}

export const setAgentBusy = (detail) => {
  status = {
    ...status,
    busy: true,
    phase: 'running',
    detail,
    startedAt: Date.now(),
    updatedAt: Date.now(),
    requestCount: status.requestCount + 1,
    lastError: null,
  }
}

export const updateAgentPhase = (phase, detail) => {
  status = {
    ...status,
    phase,
    detail,
    updatedAt: Date.now(),
  }
}

export const setAgentError = (error) => {
  status = {
    ...status,
    busy: false,
    phase: 'error',
    detail: '请求失败',
    updatedAt: Date.now(),
    lastError: error,
  }
}

export const setAgentDone = (detail = '已完成') => {
  status = {
    ...status,
    busy: false,
    phase: 'done',
    detail,
    updatedAt: Date.now(),
  }
}

export const getAgentStatus = () => status
