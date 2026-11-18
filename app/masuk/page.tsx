import { redirect } from 'next/navigation';
import { berandaUntuk, getCurrentUser } from '@/lib/guards';

/** Pengalih pasca-login: arahkan pengguna ke beranda sesuai perannya. */
export default async function MasukPage() {
  const user = await getCurrentUser();
  redirect(user ? berandaUntuk(user) : '/login');
}
