import { createElement, updateElement } from './dom'
import { resetCursor } from './hooks'
import { scheduleCallback, shouldYeild } from './scheduler'

const options = {}
export const [HOST, HOOK, ROOT, SVG, PLACE, UPDATE, DELETE] = [0, 1, 2, 3, 4, 5, 6]

let nextWork = null
let pendingCommit = null
let currentFiber = null

function render (vnode, node, done) {
  let rootFiber = {
    tag: ROOT,
    node,
    props: { children: vnode },
    done
  }
  scheduleWork(rootFiber)
}

function scheduleWork (fiber) {
  nextWork = fiber
  scheduleCallback(performWork)
}

function performWork () {
  while (nextWork && !shouldYeild()) {
    nextWork = performNext(nextWork)
  }

  if (pendingCommit) {
    options.commitWork
      ? options.commitWork(pendingCommit)
      : commitWork(pendingCommit)
    return null
  }

  return performWork.bind(null)
}

function performNext (WIP) {
  WIP.parentNode = getParentNode(WIP)
  WIP.patches = []
  WIP.tag == HOOK ? updateHOOK(WIP) : updateHost(WIP)
  if (WIP.child) return WIP.child
  while (WIP) {
    completeWork(WIP)
    if (WIP.sibling) return WIP.sibling
    WIP = WIP.parent
  }
}

function updateHost (WIP) {
  if (!options.end && !WIP.node) {
    if (WIP.type === 'svg') WIP.tag = SVG
    WIP.node = createElement(WIP)
  }
  let p = WIP.parentNode || {}
  WIP.insertPoint = p.lastFiber || null
  p.lastFiber = WIP
  WIP.node.lastFiber = null
  reconcileChildren(WIP, WIP.props.children)
}

function getParentNode (fiber) {
  let parent = fiber.parent
  if (!parent) return fiber.node
  while (parent.tag === HOOK) parent = parent. parent
  return parent.node
}

function updateHOOK (WIP) {
  WIP.props = WIP.props || {}
  WIP.state = WIP.state || {}
  currentFiber = WIP
  resetCursor()
  reconcileChildren(WIP, WIP.type(WIP.props))
}

function reconcileChildren (WIP, children) {
  const oldFibers = WIP.kids
  const newFibers = (WIP.kids = hashfy(children, WIP.kids))
  let reused = {}

  for (const k in oldFibers) {
    let newFiber = newFibers[k]
    let oldFiber = oldFibers[k]

    if (newFiber && newFiber.type === oldFiber.type) {
      reused[k] = oldFiber
    } else {
      oldFiber.patchTag = DELETE
      WIP.patches.push(oldFiber)
    }
  }

  let prevFiber = null
  let alternate = null

  for (const k in newFibers) {
    let newFiber = newFibers[k]
    let oldFiber = reused[k]

    if (oldFiber) {
      alternate = createFiber(oldFiber, { patchTag: UPDATE })
      if (!options.end) newFiber.patchTag = UPDATE
      newFiber = merge(alternate, newFiber)
      newFiber.alternate = alternate
      if (newFiber.key) newFiber.patchTag = PLACE
    } else {
      newFiber = createFiber(newFiber, { patchTag: PLACE })
    }

    newFibers[k] = newFiber
    newFiber.parent = WIP

    if (prevFiber) {
      prevFiber.sibling = newFiber
    } else {
      if (WIP.tag === SVG) newFiber.tag = SVG
      WIP.child = newFiber
    }
    prevFiber = newFiber
  }
  if (prevFiber) prevFiber.sibling = null
}

function createFiber (vnode, data) {
  data.tag = typeof vnode.type === 'function' ? HOOK : HOST
  return merge(vnode, data)
}

function completeWork (fiber) {
  if (!options.end && fiber.parent) {
    fiber.parent.patches = (fiber.parent.patches || []).concat(
      fiber.patches || [],
      fiber.patchTag ? [fiber] : []
    )
  } else {
    pendingCommit = fiber
  }
}

function commitWork (WIP) {
  WIP.patches.forEach(p => {
    p.parent.patches = p.patches = null
    commit(p)
    const e = p.effects
    if (e) for (const k in e) e[k]()
  })
  WIP.done && WIP.done()
  nextWork = pendingCommit = null
}
function commit (fiber) {
  let parent = fiber.parentNode
  let dom = fiber.node
  while (!dom) dom = fiber.child.node
  switch (fiber.patchTag) {
    case UPDATE:
      updateElement(dom, fiber.alternate.props, fiber.props)
      break
    case DELETE:
      parent.removeChild(dom)
      break
    default:
      let point = fiber.insertPoint ? fiber.insertPoint.node : null
      let after = point ? point.nextSibling : parent.firstChild
      if (fiber.tag === HOOK || after === dom) return
      if (after === null && dom === parent.lastChild) return
      parent.insertBefore(dom, after)
      break
  }
}

function getWIP () {
  return currentFiber || null
}

const arrayfy = arr => (!arr ? [] : arr.pop ? arr : [arr])

function hashfy (arr) {
  let out = {}
  let i = 0
  let j = 0
  arrayfy(arr).forEach(item => {
    if (item.pop) {
      item.forEach(item => {
        let key = item.key
        key
          ? (out['.' + i + '.' + key] = item)
          : (out['.' + i + '.' + j] = item) && j++
      })
      i++
    } else (out['.' + i] = item) && i++
  })
  return out
}

function merge (a, b) {
  let out = {}
  for (const i in a) out[i] = a[i]
  for (const i in b) out[i] = b[i]
  return out
}

export { render, scheduleWork, getWIP, options }
