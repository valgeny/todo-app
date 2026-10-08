import { DEFAULT_PORT, DEFAULT_SQLITE_PATH } from './consts';

export const applicationName = 'todo-app';
export const port: number = parseInt(process.env.PORT || '', 10) || DEFAULT_PORT;
export const version = '1.0.0';
export const sqlitePath: string = process.env.SQLITE_PATH || DEFAULT_SQLITE_PATH;

const requiredParameters = {
  applicationName,
  port,
  version,
  sqlitePath
};

const validateUndefinedConfig = (config: object): void => {
  Object.entries(config).forEach(entry => {
    const [key, value] = entry;
    if (value === undefined || value === null) {
      throw new Error(`the required config parameter ${key} is undefined/null`);
    }
    if (typeof value === 'object') {
      validateUndefinedConfig(value);
    }
  });
};

validateUndefinedConfig(requiredParameters);
