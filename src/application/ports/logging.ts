/**
 * Port définissant une interface standard pour les services de logging
 * à travers l'application.
 */
export interface ILogger {
  /** Loggue un message d'information standard. */
  log(message: string, ...optionalParams: unknown[]): void;

  /** Loggue un message d'avertissement. */
  warn(message: string, ...optionalParams: unknown[]): void;

  /** Loggue une erreur, potentiellement avec un objet Error associé. */
  error(message: string, error?: unknown, ...optionalParams: unknown[]): void;

  /** Loggue un message de débogage (utile en développement). */
  debug(message: string, ...optionalParams: unknown[]): void;
} 