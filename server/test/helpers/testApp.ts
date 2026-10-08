import type { Application } from 'express';
import type { DataSource } from 'typeorm';
import { createApp } from '@/app';
import { closeDb, createDataSource } from '@/providers/db';

export const startTestApp = async (): Promise<{ app: Application; dataSource: DataSource }> => {
  const dataSource = createDataSource({
    database: ':memory:',
    logging: false
  });
  const app = await createApp(dataSource);
  return { app, dataSource };
};

export const stopTestApp = async (): Promise<void> => {
  await closeDb();
};
