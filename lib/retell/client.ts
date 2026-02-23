/**
 * Server-only Retell REST client.
 *
 * Uses RETELL_API_KEY from server env — NEVER expose to the browser.
 * Handles auth header, JSON parsing, and retry for 429/5xx.
 */

const DEFAULT_BASE_URL = 'https://api.retellai.com'
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000

export class RetellApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message)
    this.name = 'RetellApiError'
  }
}

interface RetellClient {
  request: <T = unknown>(path: string, init?: RequestInit) => Promise<T>
}

export function getRetellClient(): RetellClient {
  const apiKey = process.env.RETELL_API_KEY
  if (!apiKey) {
    throw new Error('[retell] RETELL_API_KEY env var is not set')
  }

  const baseUrl = process.env.RETELL_API_BASE_URL || DEFAULT_BASE_URL

  async function request<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    const url = `${baseUrl}${path}`
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string> | undefined),
    }

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt))
      }

      try {
        const res = await fetch(url, { ...init, headers })

        if (res.ok) {
          // Some endpoints return 204 No Content
          if (res.status === 204) return {} as T
          return (await res.json()) as T
        }

        // Retry on 429 (rate limit) or 5xx
        if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
          lastError = new RetellApiError(
            `Retell API ${res.status}: ${res.statusText}`,
            res.status,
          )
          continue
        }

        // Non-retriable error
        const body = await res.json().catch(() => ({}))
        throw new RetellApiError(
          `Retell API ${res.status}: ${JSON.stringify(body)}`,
          res.status,
          body,
        )
      } catch (err) {
        if (err instanceof RetellApiError) throw err
        lastError = err instanceof Error ? err : new Error(String(err))
        if (attempt >= MAX_RETRIES) break
      }
    }

    throw lastError ?? new Error('Retell API request failed')
  }

  return { request }
}
