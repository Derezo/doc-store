'use client';

import { useEffect, useRef, useCallback } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection, highlightSpecialChars } from '@codemirror/view';
import { EditorState, type Extension } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { search, searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { oneDark } from '@codemirror/theme-one-dark';
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  indentOnInput,
  bracketMatching,
  foldGutter,
  foldKeymap,
} from '@codemirror/language';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';

interface CodeMirrorEditorProps {
  content: string;
  onChange: (content: string) => void;
  editable?: boolean;
}

/**
 * Detect if the user prefers dark mode.
 */
function isDarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  return document.documentElement.classList.contains('dark') ||
    window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Build CodeMirror extensions based on current mode.
 */
function buildExtensions(
  onChange: (content: string) => void,
  editable: boolean,
): Extension[] {
  const extensions: Extension[] = [
    lineNumbers(),
    highlightActiveLine(),
    highlightSpecialChars(),
    drawSelection(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    foldGutter(),
    highlightSelectionMatches(),
    history(),
    search(),
    autocompletion(),
    markdown({
      base: markdownLanguage,
      codeLanguages: languages,
    }),
    EditorView.lineWrapping,
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      ...foldKeymap,
      ...completionKeymap,
      ...closeBracketsKeymap,
      indentWithTab,
    ]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    }),
    EditorState.readOnly.of(!editable),
  ];

  // Apply theme based on dark mode
  if (isDarkMode()) {
    extensions.push(oneDark);
  } else {
    extensions.push(syntaxHighlighting(defaultHighlightStyle, { fallback: true }));
  }

  return extensions;
}

export function CodeMirrorEditor({ content, onChange, editable = true }: CodeMirrorEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const isExternalUpdateRef = useRef(false);

  // Keep onChange ref current
  onChangeRef.current = onChange;

  // Stable onChange callback that won't fire during external updates
  const stableOnChange = useCallback((newContent: string) => {
    if (!isExternalUpdateRef.current) {
      onChangeRef.current(newContent);
    }
  }, []);

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: content,
      extensions: buildExtensions(stableOnChange, editable),
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only run on mount/unmount — content updates happen via transactions below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update content when prop changes (external update)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentContent = view.state.doc.toString();
    if (content === currentContent) return;

    isExternalUpdateRef.current = true;
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: content,
      },
    });
    isExternalUpdateRef.current = false;
  }, [content]);

  // Update editable state — recreate state to apply new readOnly config
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentContent = view.state.doc.toString();
    const state = EditorState.create({
      doc: currentContent,
      extensions: buildExtensions(stableOnChange, editable),
    });
    view.setState(state);
  }, [editable, stableOnChange]);

  // Listen for dark mode changes to update theme
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const observer = new MutationObserver(() => {
      // When the dark class changes, recreate the view with the correct theme
      const view = viewRef.current;
      if (!view || !containerRef.current) return;

      const currentContent = view.state.doc.toString();
      const state = EditorState.create({
        doc: currentContent,
        extensions: buildExtensions(stableOnChange, editable),
      });

      view.setState(state);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    const handleMediaChange = () => {
      const view = viewRef.current;
      if (!view || !containerRef.current) return;

      const currentContent = view.state.doc.toString();
      const state = EditorState.create({
        doc: currentContent,
        extensions: buildExtensions(stableOnChange, editable),
      });

      view.setState(state);
    };

    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, [editable, stableOnChange]);

  return (
    <div
      ref={containerRef}
      className="codemirror-editor min-h-[300px] text-sm [&_.cm-editor]:min-h-[300px] [&_.cm-editor]:outline-none [&_.cm-scroller]:font-mono [&_.cm-content]:py-4 [&_.cm-gutters]:border-r [&_.cm-gutters]:border-zinc-200 [&_.cm-gutters]:bg-zinc-50 dark:[&_.cm-gutters]:border-zinc-700 dark:[&_.cm-gutters]:bg-zinc-900"
    />
  );
}

export default CodeMirrorEditor;
