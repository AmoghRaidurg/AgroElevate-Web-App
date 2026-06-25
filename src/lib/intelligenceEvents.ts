/** Event bus: notify dashboards to reload after commerce activity. */
type Listener = () => void;

const listeners = new Set<Listener>();

export function notifyCommerceDirty(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error('Commerce refresh listener error:', e);
    }
  });
}

/** @deprecated Use notifyCommerceDirty — intelligence dashboards share the same bus. */
export const notifyIntelligenceDirty = notifyCommerceDirty;

export function onCommerceDirty(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** @deprecated Use onCommerceDirty */
export const onIntelligenceDirty = onCommerceDirty;
