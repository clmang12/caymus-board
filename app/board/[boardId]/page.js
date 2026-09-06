import { createClient } from '@/lib/supabase/server';
import { listBoards, getBoardTree, getFieldOptions } from '@/lib/data/boards';
import BoardShell from '@/components/BoardShell';

export default async function BoardPage({ params }) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();

  const [boards, board, options] = await Promise.all([
    listBoards(sb),
    getBoardTree(sb, params.boardId),
    getFieldOptions(sb, params.boardId)
  ]);

  return (
    <BoardShell
      user={{ id: user.id, email: user.email }}
      boards={boards}
      board={board}
      options={options}
    />
  );
}
