/**
 * Logger conditionnel — actif uniquement en développement.
 * En production, tous les logs sont silencieux.
 * Remplace tous les console.log/warn/error du projet.
 */
const isDev = (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true

export const logger = {
  log:   (...args: unknown[]) => { if (isDev) console.log(...args) },
  warn:  (...args: unknown[]) => { if (isDev) console.warn(...args) },
  error: (...args: unknown[]) => { if (isDev) console.error(...args) },
  info:  (...args: unknown[]) => { if (isDev) console.info(...args) },
}
