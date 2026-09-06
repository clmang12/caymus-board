'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function Sidebar({ boards, activeId, user }) {
  const router = useRouter();

  async function signOut() {
    const sb = createClient();
    await sb.auth.signOut();
    router.push('/login');
  }

  return (
    <aside style={{
      width: 240, flex: '0 0 240px', borderRight: '1px solid #e6e9ef',
      background: '#fff', display: 'flex', flexDirection: 'column',
      padding: '16px 10px'
    }}>
      <div style={{
        fontSize: 10, fontWeight: 800, letterSpacing: '.12em',
        color: '#0073ea', padding: '0 8px 14px'
      }}>CAYMUS</div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {boards.map((b) => (
          <Link key={b.id} href={'/board/' + b.id} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
            borderRadius: 6, fontSize: 13.5, textDecoration: 'none',
            fontWeight: b.id === activeId ? 700 : 500,
            background: b.id === activeId ? '#e5f0fd' : 'transparent',
            color: b.id === activeId ? '#0073ea' : '#323338'
          }}>
            <span style={{
              width: 14, height: 14, flex: '0 0 auto', borderRadius: 3,
              border: '1.6px solid currentColor'
            }} />
            {b.name}
          </Link>
        ))}
      </nav>

      <div style={{ borderTop: '1px solid #f0f2f7', paddingTop: 12 }}>
        <div style={{
          fontSize: 12, color: '#676879', padding: '0 8px 6px',
          overflow: 'hidden', textOverflow: 'ellipsis'
        }}>{user.email}</div>
        <button onClick={signOut} style={{
          background: 'none', border: 'none', padding: '4px 8px', fontSize: 12,
          fontFamily: 'inherit', color: '#676879', cursor: 'pointer'
        }}>Sign out</button>
      </div>
    </aside>
  );
}
