import { VIEWS, DEFAULT_VIEW } from './config.js'

let active = DEFAULT_VIEW
const listeners = []

export function activeView() { return VIEWS[active] }
export function activeViewName() { return active }

export function setView(name) {
  if (!VIEWS[name] || name === active) return
  active = name
  for (const cb of listeners) cb(VIEWS[active], active)
}

export function onViewChange(cb) { listeners.push(cb) }

// Test-only: clear listeners and restore the default view between tests.
export function _resetForTest() { active = DEFAULT_VIEW; listeners.length = 0 }
