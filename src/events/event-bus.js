const { EventEmitter } = require('node:events');

function createEventBus({ logger = console } = {}) {
  const emitter = new EventEmitter();
  const pending = new Set();

  return {
    on(eventName, listener) {
      const safeListener = (payload) => {
        const task = Promise.resolve().then(() => listener(payload)).catch((error) => {
          logger.error(`[event] Listener for ${eventName} failed:`, error);
        });
        pending.add(task);
        task.finally(() => pending.delete(task));
      };
      emitter.on(eventName, safeListener);
      return () => emitter.off(eventName, safeListener);
    },
    async publish(eventName, payload) {
      emitter.emit(eventName, payload);
      await Promise.all([...pending]);
    },
  };
}

module.exports = { createEventBus };
