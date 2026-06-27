import type { MouseEvent } from 'react';
import type { Note } from '../../types/notes';
import { NoteCard } from './NoteCard';

interface NotesListProps {
  notes: Note[];
  activeNoteId: string | null;
  onSelect: (note: Note) => void;
  onDelete: (note: Note) => void;
  onContextMenu?: (event: MouseEvent, note: Note) => void;
}

export function NotesList({
  notes,
  activeNoteId,
  onSelect,
  onDelete,
  onContextMenu,
}: NotesListProps) {
  if (notes.length === 0) {
    return (
      <div className="rounded-[var(--pq-radius-md)] border border-dashed border-[var(--pq-border-subtle)] bg-[var(--pq-surface-1)] px-4 py-7 text-center text-sm text-[var(--pq-text-faint)]">
        No notes
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          active={note.id === activeNoteId}
          onSelect={onSelect}
          onDelete={onDelete}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  );
}
