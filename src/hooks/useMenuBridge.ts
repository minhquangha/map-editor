import { useEffect } from 'react';
import { useEditorStore } from '@/store/useEditorStore';

/**
 * Wire Electron native menu events to the editor store.
 */
export function useMenuBridge(): void {
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    const unsubs = [
      api.onMenuEvent('menu:new-project', () => useEditorStore.getState().newProject()),
      api.onMenuEvent('menu:open-project', () => {
        void useEditorStore.getState().openProject();
      }),
      api.onMenuEvent('menu:save-project', () => {
        void useEditorStore.getState().saveProject();
      }),
      api.onMenuEvent('menu:save-project-as', () => {
        void useEditorStore.getState().saveProjectAs();
      }),
      api.onMenuEvent('menu:open-image', () => {
        void useEditorStore.getState().openImageForActiveFloor();
      }),
      api.onMenuEvent('menu:export-json', () => {
        void useEditorStore.getState().exportJson();
      }),
      api.onMenuEvent('menu:undo', () => useEditorStore.getState().undo()),
      api.onMenuEvent('menu:redo', () => useEditorStore.getState().redo()),
      api.onMenuEvent('menu:delete', () => useEditorStore.getState().deleteSelection()),
      api.onMenuEvent('menu:select-all', () => useEditorStore.getState().selectAll()),
      api.onMenuEvent('menu:fit-screen', () => useEditorStore.getState().fitToScreen()),
      api.onMenuEvent('menu:zoom-in', () => useEditorStore.getState().zoomBy(1.15)),
      api.onMenuEvent('menu:zoom-out', () => useEditorStore.getState().zoomBy(1 / 1.15)),
    ];

    return () => {
      unsubs.forEach((u) => u());
    };
  }, []);
}
