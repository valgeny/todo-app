import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { TodoCard } from '@/components/TodoCard';
import {
  createTodo,
  deleteTodo,
  listTodos,
  setCompleted,
  type Todo,
  type TodoDraft,
  type TodoSort,
  type TodoStatus,
  updateTodo
} from './api';
import { TodoDialog } from './TodoDialog';

const emptyDraft: TodoDraft = { title: '', description: '', dueDate: '' };

const filters: { value: TodoStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'incomplete', label: 'Open' },
  { value: 'completed', label: 'Done' },
  { value: 'overdue', label: 'Overdue' }
];

const sorts: { value: TodoSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'due-soonest', label: 'Due soonest' },
  { value: 'due-latest', label: 'Due latest' }
];

type Editor =
  | { kind: 'create'; draft: TodoDraft }
  | { kind: 'edit'; todoId: string; draft: TodoDraft };

function draftFromTodo(todo: Todo): TodoDraft {
  return {
    title: todo.title,
    description: todo.description ?? '',
    dueDate: todo.dueDate ?? ''
  };
}

export function App() {
  const [status, setStatus] = useState<TodoStatus>('all');
  const [sort, setSort] = useState<TodoSort>('newest');
  const [todos, setTodos] = useState<Todo[]>([]);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextStatus: TodoStatus, nextSort: TodoSort) => {
    setLoading(true);
    setError(null);
    try {
      setTodos(await listTodos(nextStatus, nextSort));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load to-dos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(status, sort);
  }, [load, status, sort]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load(status, sort);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Typography variant="h4" component="h1">
            To-dos
          </Typography>
          <Button
            data-test="add-todo"
            variant="contained"
            onClick={() => setEditor({ kind: 'create', draft: emptyDraft })}
          >
            Add to-do
          </Button>
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}

        <Stack direction="row" spacing={2} alignItems="center" useFlexGap sx={{ flexWrap: 'wrap' }}>
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
              <ToggleButton
                data-test={`filter-${filter.value}`}
                key={filter.value}
                value={filter.value}
              >
                {filter.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="sort-label">Sort</InputLabel>
            <Select
              data-test="sort"
              labelId="sort-label"
              label="Sort"
              value={sort}
              onChange={event => setSort(event.target.value as TodoSort)}
            >
              {sorts.map(option => (
                <MenuItem
                  data-test={`sort-${option.value}`}
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : todos.length === 0 ? (
          <Typography color="text.secondary">No to-dos in this view.</Typography>
        ) : (
          <Stack spacing={2}>
            {todos.map(todo => (
              <TodoCard
                key={todo.todoId}
                todo={todo}
                busy={busy}
                onToggle={completed => {
                  void run(() => setCompleted(todo.todoId, completed));
                }}
                onEdit={() =>
                  setEditor({ kind: 'edit', todoId: todo.todoId, draft: draftFromTodo(todo) })
                }
                onDelete={() => {
                  void run(() => deleteTodo(todo.todoId));
                }}
              />
            ))}
          </Stack>
        )}
      </Stack>

      <TodoDialog
        open={editor !== null}
        title={editor?.kind === 'edit' ? 'Edit to-do' : 'New to-do'}
        draft={editor?.draft ?? emptyDraft}
        idPrefix={editor?.kind === 'edit' ? 'edit' : 'create'}
        submitLabel={editor?.kind === 'edit' ? 'Save' : 'Add'}
        busy={busy}
        onChange={draft => {
          setEditor(current => (current ? { ...current, draft } : current));
        }}
        onClose={() => setEditor(null)}
        onSubmit={() => {
          if (!editor?.draft.title.trim()) {
            return;
          }
          const current = editor;
          void run(async () => {
            if (current.kind === 'create') {
              await createTodo(current.draft);
            } else {
              await updateTodo(current.todoId, current.draft);
            }
            setEditor(null);
          });
        }}
      />
    </Container>
  );
}
