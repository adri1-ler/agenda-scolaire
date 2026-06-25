import { useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../api/axios'
import { usersApi } from '../../api/users.api'
import Avatar from '../../components/ui/Avatar'

const profileSchema = z.object({
  nom: z.string().min(1),
  prenom: z.string().min(1),
  matiere: z.string().optional(),
  classe_id: z.string().optional(),
})

const passwordSchema = z.object({
  ancien_mot_de_passe: z.string().min(1),
  nouveau_mot_de_passe: z.string().min(8, 'Minimum 8 caractères'),
})

export default function ProfilePage() {
  const { user, setUser } = useAuthStore()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const uploadPhoto = useMutation({
    mutationFn: (file: File) => usersApi.uploadPhoto(file),
    onSuccess: (updated) => {
      setUser(updated)
      qc.invalidateQueries({ queryKey: ['me'] })
      qc.invalidateQueries({ queryKey: ['users-list'] })
      toast.success('Photo de profil mise à jour')
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Erreur lors de l\'envoi'),
  })

  const removePhoto = useMutation({
    mutationFn: () => usersApi.deletePhoto(),
    onSuccess: (updated) => {
      setUser(updated)
      qc.invalidateQueries({ queryKey: ['me'] })
      qc.invalidateQueries({ queryKey: ['users-list'] })
      toast.success('Photo supprimée')
    },
  })

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadPhoto.mutate(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  const { data: classes = [] } = useQuery({
    queryKey: ['classes-public'],
    queryFn: () => api.get<{ id: string; nom: string; niveau: string | null }[]>('/classes/public').then(r => r.data),
    enabled: user?.role === 'eleve',
  })

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { nom: user?.nom, prenom: user?.prenom },
  })
  const pwForm = useForm({ resolver: zodResolver(passwordSchema) })

  const updateProfile = useMutation({
    mutationFn: (data: any) => api.put(`/users/${user?.id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['me'] }); toast.success('Profil mis à jour') },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  })

  const changePassword = useMutation({
    mutationFn: (data: any) => api.put(`/users/${user?.id}/password`, data),
    onSuccess: () => { pwForm.reset(); toast.success('Mot de passe modifié') },
    onError: () => toast.error('Ancien mot de passe incorrect'),
  })

  const onSubmitProfile = (data: any) => {
    const payload: any = { nom: data.nom, prenom: data.prenom }
    if (data.matiere) payload.matiere = data.matiere
    if (data.classe_id) payload.classe_id = data.classe_id
    updateProfile.mutate(payload)
  }

  return (
    <div className="max-w-lg space-y-8">
      <h1 className="font-display text-3xl text-primary-950 tracking-tight">Mon profil</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center gap-5">
        <Avatar photoUrl={user?.photo_url} prenom={user?.prenom} nom={user?.nom} size={80} />
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Photo de profil</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={onPickPhoto}
            className="hidden"
          />
          <div className="flex gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadPhoto.isPending}
              className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
            >
              {uploadPhoto.isPending ? 'Envoi…' : 'Changer la photo'}
            </button>
            {user?.photo_url && (
              <button
                onClick={() => removePhoto.mutate()}
                disabled={removePhoto.isPending}
                className="px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50"
              >
                Retirer
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400">JPEG, PNG, WebP ou GIF · 5 Mo max</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Informations personnelles</h2>
        <form onSubmit={profileForm.handleSubmit(onSubmitProfile)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
              <input {...profileForm.register('prenom')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
              <input {...profileForm.register('nom')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          {user?.role === 'prof' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Matière</label>
              <input {...profileForm.register('matiere')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          )}
          {user?.role === 'eleve' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Classe</label>
              <select
                {...profileForm.register('classe_id')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Ne pas changer —</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nom}{c.niveau ? ` (${c.niveau})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            type="submit"
            disabled={updateProfile.isPending}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
          >
            {updateProfile.isPending ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Changer le mot de passe</h2>
        <form onSubmit={pwForm.handleSubmit(d => changePassword.mutate(d))} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe actuel</label>
            <input type="password" {...pwForm.register('ancien_mot_de_passe')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
            <input type="password" {...pwForm.register('nouveau_mot_de_passe')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            {pwForm.formState.errors.nouveau_mot_de_passe && (
              <p className="text-red-500 text-xs mt-1">{pwForm.formState.errors.nouveau_mot_de_passe.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={changePassword.isPending}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50"
          >
            {changePassword.isPending ? 'Modification…' : 'Modifier'}
          </button>
        </form>
      </div>
    </div>
  )
}
