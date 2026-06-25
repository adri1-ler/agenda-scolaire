import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/axios'
import { authApi } from '../../api/auth.api'
import { useAuthStore } from '../../store/authStore'

const schema = z.object({
  nom: z.string().min(1, 'Nom requis'),
  prenom: z.string().min(1, 'Prénom requis'),
  email: z.string().email('Email invalide'),
  mot_de_passe: z.string().min(8, 'Minimum 8 caractères'),
  role: z.enum(['eleve', 'prof']),
  matiere: z.string().optional(),
  classe_id: z.string().optional(),
}).refine((d) => d.role !== 'prof' || (d.matiere && d.matiere.length > 0), {
  message: 'La matière est obligatoire pour un professeur',
  path: ['matiere'],
})

type FormData = z.infer<typeof schema>

const inputClass = 'w-full border border-warm-200 bg-white rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors'

export default function RegisterPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { setTokens } = useAuthStore()
  const [role, setRole] = useState<'eleve' | 'prof'>('eleve')

  const { data: classes = [] } = useQuery({
    queryKey: ['classes-public'],
    queryFn: () => api.get<{ id: string; nom: string; niveau: string | null }[]>('/classes/public').then(r => r.data),
  })

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'eleve' },
  })

  const selectRole = (r: 'eleve' | 'prof') => {
    setRole(r)
    setValue('role', r)
  }

  const onSubmit = async (data: FormData) => {
    try {
      const payload: any = {
        nom: data.nom,
        prenom: data.prenom,
        email: data.email,
        mot_de_passe: data.mot_de_passe,
        role: data.role,
      }
      if (data.role === 'prof') payload.matiere = data.matiere
      if (data.role === 'eleve' && data.classe_id) payload.classe_id = data.classe_id

      await authApi.register(payload)
      const tokens = await authApi.login(data.email, data.mot_de_passe)
      setTokens(tokens.access_token, tokens.refresh_token)
      await queryClient.invalidateQueries({ queryKey: ['me'] })
      navigate('/schedule')
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Erreur lors de l\'inscription')
    }
  }

  return (
    <div className="min-h-screen flex bg-warm-50">
      {/* Hero panel — desktop only */}
      <div className="hidden lg:flex flex-col justify-center px-16 bg-primary-950 relative overflow-hidden w-[460px] shrink-0">
        <div className="absolute top-12 right-8 grid grid-cols-7 gap-1.5 opacity-[0.07]">
          {Array.from({ length: 42 }).map((_, i) => (
            <div
              key={i}
              className={`w-6 h-6 rounded ${i % 7 === 5 || i % 7 === 6 ? 'bg-accent-400' : 'bg-white'}`}
            />
          ))}
        </div>
        <div className="relative z-10">
          <span className="font-display text-5xl text-white leading-tight block mb-6">
            AgendaScope
          </span>
          <p className="text-white text-lg leading-relaxed">
            Organisez vos cours, planifiez vos révisions, communiquez avec vos enseignants.
          </p>
          <div className="mt-10 flex items-center gap-3">
            <div className="w-8 h-0.5 bg-accent-500 rounded" />
            <span className="text-accent-400 text-sm font-medium tracking-wide">
              Agenda scolaire intelligent
            </span>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 overflow-y-auto">
        <div className="lg:hidden mb-6 text-center">
          <span className="font-display text-4xl text-primary-950">AgendaScope</span>
        </div>

        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Créer un compte</h1>
          <p className="text-slate-500 mb-6 text-sm">Rejoignez l'agenda scolaire</p>

          {/* Role selector */}
          <div className="flex gap-3 mb-6">
            {(['eleve', 'prof'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => selectRole(r)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                  role === r
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'border-warm-200 bg-white text-slate-600 hover:border-primary-400'
                }`}
              >
                {r === 'eleve' ? '🎓 Élève' : '👨‍🏫 Professeur'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Prénom</label>
                <input {...register('prenom')} className={inputClass} />
                {errors.prenom && <p className="text-red-500 text-xs mt-1">{errors.prenom.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom</label>
                <input {...register('nom')} className={inputClass} />
                {errors.nom && <p className="text-red-500 text-xs mt-1">{errors.nom.message}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input type="email" autoComplete="email" {...register('email')} className={inputClass} />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Mot de passe</label>
              <input type="password" autoComplete="new-password" {...register('mot_de_passe')} className={inputClass} placeholder="8 caractères minimum" />
              {errors.mot_de_passe && <p className="text-red-500 text-xs mt-1">{errors.mot_de_passe.message}</p>}
            </div>

            {role === 'prof' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Matière enseignée</label>
                <input {...register('matiere')} placeholder="ex: Mathématiques" className={inputClass} />
                {errors.matiere && <p className="text-red-500 text-xs mt-1">{errors.matiere.message}</p>}
              </div>
            )}

            {role === 'eleve' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Classe <span className="text-slate-400 font-normal">(optionnel)</span>
                </label>
                <select {...register('classe_id')} className={inputClass}>
                  <option value="">— Aucune classe pour l'instant —</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom}{c.niveau ? ` (${c.niveau})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">Un professeur peut aussi vous ajouter plus tard.</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              {isSubmitting ? 'Création du compte…' : 'Créer mon compte'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
