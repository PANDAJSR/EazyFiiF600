import { useEffect } from 'react'

type Params = {
  blockId?: string
  fieldKey?: string
  selectAll?: boolean
  onFocused?: () => void
}

function useFocusBlockFirstInput({ blockId, fieldKey, selectAll = false, onFocused }: Params) {
  useEffect(() => {
    if (!blockId) {
      return
    }

    let frameId = 0
    let retryTimer = 0
    let attempts = 0

    const tryFocus = () => {
      attempts += 1
      const selector = fieldKey
        ? `input[data-block-id="${blockId}"][data-field-key="${fieldKey}"]`
        : `input[data-block-id="${blockId}"][data-slot-index="0"]`
      const input = document.querySelector<HTMLInputElement>(selector)
      if (input) {
        input.focus()
        if (selectAll) {
          input.select()
        } else {
          const cursorPos = input.value.length
          input.setSelectionRange(cursorPos, cursorPos)
        }
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
  }, [blockId, fieldKey, onFocused, selectAll])
}

export default useFocusBlockFirstInput
