import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Role } from '../types'
import { MODULES_ATTRIBUABLES } from '../lib/modules'
import { ShieldCheck, Save, Info } from 'lucide-react'
import toast from 'react-hot-toast'

export default function PermissionsPage() {
  const [roleGestionnaire, setRoleGestionnaire] = useState<Role | null>(null)
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { charger() }, [])

  async function charger() {
    setLoading(true)
    const { data } = await supabase.from('roles').select('*').eq('nom', 'gestionnaire').single()
    if (data) {
      setRoleGestionnaire(data)
      setSelection(new Set((data.permissions as string[]) || []))
    }
    setLoading(false)
  }

  const toggle = (key: string) => {
    setSelection(prev => {
      const nv = new Set(prev)
      if (nv.has(key)) nv.delete(key)
      else nv.add(key)
      return nv
    })
  }

  const sauvegarder = async () => {
    if (!roleGestionnaire) return
    setSaving(true)
    const { error } = await supabase
      .from('roles')
      .update({ permissions: Array.from(selection) })
      .eq('id', roleGestionnaire.id)
    setSaving(false)
    if (error) { toast.error('Erreur lors de la sauvegarde'); return }
    toast.success('Permissions mises à jour ! Les gestionnaires verront les changements à leur prochaine connexion.')
  }

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <ShieldCheck size={20} className="text-gray-600 dark:text-gray-300" />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Rôles et permissions</h1>
      </div>

      <div className="card p-4 flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800">
        <Info size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Coche les sections que les utilisateurs avec le rôle <strong>Gestionnaire</strong> peuvent voir et utiliser.
          L'<strong>Administrateur</strong> a toujours accès à toutes les fonctionnalités.
        </p>
      </div>

      <div className="card p-5">
        <h2 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Accès du rôle Gestionnaire</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MODULES_ATTRIBUABLES.map(m => {
            const Icon = m.icon
            const checked = selection.has(m.key)
            return (
              <label
                key={m.key}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  checked ? 'border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(m.key)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <Icon size={16} className={checked ? 'text-blue-600' : 'text-gray-400'} />
                <span className={`text-sm ${checked ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                  {m.label}
                </span>
              </label>
            )
          })}
        </div>

        <button onClick={sauvegarder} disabled={saving} className="btn-primary mt-5">
          {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <><Save size={16} /> Enregistrer les permissions</>}
        </button>
      </div>
    </div>
  )
}
