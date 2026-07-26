import { AppLayout } from '@/components/layout/AppLayout';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useMenuBridge } from '@/hooks/useMenuBridge';

/**
 * Main editor page — wires global hooks and the application shell.
 */
export function EditorPage() {
  useKeyboardShortcuts();
  useAutoSave();
  useMenuBridge();

  return <AppLayout />;
}
