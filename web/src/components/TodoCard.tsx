import { Box, Button, Checkbox, Chip, Stack, Typography } from '@mui/material';
import type { Todo } from '@/api';

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function TodoCard({
  todo,
  busy,
  onToggle,
  onEdit,
  onDelete
}: {
  todo: Todo;
  busy: boolean;
  onToggle: (completed: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Box
      sx={{
        bgcolor: '#fff4b8',
        border: '1px solid #e6d36a',
        borderRadius: 1,
        p: 2
      }}
    >
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <Checkbox
            checked={todo.isCompleted}
            disabled={busy}
            sx={{ p: 0.5 }}
            slotProps={{ input: { 'aria-label': `Mark "${todo.title}" complete` } }}
            onChange={event => onToggle(event.target.checked)}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              useFlexGap
              sx={{ flexWrap: 'wrap' }}
            >
              <Typography
                component="h2"
                variant="subtitle1"
                sx={{
                  fontWeight: 600,
                  textDecoration: todo.isCompleted ? 'line-through' : 'none'
                }}
              >
                {todo.title}
              </Typography>
              {todo.isCompleted && <Chip label="Done" size="small" />}
            </Stack>
            {todo.description && (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {todo.description}
              </Typography>
            )}
            {todo.dueDate && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Due {todo.dueDate}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Created {formatCreatedAt(todo.createdAt)}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button size="small" onClick={onEdit}>
            Edit
          </Button>
          <Button size="small" color="error" disabled={busy} onClick={onDelete}>
            Delete
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
