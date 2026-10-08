import { Router } from 'express';
import {
  deleteTodo,
  getTodo,
  getTodoBulk,
  patchTodo,
  postTodo,
  putTodo
} from '@/controllers/todoCtrl';
import { validate } from '@/utils/validate';

const router: Router = Router();

router.get('/', validate(getTodoBulk.validation), getTodoBulk.handler);
router.post('/', validate(postTodo.validation), postTodo.handler);
router.get('/:todoId', validate(getTodo.validation), getTodo.handler);
router.put('/:todoId', validate(putTodo.validation), putTodo.handler);
router.patch('/:todoId', validate(patchTodo.validation), patchTodo.handler);
router.delete('/:todoId', validate(deleteTodo.validation), deleteTodo.handler);

export default router;
