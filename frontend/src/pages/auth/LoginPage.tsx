import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { authApi } from '../../api/auth.api'
import { useAuthStore } from '../../store/authStore'

const schema = z.object({
  email: z.string().email('Email invalide'),
  mot_de_passe: z.string().min(1, 'Mot de passe requis'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { setTokens } = useAuthStore()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try {
      const tokens = await authApi.login(data.email, data.mot_de_passe)
      setTokens(tokens.access_token, tokens.refresh_token)
      await queryClient.invalidateQueries({ queryKey: ['me'] })
      navigate('/schedule')
    } catch {
      toast.error('Email ou mot de passe incorrect')
    }
  }

  return (
    <div className="min-h-screen flex bg-warm-50">
      {/* Hero panel — desktop only */}
      <div className="hidden lg:flex flex-col justify-center px-16 bg-primary-950 relative overflow-hidden w-[460px] shrink-0">
        {/* Abstract calendar grid decoration */}
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
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Brand on mobile */}
        <div className="lg:hidden mb-8 text-center">
          <span className="font-display text-4xl text-primary-950">AgendaScope</span>
        </div>

        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Connexion</h1>
          <p className="text-slate-500 mb-8 text-sm">Accédez à votre agenda scolaire</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                autoComplete="email"
                {...register('email')}
                className="w-full border border-warm-200 bg-white rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
                placeholder="prenom.nom@ecole.fr"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1.5">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Mot de passe</label>
              <input
                type="password"
                autoComplete="current-password"
                {...register('mot_de_passe')}
                className="w-full border border-warm-200 bg-white rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors"
                placeholder="••••••••"
              />
              {errors.mot_de_passe && <p className="text-red-500 text-xs mt-1.5">{errors.mot_de_passe.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              {isSubmitting ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-8">
            Pas encore de compte ?{' '}
            <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
