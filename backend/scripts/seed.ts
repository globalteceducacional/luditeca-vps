/// <reference types="node" />
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/lib/password.js';
import type { UserRole } from '../src/lib/roles.js';

type SeedUser = {
  email: string;
  password: string;
  name?: string | null;
  userRole?: UserRole;
  profileRole?: UserRole;
};

const users: SeedUser[] = [
  {
    email: 'admin@globaltec.com',
    password: 'admin123',
    name: 'Admin',
    userRole: 'admin',
    profileRole: 'admin',
  },
  {
    email: 'editor@globaltec.com',
    password: 'editor123',
    name: 'Editor',
    userRole: 'editor',
    profileRole: 'aluno',
  },
  {
    email: 'professor@globaltec.com',
    password: 'professor123',
    name: 'Professor',
    userRole: 'professor',
    profileRole: 'professor',
  },
  {
    email: 'aluno@globaltec.com',
    password: 'aluno123',
    name: 'Aluno',
    userRole: 'aluno',
    profileRole: 'aluno',
  },
];

async function upsertUser(u: SeedUser) {
  const email = u.email.trim().toLowerCase();
  if (!email) throw new Error('Seed inválido: email vazio.');
  if (!u.password) throw new Error(`Seed inválido: password vazio para ${email}.`);

  const passwordHash = await hashPassword(u.password);
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      name: u.name ?? null,
      role: u.userRole ?? 'editor',
    },
    update: {
      passwordHash,
      name: u.name ?? null,
      role: u.userRole ?? 'editor',
    },
  });

  await prisma.profile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, role: u.profileRole ?? 'aluno' },
    update: { role: u.profileRole ?? 'aluno' },
  });

  return user;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL não definido. Configure o .env antes de rodar o seed.');
  }

  const createdOrUpdated: Array<{ id: string; email: string; role: UserRole }> = [];
  for (const u of users) {
    const user = await upsertUser(u);
    createdOrUpdated.push({ id: user.id, email: user.email, role: user.role as UserRole });
  }

  console.log('Seed concluído. Utilizadores prontos para login:');
  for (const u of users) {
    console.log(`- ${u.email}  |  senha: ${u.password}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

