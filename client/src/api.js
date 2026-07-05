// In prod (Vercel) VITE_API_URL points at the Render backend. In dev it's
// empty, so requests are relative and go through the Vite proxy.
const API_BASE = import.meta.env.VITE_API_URL || ''

// Thin fetch wrapper. All requests send the auth cookie via credentials.
async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  let body = null
  try {
    body = await res.json()
  } catch {
    // no JSON body (e.g. empty response) — leave as null
  }

  if (!res.ok) {
    const error = new Error(body?.message || `Request failed (${res.status})`)
    error.status = res.status
    throw error
  }

  return body
}

export const api = {
  // Full page navigation — GitHub OAuth needs a real redirect, not fetch.
  loginUrl: `${API_BASE}/auth/github`,

  getMe: () => request('/auth/me'),

  updateSlackWebhookUrl: (slackWebhookUrl) =>
    request('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify({ slackWebhookUrl }),
    }),

  logout: () => request('/auth/logout', { method: 'POST' }),

  getRepositories: () => request('/repositories'),

  getConnectedRepository: () => request('/repositories/connected'),

  connectRepository: (githubId) =>
    request('/repositories/select', {
      method: 'POST',
      body: JSON.stringify({ githubId }),
    }),

  getRules: () => request('/rules'),

  getExecutions: () => request('/rules/executions'),

  createRule: (rule) =>
    request('/rules', {
      method: 'POST',
      body: JSON.stringify(rule),
    }),

  deleteRule: (id) => request(`/rules/${id}`, { method: 'DELETE' }),
}
