import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: "file:/home/nico/Workspace/Documents/demo/nestjs/singing_video/data/sqlite.db",
  },
});
