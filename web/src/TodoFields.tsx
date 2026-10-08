import { Stack, TextField } from '@mui/material';
import type { TodoDraft } from './api';

export function TodoFields({
  draft,
  onChange,
  idPrefix
}: {
  draft: TodoDraft;
  onChange: (draft: TodoDraft) => void;
  idPrefix: string;
}) {
  return (
    <Stack spacing={2}>
      <TextField
        id={`${idPrefix}-title`}
        label="Title"
        value={draft.title}
        required
        onChange={event => onChange({ ...draft, title: event.target.value })}
        slotProps={{ htmlInput: { 'data-test': 'todo-title' } }}
      />
      <TextField
        id={`${idPrefix}-description`}
        label="Description"
        value={draft.description}
        multiline
        minRows={2}
        onChange={event => onChange({ ...draft, description: event.target.value })}
        slotProps={{ htmlInput: { 'data-test': 'todo-description' } }}
      />
      <TextField
        id={`${idPrefix}-due`}
        label="Due date"
        type="date"
        value={draft.dueDate}
        onChange={event => onChange({ ...draft, dueDate: event.target.value })}
        slotProps={{
          inputLabel: { shrink: true },
          htmlInput: { 'data-test': 'todo-due-date' }
        }}
      />
    </Stack>
  );
}
