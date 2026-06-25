import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { authApi } from '../api/auth.api'
import { useAuthStore } from '../store/authStore'

export function useCurrentUser() {
  const { setUser, isAuthenticated } = useAuthStore()

  const query = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
    enabled: isAuthenticated,
    retry: false,
  })

  useEffect(() => {
    if (query.data) setUser(query.data)
  }, [query.data, setUser])

  return query
}
