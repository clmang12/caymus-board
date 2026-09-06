export default function Onboarding() {
  return (
    <main style={{ maxWidth: 560, margin: '80px auto', padding: '0 24px', lineHeight: 1.6 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 12px' }}>No boards yet</h1>
      <p style={{ color: '#676879', margin: '0 0 20px' }}>
        Your database is connected but empty. Import your existing board data by
        running the seed script from the project root:
      </p>
      <pre style={{
        background: '#f6f7fb', border: '1px solid #e6e9ef', borderRadius: 8,
        padding: '12px 14px', fontSize: 13, overflowX: 'auto'
      }}>npm run seed</pre>
      <p style={{ color: '#676879', marginTop: 20 }}>
        Then reload this page.
      </p>
    </main>
  );
}
