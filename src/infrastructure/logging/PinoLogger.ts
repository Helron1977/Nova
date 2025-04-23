import { pino, type Logger, type LevelWithSilent } from 'pino';
import { ILogger } from '../../application/ports/logging';

// Mapper les valeurs de string possibles à LevelWithSilent (Pino)
// Note: Pino a 'fatal' en plus, et pas de 'trace' direct par défaut pour le browser,
// mais debug couvre ce besoin généralement.
const pinoLevels: { [key: string]: LevelWithSilent } = {
  trace: 'trace', // Pino gère trace aussi
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
  silent: 'silent', // Maintenant valide avec LevelWithSilent
};

/**
 * Implémentation de l'interface ILogger utilisant la librairie Pino.
 */
export class PinoLogger implements ILogger {
  private logger: Logger<LevelWithSilent>;

  constructor() {
    const envLogLevel = import.meta.env.VITE_LOG_LEVEL?.toLowerCase();
    const defaultLevel = import.meta.env.MODE === 'development' ? 'debug' : 'warn';

    // Utiliser LevelWithSilent pour la validation
    const levelToSet: LevelWithSilent = envLogLevel && pinoLevels[envLogLevel]
      ? pinoLevels[envLogLevel]
      : defaultLevel;

    // Initialiser Pino
    // Pino est intelligent sur l'environnement (browser vs node)
    this.logger = pino({
      level: levelToSet,
      // Options spécifiques au navigateur si nécessaire (ex: transport)
      // Par défaut, il log vers console.log/warn/etc dans le navigateur
    });

    this.logger.info(`Logger initialized with level: ${levelToSet}`);
  }

  log(message: string, ...optionalParams: any[]): void {
    this.logger.info(message, ...optionalParams);
  }

  warn(message: string, ...optionalParams: any[]): void {
    this.logger.warn(message, ...optionalParams);
  }

  error(message: string, error?: Error | unknown, ...optionalParams: any[]): void {
    if (error instanceof Error) {
      // Pino gère bien les objets Error directement
      this.logger.error({ err: error }, message, ...optionalParams);
    } else if (error) {
      // Si ce n'est pas une Error mais existe, on le logue
      this.logger.error({ errorContext: error }, message, ...optionalParams);
    } else {
      this.logger.error(message, ...optionalParams);
    }
  }

  debug(message: string, ...optionalParams: any[]): void {
    this.logger.debug(message, ...optionalParams);
  }
} 