import { useEffect, useState, useCallback } from 'react'
import { useOnlineStatus } from './useOnlineStatus'
import { synchroniserVentesEnAttente, compterVentesEnAttente } from '../lib/sync'
import toast from 'react-hot-toast'

export function useSyncOffline() {
  const isOnline = useOnlineStatus()
  const [enSynchronisation, setEnSynchronisation] = useState(false)
  const [enAttente, setEnAttente] = useState(0)

  const rafraichirCompteur = useCallback(async () => {
    const n = await compterVentesEnAttente()
    setEnAttente(n)
  }, [])

  const lancerSync = useCallback(async (afficherToast = true) => {
    setEnSynchronisation(true)
    try {
      const { succes, echecs, total } = await synchroniserVentesEnAttente()
      if (total > 0 && afficherToast) {
        if (echecs === 0) {
          toast.success(`${succes} vente${succes > 1 ? 's' : ''} synchronisée${succes > 1 ? 's' : ''} avec succès !`)
        } else {
          toast.error(`${succes}/${total} ventes synchronisées. ${echecs} en échec — nouvelle tentative au prochain rafraîchissement.`)
        }
      }
    } finally {
      setEnSynchronisation(false)
      await rafraichirCompteur()
    }
  }, [rafraichirCompteur])

  // Au montage : vérifie s'il y a des ventes en attente
  useEffect(() => {
    rafraichirCompteur()
  }, [rafraichirCompteur])

  // Dès que la connexion revient, synchronise automatiquement
  useEffect(() => {
    if (isOnline) {
      lancerSync()
    }
  }, [isOnline, lancerSync])

  return { isOnline, enSynchronisation, enAttente, lancerSync, rafraichirCompteur }
}
