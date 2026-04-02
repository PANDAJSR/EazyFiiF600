import { useEffect, useRef } from 'react'

type Params = {
  enabled?: boolean
  pathDrawingMode: boolean
  onToggle: (enabled: boolean) => void
}

type KeyState = {
  keyDown: boolean
  holdActive: boolean
  holdBaseMode: boolean
  holdTimer: number | null
}

const HOLD_DELAY_MS = 220

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  if (target.isContentEditable) {
    return true
  }
  const tagName = target.tagName
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT'
}

function usePathDrawingHotkey({ enabled = true, pathDrawingMode, onToggle }: Params) {
  const modeRef = useRef(pathDrawingMode)
  const onToggleRef = useRef(onToggle)
  const keyStateRef = useRef<KeyState>({
    keyDown: false,
    holdActive: false,
    holdBaseMode: false,
    holdTimer: null,
  })

  useEffect(() => {
    modeRef.current = pathDrawingMode
  }, [pathDrawingMode])

  useEffect(() => {
    onToggleRef.current = onToggle
  }, [onToggle])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const clearHoldTimer = () => {
      if (keyStateRef.current.holdTimer !== null) {
        window.clearTimeout(keyStateRef.current.holdTimer)
      }
      keyStateRef.current.holdTimer = null
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.code !== 'KeyZ') {
        return
      }
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) {
        return
      }
      if (isEditableTarget(event.target)) {
        return
      }
      if (keyStateRef.current.keyDown) {
        return
      }

      event.preventDefault()
      keyStateRef.current.keyDown = true
      keyStateRef.current.holdActive = false
      keyStateRef.current.holdBaseMode = modeRef.current
      keyStateRef.current.holdTimer = window.setTimeout(() => {
        if (!keyStateRef.current.keyDown || keyStateRef.current.holdActive) {
          return
        }
        keyStateRef.current.holdActive = true
        onToggleRef.current(!keyStateRef.current.holdBaseMode)
      }, HOLD_DELAY_MS)
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'KeyZ') {
        return
      }
      if (!keyStateRef.current.keyDown) {
        return
      }

      event.preventDefault()
      clearHoldTimer()
      if (keyStateRef.current.holdActive) {
        onToggleRef.current(keyStateRef.current.holdBaseMode)
      } else {
        onToggleRef.current(!modeRef.current)
      }
      keyStateRef.current.keyDown = false
      keyStateRef.current.holdActive = false
    }

    const onWindowBlur = () => {
      if (!keyStateRef.current.keyDown) {
        return
      }

      clearHoldTimer()
      if (keyStateRef.current.holdActive) {
        onToggleRef.current(keyStateRef.current.holdBaseMode)
      }
      keyStateRef.current.keyDown = false
      keyStateRef.current.holdActive = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onWindowBlur)

    return () => {
      clearHoldTimer()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onWindowBlur)
    }
  }, [enabled])
}

export default usePathDrawingHotkey
