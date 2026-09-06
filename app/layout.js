export const metadata = {
  title: 'CAYMUS Board',
  description: 'Caymus Mortgage Capital deal pipeline'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{
        margin: 0,
        fontFamily: 'Figtree, system-ui, sans-serif',
        background: '#ffffff',
        color: '#323338'
      }}>
        {children}
      </body>
    </html>
  );
}
