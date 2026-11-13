/**
 * Web Worker Environment Polyfill for PixiJS v8 and OffscreenCanvas.
 * PixiJS v8 contains DOM-oriented code paths (AccessibilitySystem, EventSystem,
 * DOMPipe, isRenderingToScreen, etc.) that access `document`, `window`, or expect
 * DOM element interfaces on `canvas`. This polyfill provides defensive mocks so
 * PixiJS can run smoothly in DedicatedWorkerGlobalScope without throwing ReferenceError.
 */

if (typeof self !== 'undefined') {
  // 1. Window alias
  if (typeof (self as any).window === 'undefined') {
    ;(self as any).window = self
  }

  // 2. Mock DOM element factory
  const createMockElement = (tagName = 'div') => {
    const el: any = {
      tagName: tagName.toUpperCase(),
      nodeName: tagName.toUpperCase(),
      nodeType: 1,
      style: {},
      setAttribute: () => {},
      getAttribute: () => null,
      removeAttribute: () => {},
      appendChild: (child: any) => child,
      removeChild: (child: any) => child,
      remove: () => {},
      contains: () => false,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0
      }),
      parentNode: null,
      parentElement: null,
      children: [],
      childNodes: []
    }
    return el
  }

  // 3. Mock document
  if (typeof (self as any).document === 'undefined') {
    const fakeBody = createMockElement('body')
    const fakeHtml = createMockElement('html')
    const fakeHead = createMockElement('head')

    ;(self as any).document = {
      createElement: (tag: string) => {
        if (tag.toLowerCase() === 'canvas') {
          return new OffscreenCanvas(0, 0)
        }
        return createMockElement(tag)
      },
      createElementNS: (_ns: string, tag: string) => createMockElement(tag),
      baseURI: typeof self.location !== 'undefined' ? self.location.href : '',
      body: fakeBody,
      documentElement: fakeHtml,
      head: fakeHead,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      getElementsByTagName: () => [],
      getElementsByClassName: () => [],
      fonts: (self as any).fonts || {
        ready: Promise.resolve(),
        add: () => {},
        check: () => true,
        load: () => Promise.resolve([])
      }
    }
  }

  // 4. OffscreenCanvas enhancements for Pixi observers & event systems
  if (typeof OffscreenCanvas !== 'undefined') {
    if (!('style' in OffscreenCanvas.prototype)) {
      Object.defineProperty(OffscreenCanvas.prototype, 'style', {
        get() {
          return this._style || (this._style = {})
        },
        set(val) {
          this._style = val
        },
        configurable: true
      })
    }
    if (!(OffscreenCanvas.prototype as any).addEventListener) {
      ;(OffscreenCanvas.prototype as any).addEventListener = () => {}
      ;(OffscreenCanvas.prototype as any).removeEventListener = () => {}
      ;(OffscreenCanvas.prototype as any).dispatchEvent = () => false
    }
    if (!(OffscreenCanvas.prototype as any).getBoundingClientRect) {
      ;(OffscreenCanvas.prototype as any).getBoundingClientRect = function () {
        return {
          left: 0,
          top: 0,
          right: this.width || 0,
          bottom: this.height || 0,
          width: this.width || 0,
          height: this.height || 0,
          x: 0,
          y: 0
        }
      }
    }
  }
}
