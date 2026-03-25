import jwt from 'jsonwebtoken';
import type { UserRole } from './roles.js';

const getSecret = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET não definido');
  return s;
};

export function signAccessToken(payload: { sub: string; email: string; role: UserRole }) {
  return jwt.sign(payload, getSecret(), { expiresIn: '7d' });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, getSecret()) as {
    sub: string;
    email: string;
    role: UserRole;
    iat: number;
    exp: number;
  };
}
