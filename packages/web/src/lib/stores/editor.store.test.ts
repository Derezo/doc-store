import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEditorStore } from './editor.store';

// Mock api-client
vi.mock('@/lib/api-client', () => ({
  api: {
    put: vi.fn(),
  },
}));

describe('editorStore', () => {
  beforeEach(() => {
    // Reset store state
    useEditorStore.setState({
      mode: 'view',
      content: '',
      originalContent: '',
      originalHash: '',
      isDirty: false,
      isSaving: false,
      saveError: null,
      lastSavedAt: null,
    });
    vi.clearAllMocks();
  });

  describe('setContent', () => {
    it('updates content and marks as dirty when different from original', () => {
      useEditorStore.setState({ originalContent: 'original text' });

      useEditorStore.getState().setContent('new text');

      const state = useEditorStore.getState();
      expect(state.content).toBe('new text');
      expect(state.isDirty).toBe(true);
    });

    it('marks as not dirty when content matches original', () => {
      useEditorStore.setState({ originalContent: 'original text' });

      useEditorStore.getState().setContent('original text');

      const state = useEditorStore.getState();
      expect(state.content).toBe('original text');
      expect(state.isDirty).toBe(false);
    });

    it('clears save error', () => {
      useEditorStore.setState({ saveError: 'Previous error' });

      useEditorStore.getState().setContent('new text');

      expect(useEditorStore.getState().saveError).toBeNull();
    });
  });

  describe('loadDocument', () => {
    it('sets content and hash', () => {
      useEditorStore.getState().loadDocument('# Hello\n\nWorld', 'abc123');

      const state = useEditorStore.getState();
      expect(state.content).toBe('# Hello\n\nWorld');
      expect(state.originalContent).toBe('# Hello\n\nWorld');
      expect(state.originalHash).toBe('abc123');
    });

    it('resets dirty flag', () => {
      useEditorStore.setState({ isDirty: true });

      useEditorStore.getState().loadDocument('new content', 'hash123');

      expect(useEditorStore.getState().isDirty).toBe(false);
    });

    it('resets save state', () => {
      useEditorStore.setState({
        isSaving: true,
        saveError: 'Previous error',
      });

      useEditorStore.getState().loadDocument('content', 'hash');

      const state = useEditorStore.getState();
      expect(state.isSaving).toBe(false);
      expect(state.saveError).toBeNull();
    });
  });

  describe('setMode', () => {
    it('changes editor mode to edit', () => {
      useEditorStore.getState().setMode('edit');
      expect(useEditorStore.getState().mode).toBe('edit');
    });

    it('changes editor mode to source', () => {
      useEditorStore.getState().setMode('source');
      expect(useEditorStore.getState().mode).toBe('source');
    });

    it('changes editor mode to view', () => {
      useEditorStore.setState({ mode: 'edit' });
      useEditorStore.getState().setMode('view');
      expect(useEditorStore.getState().mode).toBe('view');
    });
  });

  describe('reset', () => {
    it('clears all state to defaults', () => {
      useEditorStore.setState({
        mode: 'edit',
        content: 'some content',
        originalContent: 'original',
        originalHash: 'hash123',
        isDirty: true,
        isSaving: false,
        saveError: 'error',
        lastSavedAt: new Date(),
      });

      useEditorStore.getState().reset();

      const state = useEditorStore.getState();
      expect(state.mode).toBe('view');
      expect(state.content).toBe('');
      expect(state.originalContent).toBe('');
      expect(state.originalHash).toBe('');
      expect(state.isDirty).toBe(false);
      expect(state.isSaving).toBe(false);
      expect(state.saveError).toBeNull();
      expect(state.lastSavedAt).toBeNull();
    });
  });
});
