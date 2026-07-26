import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import { AUTO_SAVE_INTERVAL_MS } from '@/utils/constants';
import { serializeProject } from '@/services/projectService';

/**
 * Auto-saves the project when dirty and a path is known.
 * Also writes a recovery snapshot to localStorage as a safety net.
 */
export function useAutoSave(): void {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      const { project, projectPath, isDirty } = useEditorStore.getState();

      // Always keep a local recovery snapshot
      try {
        const content = serializeProject(project);
        localStorage.setItem('mapeditor:autosave', content);
        localStorage.setItem(
          'mapeditor:autosave-meta',
          JSON.stringify({
            path: projectPath,
            dirty: isDirty,
            savedAt: new Date().toISOString(),
          })
        );
      } catch {
        // ignore quota errors
      }

      // Persist to disk when we already know the path
      if (isDirty && projectPath && window.electronAPI) {
        void useEditorStore
          .getState()
          .saveProject()
          .then(() => {
            useEditorStore.getState().setStatus({
              message: 'Auto-saved',
              severity: 'info',
            });
          });
      }
    }, AUTO_SAVE_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);
}
