import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import {
  createTodo,
  deleteTodo,
  listTodos,
  setCompleted,
  type Todo,
  type TodoDraft,
  type TodoStatus,
  updateTodo
} from './api';

const emptyDraft: TodoDraft = { title: '', description: '', dueDate: '' };

const filters: { value: TodoStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'incomplete', label: 'Open' },
  { value: 'completed', label: 'Done' },
  { value: 'overdue', label: 'Overdue' }
];

function draftFromTodo(todo: Todo): TodoDraft {
  return {
    title: todo.title,
    description: todo.description ?? '',
    dueDate: todo.dueDate ?? ''
  };
}

function TodoFields({
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
      />
      <TextField
        id={`${idPrefix}-description`}
        label="Description"
        value={draft.description}
        multiline
        minRows={2}
        onChange={event => onChange({ ...draft, description: event.target.value })}
      />
      <TextField
        id={`${idPrefix}-due`}
        label="Due date"
        type="date"
        value={draft.dueDate}
        onChange={event => onChange({ ...draft, dueDate: event.target.value })}
        slotProps={{ inputLabel: { shrink: true } }}
      />
    </Stack>
  );
}

export function App() {
  const [status, setStatus] = useState<TodoStatus>('all');
  const [todos, setTodos] = useState<Todo[]>([]);
  const [draft, setDraft] = useState<TodoDraft>(emptyDraft);
  const [editing, setEditing] = useState<Todo | null>(null);
  const [editDraft, setEditDraft] = useState<TodoDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextStatus: TodoStatus) => {
    setLoading(true);
    setError(null);
    try {
      setTodos(await listTodos(nextStatus));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load to-dos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(status);
  }, [load, status]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Typography variant="h4" component="h1">
          To-dos
        </Typography>

        {error && <Alert severity="error">{error}</Alert>}

        <Box
          component="form"
          onSubmit={event => {
            event.preventDefault();
            if (!draft.title.trim()) {
              return;
            }
            void run(async () => {
              await createTodo(draft);
              setDraft(emptyDraft);
            });
          }}
        >
          <Stack spacing={2}>
            <TodoFields draft={draft} onChange={setDraft} idPrefix="create" />
            <Button type="submit" variant="contained" disabled={busy || !draft.title.trim()}>
              Add to-do
            </Button>
          </Stack>
        </Box>

        <ToggleButtonGroup
          exclusive
          value={status}
          onChange={(_event, value: TodoStatus | null) => {
            if (value) {
              setStatus(value);
            }
          }}
          aria-label="Filter to-dos"
        >
          {filters.map(filter => (
            <ToggleButton key={filter.value} value={filter.value}>
              {filter.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : todos.length === 0 ? (
          <Typography color="text.secondary">No to-dos in this view.</Typography>
        ) : (
          <List>
            {todos.map(todo => (
              <ListItem
                key={todo.todoId}
                disablePadding
                sx={{ alignItems: 'flex-start', py: 1 }}
                secondaryAction={
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      onClick={() => {
                        setEditing(todo);
                        setEditDraft(draftFromTodo(todo));
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      disabled={busy}
                      onClick={() => {
                        void run(() => deleteTodo(todo.todoId));
                      }}
                    >
                      Delete
                    </Button>
                  </Stack>
                }
              >
                <Checkbox
                  edge="start"
                  checked={todo.isCompleted}
                  disabled={busy}
                  slotProps={{ input: { 'aria-label': `Mark "${todo.title}" complete` } }}
                  onChange={event => {
                    void run(() => setCompleted(todo.todoId, event.target.checked));
                  }}
                />
                <ListItemText
                  primary={todo.title}
                  secondary={[todo.description, todo.dueDate].filter(Boolean).join(' · ') || ' '}
                  sx={{
                    pr: 16,
                    textDecoration: todo.isCompleted ? 'line-through' : 'none'
                  }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Stack>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} fullWidth>
        <DialogTitle>Edit to-do</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TodoFields draft={editDraft} onChange={setEditDraft} idPrefix="edit" />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={busy || !editDraft.title.trim() || editing === null}
            onClick={() => {
              if (!editing) {
                return;
              }
              const todoId = editing.todoId;
              void run(async () => {
                await updateTodo(todoId, editDraft);
                setEditing(null);
              });
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
