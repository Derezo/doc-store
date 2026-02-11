'use client';

import { create } from 'zustand';
import { api } from '../api-client';
import type { Document } from '@doc-store/shared';

export type EditorMode = 'view' | 'edit' | 'source';

interface EditorState {
  mode: EditorMode;
  content: string;
  originalContent: string;
  originalHash: string;
  isDirty: boolean;
  isSaving: boolean;
  saveError: string | null;
  lastSavedAt: Date | null;

  setMode: (_mode: EditorMode) => void;
  setContent: (_content: string) => void;
  loadDocument: (_content: string, _hash: string) => void;
  save: (_vaultId: string, _path: string) => Promise<boolean>;
  reset: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  mode: 'view',
  content: '',
  originalContent: '',
  originalHash: '',
  isDirty: false,
  isSaving: false,
  saveError: null,
  lastSavedAt: null,

  setMode: (mode: EditorMode) => {
    set({ mode });
  },

  setContent: (content: string) => {
    const { originalContent } = get();
    set({
      content,
      isDirty: content !== originalContent,
      saveError: null,
    });
  },

  loadDocument: (content: string, hash: string) => {
    set({
      content,
      originalContent: content,
      originalHash: hash,
      isDirty: false,
      isSaving: false,
      saveError: null,
    });
  },

  save: async (vaultId: string, path: string): Promise<boolean> => {
    const { content, isDirty, isSaving } = get();
    if (!isDirty || isSaving) return true;

    set({ isSaving: true, saveError: null });

    try {
      const data = await api
        .put(`api/v1/vaults/${vaultId}/documents/${path}`, {
          json: { content },
        })
        .json<{ document: Document }>();

      set({
        originalContent: content,
        originalHash: data.document.contentHash,
        isDirty: false,
        isSaving: false,
        lastSavedAt: new Date(),
        saveError: null,
      });

      return true;
    } catch (err: any) {
      const body = await err?.response?.json?.().catch(() => ({}));
      const message = body?.message ?? 'Failed to save document';
      set({ isSaving: false, saveError: message });
      return false;
    }
  },

  reset: () => {
    set({
      mode: 'view',
      content: '',
      originalContent: '',
      originalHash: '',
      isDirty: false,
      isSaving: false,
      saveError: null,
      lastSavedAt: null,
    });
  },
}));
