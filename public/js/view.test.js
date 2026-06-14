import { test } from 'node:test'
import assert from 'node:assert/strict'
import { VIEWS, DEFAULT_VIEW } from './config.js'
import { activeView, activeViewName, setView, onViewChange } from './view.js'

test('starts on the default view', () => {
  assert.equal(activeViewName(), DEFAULT_VIEW)
  assert.equal(activeView(), VIEWS[DEFAULT_VIEW])
})

test('setView switches and notifies listeners', () => {
  let seen = null
  onViewChange((v, name) => { seen = name })
  setView('max')
  assert.equal(activeViewName(), 'max')
  assert.equal(activeView(), VIEWS.max)
  assert.equal(seen, 'max')
  setView('main') // restore for other tests
})

test('setView ignores unknown names', () => {
  setView('nope')
  assert.equal(activeViewName(), 'main')
})
