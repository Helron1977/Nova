import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PinoLogger } from '../PinoLogger';
// @ts-expect-error: TSC build struggles with unused import detection sometimes
import { pino, type Logger } from 'pino';

// Mocker le module pino
const mockPinoInstance = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    // Mocker d'autres méthodes de l'instance pino si nécessaire
    // On a besoin de mocker l'appel dans le constructeur aussi
    // Pour simplifier, on mock la fonction pino elle-même
};
vi.mock('pino', () => ({
    // Retourne la fonction pino qui elle-même retourne notre instance mockée
    pino: vi.fn(() => mockPinoInstance),
    // Exporter les types nécessaires (peut être nécessaire pour que le mock soit valide)
    Level: {}, 
    Logger: {},
    LevelWithSilent: {}
}));

describe('PinoLogger', () => {
  let loggerInstance: PinoLogger;

  beforeEach(() => {
    // Réinitialiser les mocks avant chaque test
    vi.clearAllMocks();
    // Créer une nouvelle instance (cela appellera le mock de pino)
    loggerInstance = new PinoLogger();
    // Le log initial dans le constructeur a déjà été appelé ici
    // On peut vérifier s'il a été appelé correctement, puis le réinitialiser
    expect(mockPinoInstance.info).toHaveBeenCalledWith(expect.stringContaining('Logger initialized with level:'));
    // Effacer les appels effectués dans le constructeur pour les tests suivants
    vi.clearAllMocks(); 
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call pinoInstance.info for log method', () => {
    const message = 'Info message';
    const params = [{ a: 1 }, 'param2'];
    loggerInstance.log(message, ...params);
    expect(mockPinoInstance.info).toHaveBeenCalledOnce();
    expect(mockPinoInstance.info).toHaveBeenCalledWith(message, ...params);
  });

  it('should call pinoInstance.warn for warn method', () => {
    const message = 'Warning message';
    const params = [123];
    loggerInstance.warn(message, ...params);
    expect(mockPinoInstance.warn).toHaveBeenCalledOnce();
    expect(mockPinoInstance.warn).toHaveBeenCalledWith(message, ...params);
  });

  it('should call pinoInstance.error for error method without Error object', () => {
    const message = 'Error message';
    const params = [true];
    loggerInstance.error(message, undefined, ...params);
    expect(mockPinoInstance.error).toHaveBeenCalledOnce();
    expect(mockPinoInstance.error).toHaveBeenCalledWith(message, ...params);
  });

  it('should call pinoInstance.error for error method with Error object', () => {
    const message = 'Error message with object';
    const error = new Error('Sample error');
    const params = [{ detail: 'abc' }];
    const context = { err: error };
    loggerInstance.error(message, error, ...params);
    expect(mockPinoInstance.error).toHaveBeenCalledOnce();
    expect(mockPinoInstance.error).toHaveBeenCalledWith(context, message, ...params);
  });

  it('should call pinoInstance.error for error method with unknown error context', () => {
    const message = 'Error message with unknown context';
    const errorContextValue = { code: 500 };
    const params = ['more info'];
    const context = { errorContext: errorContextValue };
    loggerInstance.error(message, errorContextValue, ...params);
    expect(mockPinoInstance.error).toHaveBeenCalledOnce();
    expect(mockPinoInstance.error).toHaveBeenCalledWith(context, message, ...params);
  });

  it('should call pinoInstance.debug for debug method', () => {
    const message = 'Debug message';
    const params = [null];
    loggerInstance.debug(message, ...params);
    expect(mockPinoInstance.debug).toHaveBeenCalledOnce();
    expect(mockPinoInstance.debug).toHaveBeenCalledWith(message, ...params);
  });
}); 