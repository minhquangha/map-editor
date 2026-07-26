import { useEffect } from 'react';
import { useEditorStore } from '@/store/useEditorStore';

/**
 * Global keyboard shortcuts for the map editor.
 * Ignores events when focus is inside an input/textarea/select.
 */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      if (target.isContentEditable) return true;
      return false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const store = useEditorStore.getState();
      const ctrl = e.ctrlKey || e.metaKey;

      // Tools
      if (!ctrl && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'v':
            store.setTool('pointer');
            e.preventDefault();
            return;
          case 'h':
            store.setTool('pan');
            e.preventDefault();
            return;
          case 'n':
            store.setTool('add-node');
            e.preventDefault();
            return;
          case 'e':
            // bare E reserved? use without ctrl for edge tool
            if (!e.shiftKey) {
              store.setTool('add-edge');
              e.preventDefault();
            }
            return;
          case 'd':
            store.setTool('delete');
            e.preventDefault();
            return;
          default:
            break;
        }
      }

      if (ctrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          void store.saveProjectAs();
        } else {
          void store.saveProject();
        }
        return;
      }

      if (ctrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          store.redo();
        } else {
          store.undo();
        }
        return;
      }

      if (ctrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        store.redo();
        return;
      }

      if (ctrl && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        void store.openProject();
        return;
      }

      if (ctrl && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        store.newProject();
        return;
      }

      if (ctrl && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        void store.openImageForActiveFloor();
        return;
      }

      if (ctrl && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        void store.exportJson();
        return;
      }

      if (ctrl && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        store.selectAll();
        return;
      }

      if (ctrl && (e.key === '0' || e.code === 'Digit0')) {
        e.preventDefault();
        store.fitToScreen();
        return;
      }

      if (ctrl && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        store.zoomBy(1.15);
        return;
      }

      if (ctrl && e.key === '-') {
        e.preventDefault();
        store.zoomBy(1 / 1.15);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        store.deleteSelection();
        return;
      }

      if (e.key === 'Escape') {
        store.clearSelection();
        store.setEdgeDraftFromId(null);
        if (store.tool === 'add-edge') {
          store.setStatus({ message: 'Edge creation cancelled', severity: 'info' });
        }
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
