import './globals.css'
import { Toaster } from 'sonner'

export const metadata = {
  title: 'BooMap — Real-time Trick-or-Treat Map',
  description: 'Find houses giving out candy in real time. Register your house, set your giving hours, and light up the map. 🎃',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Creepster&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased" style={{ fontFamily: "'Inter', sans-serif" }}>
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  )
}
