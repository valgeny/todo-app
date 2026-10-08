import 'reflect-metadata';
import { startApp } from './app';

startApp().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
