import { PrismaClient } from '@prisma/client';

// Global singleton pattern for PrismaClient to avoid multiple connection pools
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

globalForPrisma.prisma = prisma;

export default prisma;
