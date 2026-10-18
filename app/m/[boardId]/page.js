import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listBoards, getBoardTree, getFieldOptions } from '@/lib/data/boards';
import { getPrefs } from '@/lib/data/prefs';
import { getProfile } from '@/lib/data/profiles';
import MobileApp from '@/components/mobile/MobileApp';

export default async function MobileBoardPage({ params, searchParams }) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();

  let board;
  try {
    board = await getBoardTree(sb, params.boardId);
  } catch {
    board = null;
  }
  // Deleted board or a stale link: fall back to the first board.
  if (!board) redirect('/m');

  const [boards, options, prefs, profile] = await Promise.all([
    listBoards(sb),
    getFieldOptions(sb, params.boardId),
    getPrefs(sb, user.id, params.boardId),
    getProfile(sb, user.id),
  ]);

  return (
    <MobileApp
      key={board.id}
      user={{ id: user.id, email: user.email }}
      profile={profile}
      boards={boards}
      board={board}
      options={options}
      prefs={prefs}
      initialDealId={typeof searchParams?.deal === 'string' ? searchParams.deal : null}
    />
  );
}
