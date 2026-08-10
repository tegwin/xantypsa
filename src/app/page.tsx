export const dynamic = 'force-dynamic';

import { getAppSession } from '@/lib/session';
import { redirect } from 'next/navigation';

export default async function Home() {
  const session = await getAppSession();
  if (session) redirect('/dashboard');
  redirect('/login');
}
