export default function manifest() {
  return {
    name: 'Caymus',
    short_name: 'Caymus',
    description: 'Caymus Mortgage Capital deal pipeline',
    start_url: '/m',
    scope: '/m',
    display: 'standalone',
    background_color: '#f3f4f7',
    theme_color: '#ffffff',
    icons: [{ src: '/m/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
