import test from 'node:test'
import assert from 'node:assert/strict'
import { createNavigationTrail } from '../src/domain/navigation-motion.js'

const ownerId = 'navigation-owner'
const route = (path, name = path.split('/').at(-1), options = {}) => ({
  path, fullPath: options.fullPath || path, name,
  meta: { main: ['chats', 'home', 'mine'].includes(name), ...options.meta },
  query: options.query || {},
})
const home = route('/home', 'home'), chats = route('/chats', 'chats'), mine = route('/mine', 'mine')
const plan = (trail, to, from, extra = {}) => trail.plan(to, from, { ownerId, ...extra })
const commit = (trail, to, extra = {}) => trail.commit(to, { ownerId, ...extra })

test('initialization and account changes never animate a previous account snapshot', () => {
  const trail = createNavigationTrail(), settings = route('/settings')
  assert.equal(plan(trail, settings, mine), 'none')
  commit(trail, mine)
  assert.equal(plan(trail, settings, mine), 'push')
  assert.equal(plan(trail, settings, mine, { ownerId: 'another-owner' }), 'none')
  // A rejected navigation for another owner does not mutate the current trail.
  assert.equal(plan(trail, settings, mine), 'push')
  commit(trail, settings, { ownerId: 'another-owner' })
  assert.equal(plan(trail, mine, settings, { ownerId: 'another-owner' }), 'pop')
  assert.equal(plan(trail, mine, settings), 'none')
  trail.reset()
  assert.equal(plan(trail, mine, settings), 'none')
})

test('Tab replacements use their visible order instead of history positions', () => {
  const trail = createNavigationTrail()
  commit(trail, home, { position: 10 })
  assert.equal(plan(trail, chats, home, { position: 10 }), 'tab-back')
  commit(trail, chats, { position: 10 })
  assert.equal(plan(trail, mine, chats, { position: 10 }), 'tab-forward')
  commit(trail, mine, { position: 10 })
  assert.equal(plan(trail, home, mine, { position: 3 }), 'tab-back')
})

test('explicit push returns and nested parents receive backward motion', () => {
  const trail = createNavigationTrail()
  const friends = route('/friends', 'friends', { fullPath: '/friends?from=/mine', query: { from: '/mine' } })
  const profile = route('/profile/peer', 'profile', { fullPath: '/profile/peer?from=/friends%3Ffrom%3D/mine', query: { from: friends.fullPath } })
  commit(trail, mine)
  assert.equal(plan(trail, friends, mine), 'push')
  commit(trail, friends)
  assert.equal(plan(trail, profile, friends), 'push')
  commit(trail, profile)
  assert.equal(plan(trail, friends, profile, { position: 20 }), 'pop')
  commit(trail, friends, { position: 20 })
  assert.equal(plan(trail, mine, friends), 'pop')

  const theme = route('/settings/theme', 'settingsTheme'), settings = route('/settings', 'settings')
  commit(trail, theme)
  assert.equal(plan(trail, settings, theme), 'pop')
  assert.equal(plan(trail, route('/setting'), theme), 'push')
})

test('planning failed navigations cannot erase the successful return trail', () => {
  const trail = createNavigationTrail(), first = route('/profile/one', 'profile'), second = route('/profile/two', 'profile')
  commit(trail, home)
  commit(trail, first)
  assert.equal(plan(trail, second, first), 'push')
  assert.equal(plan(trail, home, first), 'pop')
  // No commit follows a failed route guard or a superseded destination.
  assert.equal(plan(trail, first, second), 'push')
  assert.equal(plan(trail, home, first), 'pop')
})

test('a backward return removes the abandoned forward branch', () => {
  const trail = createNavigationTrail()
  const a = route('/profile/a', 'profile'), b = route('/profile/b', 'profile'), c = route('/profile/c', 'profile'), d = route('/profile/d', 'profile')
  for (const screen of [home, a, b, c]) commit(trail, screen)
  assert.equal(plan(trail, a, c), 'pop')
  commit(trail, a)
  assert.equal(plan(trail, d, a), 'push')
  commit(trail, d)
  assert.equal(plan(trail, b, d), 'push')
  assert.equal(plan(trail, a, d), 'pop')
})

test('browser history back supplements unfamiliar destinations without changing Tab semantics', () => {
  const trail = createNavigationTrail(), profile = route('/profile/peer', 'profile'), friends = route('/friends', 'friends')
  commit(trail, profile, { position: 12 })
  assert.equal(plan(trail, friends, profile, { position: 11 }), 'pop')
  assert.equal(plan(trail, friends, profile, { position: 13 }), 'push')
  assert.equal(plan(trail, friends, profile, { position: '11' }), 'push')
  assert.equal(plan(trail, friends, profile, { position: Number.NaN }), 'push')
})

test('continuous auth and query updates do not animate or request a remount', () => {
  const trail = createNavigationTrail()
  const welcome = route('/welcome', 'welcome', { meta: { authFlow: true } })
  const email = route('/auth/sign-up', 'signup', { meta: { authFlow: true } })
  const verify = route('/auth/verify/code', 'verifyCode', { meta: { authFlow: true } })
  trail.commit(welcome)
  assert.equal(trail.plan(email, welcome), 'none')
  trail.commit(email)
  assert.equal(trail.plan(verify, email), 'none')
  commit(trail, home)
  assert.equal(plan(trail, route('/home', 'home', { fullPath: '/home?focus=card' }), home), 'none')
})

test('composer presents and dismisses while media and native call routes gently fade', () => {
  const trail = createNavigationTrail(), compose = route('/compose', 'compose')
  const post = route('/post/one', 'post'), media = route('/post/one/media/0', 'postMedia'), call = route('/call/peer', 'videoCall'), photo = route('/conversation/peer/photo/image', 'chatPhoto')
  commit(trail, home)
  assert.equal(plan(trail, compose, home), 'present')
  commit(trail, compose)
  assert.equal(plan(trail, home, compose), 'dismiss')
  for (const screen of [media, call, photo]) {
    assert.equal(plan(trail, screen, post), 'fade')
    commit(trail, screen)
    assert.equal(plan(trail, post, screen), 'fade')
  }
})

test('trail is bounded and snapshots mutable router route objects', () => {
  const trail = createNavigationTrail(), original = route('/profile/old', 'profile')
  commit(trail, original)
  original.fullPath = '/profile/changed'
  for (let i = 0; i < 29; i++) commit(trail, route('/profile/' + i, 'profile'))
  const current = route('/profile/28', 'profile')
  assert.equal(plan(trail, route('/profile/old', 'profile'), current), 'pop')
  commit(trail, route('/profile/new', 'profile'))
  assert.equal(plan(trail, route('/profile/old', 'profile'), route('/profile/new', 'profile')), 'push')
})
