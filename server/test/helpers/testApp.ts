import type { Application } from 'express';
import type { DataSource } from 'typeorm';
import { createApp } from '@/app';
import { config } from '@/config';
import { closeDb, createDataSource } from '@/providers/db';

export const baseUrl = `http://localhost:${config.port}`;
export const loopbackUrl = `http://127.0.0.1:${config.port}`;

export const endpoint = (path: string): string => {
  const url = new URL(path, `${baseUrl}/`);
  return `${url.pathname}${url.search}`;
};

export const startTestApp = async (): Promise<{ app: Application; dataSource: DataSource }> => {
  const dataSource = createDataSource({ logging: false });
  const app = await createApp(dataSource);
  return { app, dataSource };
};

export const stopTestApp = async (): Promise<void> => {
  await closeDb();
};
