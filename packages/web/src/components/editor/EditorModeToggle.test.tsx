import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorModeToggle } from './EditorModeToggle';

describe('EditorModeToggle', () => {
  it('highlights active mode with correct styling', () => {
    render(<EditorModeToggle mode="edit" onChange={vi.fn()} />);

    const editButton = screen.getByRole('button', { name: /edit/i });
    expect(editButton).toHaveClass('bg-white', 'text-zinc-900');
  });

  it('inactive modes have different styling', () => {
    render(<EditorModeToggle mode="edit" onChange={vi.fn()} />);

    const viewButton = screen.getByRole('button', { name: /view/i });
    expect(viewButton).toHaveClass('text-zinc-500');
    expect(viewButton).not.toHaveClass('bg-white');
  });

  it('calls onChange when clicking a mode button', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<EditorModeToggle mode="view" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /edit/i }));

    expect(onChange).toHaveBeenCalledWith('edit');
  });

  it('displays unsaved changes indicator when hasUnsavedChanges is true', () => {
    render(<EditorModeToggle mode="edit" onChange={vi.fn()} hasUnsavedChanges={true} />);

    const indicator = screen.getByTitle('Unsaved changes');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveClass('bg-amber-400');
  });
});
