export interface Event<T> {
  event: string;
  payload: T;
}

export async function listen<T>(
  eventName: string,
  handler: (event: Event<T>) => void,
): Promise<() => void> {
  if (!window.paperquay?.listen) {
    throw new Error('PaperQuay Electron event bridge is not available');
  }

  return window.paperquay.listen<T>(eventName, handler);
}
