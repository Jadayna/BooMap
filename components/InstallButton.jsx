'use client'

import { useState, useEffect } from 'react'

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSModal, setShowIOSModal] = useState(false)

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase()
    setIsIOS(/iphone|ipad|ipod/.test(ua))

    const handlePrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handlePrompt)
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt)
  }, [])

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSModal(true)
    } else if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setDeferredPrompt(null)
    } else {
      setShowIOSModal(true)
    }
  }

  return (
    <>
      <button 
        onClick={handleInstall}
        className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-xl shadow-lg transition flex items-center gap-2"
      >
        📲 Télécharger l'application
      </button>

      {showIOSModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 text-white">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl max-w-sm text-center">
            <h3 className="text-xl font-bold mb-3">Installer BooMap</h3>
            <p className="text-sm text-slate-300 mb-4">
              {isIOS ? (
                <>
                  1. Appuyez sur le bouton <span className="text-orange-400 font-bold">Partager</span> (icône <span className="border px-1.5 py-0.5 rounded">⎋</span> en bas de Safari).<br/><br/>
                  2. Sélectionnez <span className="text-orange-400 font-bold">Sur l'écran d'accueil</span> ➕.
                </>
              ) : (
                <>
                  Ouvrez le menu du navigateur (3 petits points) et choisissez <span className="text-orange-400 font-bold">Installer l'application</span> ou <span className="text-orange-400 font-bold">Ajouter à l'écran d'accueil</span>.
                </>
              )}
            </p>
            <button 
              onClick={() => setShowIOSModal(false)}
              className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  )
}
