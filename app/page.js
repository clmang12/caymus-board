import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listBoards } from '@/lib/data/boards';

export default async function Home() {
  const sb = createClient();
  const boards = await listBoards(sb);
  if (!boards.length) redirect('/onboarding');
  redirect('/board/' + boards[0].id);
}
