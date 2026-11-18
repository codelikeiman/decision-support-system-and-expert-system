import 'next-auth';
import 'next-auth/jwt';

type PeranPengguna = 'super_admin' | 'admin' | 'end_user';

declare module 'next-auth' {
  interface Session {
    user: {
      id: number;
      name: string;
      email: string;
      role: PeranPengguna;
      clientId: number | null;
      clientSlug: string | null;
    };
  }
  interface User {
    role: PeranPengguna;
    clientId: number | null;
    clientSlug: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid: number;
    role: PeranPengguna;
    clientId: number | null;
    clientSlug: string | null;
  }
}
