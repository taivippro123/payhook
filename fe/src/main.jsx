import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.jsx'
import faviconIco from '@/assets/favicon.ico?url'
import favicon32 from '@/assets/favicon-32x32.png'
import favicon16 from '@/assets/favicon-16x16.png'
import appleTouchIcon from '@/assets/apple-touch-icon.png'
import android192 from '@/assets/android-chrome-192x192.png'
import android512 from '@/assets/android-chrome-512x512.png'

const updateHeadAssets = () => {
  const setLink = ({ id, rel, ...attrs }) => {
    let link = id ? document.getElementById(id) : null
    if (!link) {
      link = document.createElement('link')
      if (id) {
        link.id = id
      }
      link.rel = rel
      document.head.appendChild(link)
    } else {
      link.rel = rel
    }

    Object.entries(attrs).forEach(([key, value]) => {
      if (value) {
        link.setAttribute(key, value)
      }
    })
  }

  const setMeta = (name, content) => {
    let meta = document.querySelector(`meta[name="${name}"]`)
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', name)
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', content)
  }

  setLink({ id: 'app-favicon-ico', rel: 'icon', href: faviconIco })
  setLink({ id: 'app-favicon-32', rel: 'icon', type: 'image/png', sizes: '32x32', href: favicon32 })
  setLink({ id: 'app-favicon-16', rel: 'icon', type: 'image/png', sizes: '16x16', href: favicon16 })
  setLink({ id: 'app-apple-icon', rel: 'apple-touch-icon', sizes: '180x180', href: appleTouchIcon })

  const manifest = {
    name: 'Payhook',
    short_name: 'Payhook',
    icons: [
      { src: android192, sizes: '192x192', type: 'image/png' },
      { src: android512, sizes: '512x512', type: 'image/png' },
    ],
    theme_color: '#4515FF',
    background_color: '#ffffff',
    display: 'standalone',
  }

  const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' })
  const manifestUrl = URL.createObjectURL(manifestBlob)
  setLink({ id: 'app-manifest', rel: 'manifest', href: manifestUrl })

  setMeta('theme-color', manifest.theme_color)
}

updateHeadAssets()

const helmetContext = {}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider context={helmetContext}>
      <App />
    </HelmetProvider>
  </StrictMode>,
)
