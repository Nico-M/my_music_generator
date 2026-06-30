import path from 'path';

export const DATA_DIR =
  process.env.DATA_DIR ?? path.resolve(process.cwd(), '../data');

export const UPLOADS_DIR =
  process.env.UPLOADS_DIR ?? path.join(DATA_DIR, 'uploads');

export const RENDERS_DIR =
  process.env.RENDERS_DIR ?? path.join(DATA_DIR, 'renders');

export const DATABASE_URL =
  process.env.DATABASE_URL ?? `file:${path.join(DATA_DIR, 'sqlite.db')}`;
