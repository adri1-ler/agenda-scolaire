import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { api } from '../../api/axios'
import Avatar from '../../components/ui/Avatar'

export default function ClassManagementPage() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [emailSearch, setEmailSearch] = useState('')

  const { data: classes = [] } = useQuery({ queryKey: ['classes'], queryFn: () => api.get('/classes').then(r => r.data) })
  const { data: students = [] } = useQuery({
    queryKey: ['classes', selected, 'students'],
    queryFn: () => api.get(`/classes/${selected}/students`).then(r => r.data),
    enabled: !!selected,
  })

  const createClass = useMutation({
    mutationFn: (data: any) => api.post('/classes', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['classes'] }); setShowCreate(false); toast.success('Classe créée') },
  })

  const removeStudent = useMutation({
    mutationFn: (eleveId: string) => api.delete(`/classes/${selected}/students/${eleveId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['classes', selected, 'students'] }); toast.success('Élève retiré') },
  })

  const { register, handleSubmit, reset } = useForm()
  const onCreateClass = (data: any) => createClass.mutate(data)

  const addStudentByEmail = useMutation({
    mutationFn: async (email: string) => {
      const users = await api.get('/users/search', { params: { email } }).then(r => r.data)
      if (!users?.id) throw new Error('Utilisateur introuvable')
      return api.post(`/classes/${selected}/students`, { eleve_id: users.id })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['classes', selected, 'students'] }); setEmailSearch(''); toast.success('Élève ajouté') },
    onError: (e: any) => toast.error(e?.message || 'Erreur'),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-primary-950 tracking-tight">Mes classes</h1>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">
          + Nouvelle classe
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          {classes.length === 0 && <p className="text-sm text-gray-400">Aucune classe créée</p>}
          {classes.map((c: any) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={`w-full text-left p-4 rounded-xl border transition-colors ${selected === c.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
            >
              <p className="font-medium text-gray-800">{c.nom}</p>
              {c.niveau && <p className="text-xs text-gray-400 mt-0.5">{c.niveau}</p>}
            </button>
          ))}
        </div>

        {selected && (
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Élèves ({students.length})</h2>

            <div className="flex gap-2">
              <input
                value={emailSearch}
                onChange={e => setEmailSearch(e.target.value)}
                placeholder="Email de l'élève à ajouter"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                onKeyDown={e => e.key === 'Enter' && emailSearch && addStudentByEmail.mutate(emailSearch)}
              />
              <button
                onClick={() => emailSearch && addStudentByEmail.mutate(emailSearch)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
              >
                Ajouter
              </button>
            </div>

            <div className="space-y-2">
              {students.map((s: any) => (
                <div key={s.user_id} className="flex items-center justify-between py-2 border-b border-gray-50">
                  <div className="flex items-center gap-3">
                    <Avatar photoUrl={s.photo_url} prenom={s.prenom} nom={s.nom} size={36} />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{s.prenom} {s.nom}</p>
                      <p className="text-xs text-gray-400">{s.email}</p>
                    </div>
                  </div>
                  <button onClick={() => removeStudent.mutate(s.user_id)} className="text-xs text-red-500 hover:text-red-700">
                    Retirer
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Créer une classe</h2>
            <form onSubmit={handleSubmit(onCreateClass)} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la classe</label>
                <input {...register('nom', { required: true })} placeholder="ex: Terminale A" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Niveau (optionnel)</label>
                <input {...register('niveau')} placeholder="ex: Terminale" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setShowCreate(false); reset() }} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
                <button type="submit" disabled={createClass.isPending} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                  {createClass.isPending ? 'Création…' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
