function elementAt(target) {
  return target?.nodeType === 1 ? target : target?.parentElement
}

// Use the effective editing state, including nested and plaintext-only editors.
// An atomic image with contenteditable=false is not an editable text target.
export function isEditableTarget(target) {
  const element = elementAt(target)
  if (!element) return false
  if (element.closest('input,textarea')) return true
  return element.isContentEditable === true
}

export function isInteractiveTarget(target) {
  const element = elementAt(target)
  return isEditableTarget(element) || !!element?.closest('select,button,a,[role="button"],label,[contenteditable]:not([contenteditable="false"])')
}

export function installTouchPolicy(page = document) {
  const contextMenu = event => { if (!isEditableTarget(event.target)) event.preventDefault() }
  const selection = event => { if (!isEditableTarget(event.target)) event.preventDefault() }
  const drag = event => {
    const element = elementAt(event.target)
    if (element?.closest('img,svg,button') || !isEditableTarget(element)) event.preventDefault()
  }
  const doubleClick = event => { if (!isEditableTarget(event.target)) event.preventDefault() }
  const scaleGesture = event => { if (event.cancelable) event.preventDefault() }
  const listeners = [['contextmenu', contextMenu], ['selectstart', selection], ['dragstart', drag], ['dblclick', doubleClick], ['gesturestart', scaleGesture], ['gesturechange', scaleGesture]]
  for (const [type, listener] of listeners) page.addEventListener(type, listener, { capture: true, passive: false })
  return () => { for (const [type, listener] of listeners) page.removeEventListener(type, listener, true) }
}
