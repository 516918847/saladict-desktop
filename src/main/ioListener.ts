import ioHook from 'iohook'
import { app, BrowserWindow } from 'electron'
import { emitter, getSelectedText } from './utils'

// for ioHook start or load
let hasRun = false

let isListenHolding = false
let isHolding = false

let mouseDownAt: number = 0

const initIOListener = (
  mainWin: BrowserWindow | null,
  saladbowlWin: BrowserWindow | null,
) => {
  const setListenKeyHolding = () => {
    ioHook.on('keydown', (event) => {
      const keyName = Object.keys(event).find((_key) => event[_key] === true)

      if (keyName) {
        const { mode, pinMode, isPinPanel } = global.shareVars
        const { holding: _holding } = isPinPanel ? pinMode : mode

        if (
          (Object.keys(_holding) as (keyof typeof _holding)[])
            .filter((key) => _holding[key])
            .includes(keyName.slice(0, -3) as keyof typeof _holding)
        ) {
          isHolding = true
        }
      }
    })

    ioHook.on('keyup', () => {
      isHolding = false
    })
  }

  const removeListenKeyHolding = () => {
    ioHook.removeAllListeners('keydown')

    ioHook.removeAllListeners('keyup')
  }

  ioHook.on('mousedown', (event) => {
    if (event.button === 1) {
      mouseDownAt = +new Date()
    } else {
      mouseDownAt = 0
    }
  })

  // TODO compare x / y
  ioHook.on('mouseup', async (event) => {
    const { clicks, x, y } = event

    const {
      doubleClickDelay,
      mode,
      pinMode,
      bowlOffsetX,
      bowlOffsetY,
      isPinPanel,
    } = global.shareVars

    let _mode = mode

    if (isPinPanel) {
      _mode = pinMode as typeof mode
    }

    if (
      (mouseDownAt && +new Date() - mouseDownAt >= doubleClickDelay) ||
      (_mode.double && clicks >= 2) ||
      isHolding
    ) {
      // fix: getSelectedText will set isHolding = false
      let _isHolding = isHolding

      const text = await getSelectedText()
      global.shareVars.selectedText = text || ''

      if (!text) {
        console.error('Get selected text failed!')
        return
      }

      mainWin?.webContents.send('search-word-message', { text })

      const _x = x + bowlOffsetX
      const _y = y + bowlOffsetY

      if (_mode.direct || _isHolding) {
        !isPinPanel && mainWin?.setPosition(_x, _y)
        mainWin?.show()
        return
      }

      if (_mode.icon && !isPinPanel) {
        saladbowlWin?.setPosition(_x, _y)
        saladbowlWin?.show()
        mainWin?.setPosition(_x + 40, _y)
        return
      }

      console.log(text, ' @', +new Date())
    }
  })

  const runHook = () => {
    if (!hasRun) {
      ioHook.start(false)
      hasRun = true
    } else {
      ioHook.load()
    }
  }

  const destroyHook = () => {
    ioHook.unload()
  }

  const restartHook = () => {
    ioHook.unload()
    ioHook.load()
  }

  emitter.on('active', (enable) => {
    enable ? runHook() : destroyHook()
  })

  if (Object.values(global.shareVars.mode.holding).some((val) => val)) {
    setListenKeyHolding()
    isListenHolding = true
  }

  emitter.on('mode', (data) => {
    if (Object.values(data.holding).some((val) => val) && !isListenHolding) {
      setListenKeyHolding()
      isListenHolding = true
    } else {
      removeListenKeyHolding()
      isListenHolding = false
    }
  })

  if (global.shareVars.active) {
    runHook()
  }

  app.on('will-quit', () => {
    destroyHook()
  })
}

export default initIOListener
