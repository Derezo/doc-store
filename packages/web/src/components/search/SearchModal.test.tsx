import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/__tests__/mocks/server';
import { mockRouter } from '@/__tests__/helpers/next-router';
import { mockSearchResult } from '@/__tests__/mocks/data';
import { SearchModal } from './SearchModal';

describe('SearchModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('does not render when isOpen is false', () => {
    render(<SearchModal isOpen={false} onClose={vi.fn()} />);

    expect(screen.queryByPlaceholderText('Search documents...')).not.toBeInTheDocument();
  });

  it('renders modal when isOpen is true', () => {
    render(<SearchModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByPlaceholderText('Search documents...')).toBeInTheDocument();
  });

  it('closes on Escape key', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<SearchModal isOpen={true} onClose={onClose} />);

    const input = screen.getByPlaceholderText('Search documents...');
    await user.click(input); // Focus the input first
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });

  it('shows search results after typing', async () => {
    const user = userEvent.setup();
    const result = mockSearchResult({ title: 'Test Document', path: 'test.md' });

    server.use(
      http.get('http://localhost:4000/api/v1/search', () => {
        return HttpResponse.json({
          results: [result],
          total: 1,
          limit: 10,
          offset: 0,
        });
      })
    );

    render(<SearchModal isOpen={true} onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Search documents...'), 'test');

    await waitFor(() => {
      expect(screen.getByText('Test Document')).toBeInTheDocument();
    });
  });

  it('navigates to document on result click', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const result = mockSearchResult({
      title: 'Test Doc',
      path: 'notes/test.md',
      vaultId: 'vault-123',
    });

    server.use(
      http.get('http://localhost:4000/api/v1/search', () => {
        return HttpResponse.json({
          results: [result],
          total: 1,
          limit: 10,
          offset: 0,
        });
      })
    );

    render(<SearchModal isOpen={true} onClose={onClose} />);

    await user.type(screen.getByPlaceholderText('Search documents...'), 'test');

    await waitFor(() => {
      expect(screen.getByText('Test Doc')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Test Doc'));

    expect(mockRouter.push).toHaveBeenCalledWith('/vaults/vault-123/notes/test.md');
    expect(onClose).toHaveBeenCalled();
  });

  it('supports keyboard navigation with arrow keys', async () => {
    const user = userEvent.setup();
    const result1 = mockSearchResult({ title: 'Doc 1', documentId: 'doc-1' });
    const result2 = mockSearchResult({ title: 'Doc 2', documentId: 'doc-2' });

    server.use(
      http.get('http://localhost:4000/api/v1/search', () => {
        return HttpResponse.json({
          results: [result1, result2],
          total: 2,
          limit: 10,
          offset: 0,
        });
      })
    );

    render(<SearchModal isOpen={true} onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Search documents...'), 'test');

    await waitFor(() => {
      expect(screen.getByText('Doc 1')).toBeInTheDocument();
    });

    // Arrow down to select second result
    await user.keyboard('{ArrowDown}');

    const doc2Button = screen.getByText('Doc 2').closest('button');
    expect(doc2Button).toHaveClass('bg-blue-50');
  });

  it('navigates to selected result on Enter key', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const result = mockSearchResult({
      title: 'Test',
      path: 'test.md',
      vaultId: 'vault-1',
    });

    server.use(
      http.get('http://localhost:4000/api/v1/search', () => {
        return HttpResponse.json({
          results: [result],
          total: 1,
          limit: 10,
          offset: 0,
        });
      })
    );

    render(<SearchModal isOpen={true} onClose={onClose} />);

    await user.type(screen.getByPlaceholderText('Search documents...'), 'test');

    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    await user.keyboard('{Enter}');

    expect(mockRouter.push).toHaveBeenCalledWith('/vaults/vault-1/test.md');
    expect(onClose).toHaveBeenCalled();
  });

  it('sanitizes snippet HTML safely', async () => {
    const user = userEvent.setup();
    const result = mockSearchResult({
      snippet: 'Safe <mark>highlighted</mark> text here',
    });

    server.use(
      http.get('http://localhost:4000/api/v1/search', () => {
        return HttpResponse.json({
          results: [result],
          total: 1,
          limit: 10,
          offset: 0,
        });
      })
    );

    render(<SearchModal isOpen={true} onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Search documents...'), 'test');

    await waitFor(() => {
      // Check that highlighted text is present with mark tag preserved
      expect(screen.getByText('highlighted')).toBeInTheDocument();
      const highlightedElement = screen.getByText('highlighted').closest('mark');
      expect(highlightedElement).toBeInTheDocument();
      // Check that other text is rendered
      expect(screen.getByText(/Safe/)).toBeInTheDocument();
    });
  });

  it('shows empty state when no query entered', () => {
    render(<SearchModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText(/Type to search across all your documents/)).toBeInTheDocument();
  });

  it('shows no results message when search returns empty', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('http://localhost:4000/api/v1/search', () => {
        return HttpResponse.json({
          results: [],
          total: 0,
          limit: 10,
          offset: 0,
        });
      })
    );

    render(<SearchModal isOpen={true} onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Search documents...'), 'nonexistent');

    await waitFor(() => {
      expect(screen.getByText(/No results found/)).toBeInTheDocument();
    });
  });
});
