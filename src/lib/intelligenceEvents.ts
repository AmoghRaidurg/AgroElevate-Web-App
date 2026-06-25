/** Event bus: notify intelligence dashboards to reload after commerce activity. */
type Listener = () => void;

const listeners = new Set<Listener>();

export function notifyIntelligenceDirty(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error('Intelligence refresh listener error:', e);
    }
  });
}

export function onIntelligenceDirty(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
