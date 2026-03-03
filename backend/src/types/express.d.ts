import { Express } from 'express';

type JwtPayload = {
  sub: string;
  email?: string;
  name?: string;
  picture?: null;
  iat?: number;
};

declare global {
  namespace Express {
    interface User extends JwtPayload {}
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: Express.User;
  }
}
