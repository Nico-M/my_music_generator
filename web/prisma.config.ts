import path from 'path';
import { defineConfig } from "prisma/config";

const dataDir = process.env.DATA_DIR ?? path.resolve(process.cwd(), "../data");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? `file:${path.join(dataDir, "sqlite.db")}`,
  },
});
