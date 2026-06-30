import { PrismaClient } from '../generated/prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { DATABASE_URL } from './paths';

const adapter = new PrismaLibSql({
  url: DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

export { prisma };
