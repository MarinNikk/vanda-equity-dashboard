// All server state lives here. Each (symbol, from, to) is its own cache key.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from './client'
import type { SeriesResponse, SymbolInfo, User } from './types'

export const meKey = ['auth', 'me'] as const

export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: () => apiFetch<User>('/auth/me'),
    retry: false, // 401 = not logged in
    staleTime: Infinity,
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (creds: { username: string; password: string }) =>
      apiFetch<User>('/auth/login', { method: 'POST', body: JSON.stringify(creds) }),
    onSuccess: (user) => qc.setQueryData(meKey, user),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
    // wipe the cache so the next user starts clean
    onSettled: () => {
      qc.setQueryData(meKey, null)
      qc.clear()
    },
  })
}

export function useSymbols() {
  return useQuery({
    queryKey: ['symbols'],
    queryFn: () => apiFetch<SymbolInfo[]>('/symbols'),
    staleTime: Infinity,
  })
}

export function useSeries(symbol: string | null, from: string, to: string) {
  return useQuery({
    queryKey: ['series', symbol, from, to],
    queryFn: () =>
      apiFetch<SeriesResponse>(
        `/series?symbol=${encodeURIComponent(symbol as string)}&from=${from}&to=${to}`,
      ),
    enabled: Boolean(symbol),
    staleTime: 5 * 60 * 1000, // daily data, doesn't move intraday
    // keep the old window on screen while the new one loads — no spinner flash
    placeholderData: (prev) => prev,
  })
}
