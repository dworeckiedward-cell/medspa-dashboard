/**
 * Structured Logger — lightweight server/client logging helper.
 *
 * Provides consistent log formatting with context (tenant, route, action).
 * No external vendor lock-in — outputs to console with structured prefixes.
 *
 * Usage:
 *   import { log } from '@/lib/logger'
 *   log.info('onboarding.save', { tenantId, step })
 *   log.error('delivery.failed', { tenantId, provider, error: err.message })
 *   log.warn('config.missing', { key: 'WEBHOOK_API_KEY' })
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  tenantId?: string
  route?: string
  action?: string
  [key: string]: unknown
}

function formatMessage(level: LogLevel, action: string, context?: LogContext): string {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`
  const ctx = context
    ? ' ' + Object.entries(context)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join(' ')
    : ''
  return `${prefix} ${action}${ctx}`
}

function shouldLog(level: LogLevel): boolean {
  // In production, suppress debug logs
  if (process.env.NODE_ENV === 'production' && level === 'debug') return false
  return true
}

export const log = {
  debug(action: string, context?: LogContext) {
    if (!shouldLog('debug')) return
    console.debug(formatMessage('debug', action, context))
  },

  info(action: string, context?: LogContext) {
    if (!shouldLog('info')) return
    console.info(formatMessage('info', action, context))
  },

  warn(action: string, context?: LogContext) {
    if (!shouldLog('warn')) return
    console.warn(formatMessage('warn', action, context))
  },

  error(action: string, context?: LogContext) {
    if (!shouldLog('error')) return
    console.error(formatMessage('error', action, context))
  },

  /** Time an async operation and log the result */
  async timed<T>(action: string, fn: () => Promise<T>, context?: LogContext): Promise<T> {
    const start = performance.now()
    try {
      const result = await fn()
      const ms = Math.round(performance.now() - start)
      log.info(action, { ...context, durationMs: ms })
      return result
    } catch (err) {
      const ms = Math.round(performance.now() - start)
      log.error(action, { ...context, durationMs: ms, error: String(err) })
      throw err
    }
  },
} as const
