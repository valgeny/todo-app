import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import type { TodoDraft } from './api';
import { TodoFields } from './TodoFields';

export function TodoDialog({
  open,
  title,
  draft,
  idPrefix,
  submitLabel,
  busy,
  onChange,
  onClose,
  onSubmit
}: {
  open: boolean;
  title: string;
  draft: TodoDraft;
  idPrefix: string;
  submitLabel: string;
  busy: boolean;
  onChange: (draft: TodoDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <Box
        component="form"
        onSubmit={event => {
          event.preventDefault();
          if (!draft.title.trim() || busy) {
            return;
          }
          onSubmit();
        }}
      >
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TodoFields draft={draft} onChange={onChange} idPrefix={idPrefix} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={busy || !draft.title.trim()}>
            {submitLabel}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
