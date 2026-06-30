import { PrismaClient } from '../generated/prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const adapter = new PrismaLibSql({
  url: 'file:/home/nico/Workspace/Documents/demo/nestjs/singing_video/data/sqlite.db',
});

const prisma = new PrismaClient({ adapter });

export { prisma };
