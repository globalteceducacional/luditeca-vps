/**
 * Cria o primeiro utilizador na base (fora do registo público).
 * Uso: npx tsx scripts/create-admin.ts admin@exemplo.pt "SenhaSegura"
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = String(process.argv[2] || '')
    .trim()
    .toLowerCase();
  const password = String(process.argv[3] || '');
  if (!email || !password) {
    console.error('Uso: npx tsx scripts/create-admin.ts <email> <senha>');
    process.exit(1);
  }
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    console.error('Email já existe.');
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: null,
      role: 'admin',
    },
  });
  await prisma.profile.create({ data: { userId: user.id } });
  console.log('Utilizador criado:', user.id, user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
