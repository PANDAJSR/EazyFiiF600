import { useEffect } from 'react'

type Params = {
  blockId?: string
  onFocused?: () => void
}

function useFocusBlockFirstInput({ blockId, onFocused }: Params) {
  useEffect(() => {
    if (!blockId) {
      return
    }

    let frameId = 0
    let retryTimer = 0
    let attempts = 0

    const tryFocus = () => {
      attempts += 1
      const input = document.querySelector<HTMLInputElement>(`input[data-block-id="${blockId}"][data-slot-index="0"]`)
      if (input) {
        input.focus()
        const cursorPos = input.value.length
        input.setSelectionRange(cursorPos, cursorPos)
        onFocused?.()
        return
      }
      if (attempts >= 6) {
        onFocused?.()
        return
      }
      retryTimer = window.setTimeout(() => {
        frameId = window.requestAnimationFrame(tryFocus)
      }, 30)
    }

    frameId = window.requestAnimationFrame(tryFocus)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.clearTimeout(retryTimer)
    }
  }, [blockId, onFocused])
}

export default useFocusBlockFirstInput
