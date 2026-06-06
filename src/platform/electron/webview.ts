interface DragDropEventPayload {
  type: 'enter' | 'over' | 'leave' | 'drop';
  paths: string[];
}

export function getCurrentWebview() {
  return {
    async onDragDropEvent(handler: (event: { payload: DragDropEventPayload }) => void) {
      if (!window.paperquay?.onFileDrop) {
        throw new Error('PaperQuay Electron file-drop bridge is not available');
      }

      return window.paperquay.onFileDrop((payload) => handler({ payload }));
    },
  };
}
