type Handler = (payload?: unknown) => void

const handlers = new Map<string, Set<Handler>>()

export const bus = {
  on(event: string, fn: Handler) {
    if (!handlers.has(event)) handlers.set(event, new Set())
    handlers.get(event)!.add(fn)
    return () => handlers.get(event)?.delete(fn)
  },
  emit(event: string, payload?: unknown) {
    handlers.get(event)?.forEach((fn) => fn(payload))
  },
}
