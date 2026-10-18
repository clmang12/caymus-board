// Mobile companion app (installable PWA). Same session, data layer and
// realtime as the desktop board; only the UI is different.
export const metadata = {
  title: 'Caymus',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Caymus', statusBarStyle: 'default' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#20222b' },
  ],
};

export default function MobileLayout({ children }) {
  return children;
}
