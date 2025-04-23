/**
 * Port définissant une interface standard pour les services de logging
 * à travers l'application.
 */
export interface ILogger {
  /** Loggue un message d'information standard. */
  log(message: string, ...optionalParams: any[]): void;

  /** Loggue un message d'avertissement. */
  warn(message: string, ...optionalParams: any[]): void;

  /** Loggue une erreur, potentiellement avec un objet Error associé. */
  error(message: string, error?: Error, ...optionalParams: any[]): void;

  /** Loggue un message de débogage (utile en développement). */
  debug(message: string, ...optionalParams: any[]): void;
} 