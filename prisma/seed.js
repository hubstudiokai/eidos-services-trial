// Inserts the first note, so that the preview shows one row at once.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  await prisma.note.create({ data: { body: 'Note de départ' } });
} finally {
  await prisma.$disconnect();
}
