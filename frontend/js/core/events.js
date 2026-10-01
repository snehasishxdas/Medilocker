/**
 * MediLocker Safe Event Registry
 * - Eliminates duplicate event listener accumulation and memory leaks
 * - Clean teardown and idempotent event bindings
 */

class EventRegistry {
  constructor() {
    this.registry = new Map(); // key -> { element, eventName, handler }
  }

  /**
   * Bind event listener safely (removes any previous listener registered under this key)
   */
  bind(key, target, eventName, handler, options = {}) {
    const element = typeof target === 'string' ? document.querySelector(target) : target;
    if (!element) return false;

    // If an existing listener exists for this key, detach it first
    this.unbind(key);

    element.addEventListener(eventName, handler, options);
    this.registry.set(key, { element, eventName, handler });
    return true;
  }

  /**
   * Bind event listener to all matching elements safely
   */
  bindAll(keyPrefix, selector, eventName, handlerFactory) {
    this.unbindPrefix(keyPrefix);
    const elements = document.querySelectorAll(selector);
    elements.forEach((el, idx) => {
      const key = `${keyPrefix}:${idx}`;
      const handler = handlerFactory(el, idx);
      this.bind(key, el, eventName, handler);
    });
  }

  /**
   * Unbind a specific listener by key
   */
  unbind(key) {
    const existing = this.registry.get(key);
    if (existing) {
      existing.element.removeEventListener(existing.eventName, existing.handler);
      this.registry.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Unbind all listeners starting with a prefix (e.g. during page transition or re-render)
   */
  unbindPrefix(prefix) {
    for (const [key, item] of this.registry.entries()) {
      if (key.startsWith(prefix)) {
        item.element.removeEventListener(item.eventName, item.handler);
        this.registry.delete(key);
      }
    }
  }

  /**
   * Clear all registered listeners
   */
  clear() {
    for (const item of this.registry.values()) {
      item.element.removeEventListener(item.eventName, item.handler);
    }
    this.registry.clear();
  }
}

export const events = new EventRegistry();
