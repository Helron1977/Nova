// @ts-expect-error: TSC build struggles with unused import detection sometimes
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigurationApiAdapter } from '../ConfigurationApiAdapter';
// @ts-expect-error: TSC build struggles with unused import detection sometimes
import { Configuration, ConfigurationContent } from '../../../../domain'; // Ajuster chemin si besoin
import { ILogger } from '../../../../application/ports/logging';

// Mocker le Logger
const mockLogger: ILogger = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// URL de base utilisée dans le module
const API_BASE_URL = 'http://localhost:3000/api';

// Mocker la fonction fetch globale
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Données de configuration exemple pour les tests
const testConfig1: Configuration = {
    _id: 'id1', name: 'Config 1', content: JSON.stringify({ markdown: 'md1', mermaid: 'mmd1' })
};
const testConfig2: Configuration = {
    _id: 'id2', name: 'Config 2', content: JSON.stringify({ markdown: 'md2', mermaid: 'mmd2' }),
    api: { url: 'http://example.com', key: 'key123' }, preprompt: 'pre1'
};


describe('ConfigurationApiAdapter', () => {
  let adapter: ConfigurationApiAdapter;

  beforeEach(() => {
    adapter = new ConfigurationApiAdapter(mockLogger);
    vi.clearAllMocks(); // Réinitialiser fetch et logger
    mockFetch.mockReset(); // Assurer que fetch est réinitialisé entre les tests
  });

  // Helper pour simuler une réponse fetch réussie
  const mockFetchSuccess = (data: any, status = 200) => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status,
      json: async () => data,
      statusText: 'OK'
    });
  };

  // Helper pour simuler une réponse fetch échouée
  const mockFetchFailure = (errorData: any, status = 400) => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status,
      json: async () => errorData,
      statusText: 'Bad Request'
    });
  };

  // --- Tests pour getAllNames ---
  it('getAllNames should fetch configs and return names on success', async () => {
    mockFetchSuccess([testConfig1, testConfig2]);
    const names = await adapter.getAllNames();
    expect(names).toEqual(['Config 1', 'Config 2']);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE_URL}/configs`);
  });

  it('getAllNames should return empty array on fetch failure', async () => {
    mockFetchFailure({ message: 'Server Error' }, 500);
    const names = await adapter.getAllNames();
    expect(names).toEqual([]);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockLogger.error).toHaveBeenCalledWith('API Error 500: Server Error', { message: 'Server Error' });
  });

   it('getAllNames should return empty array on network error', async () => {
        const networkError = new Error('Network failed');
        mockFetch.mockRejectedValueOnce(networkError);
        const names = await adapter.getAllNames();
        expect(names).toEqual([]);
        expect(mockFetch).toHaveBeenCalledOnce();
        expect(mockLogger.error).toHaveBeenCalledWith('Network or fetch error in getAllNames', networkError);
    });

  // --- Tests pour findByName ---
  it('findByName should fetch all configs and return the matching one', async () => {
    mockFetchSuccess([testConfig1, testConfig2]);
    const result = await adapter.findByName('Config 2');
    expect(result).toEqual(testConfig2);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE_URL}/configs`);
  });

  it('findByName should return null if config name is not found', async () => {
    mockFetchSuccess([testConfig1]);
    const result = await adapter.findByName('Config NonExistent');
    expect(result).toBeNull();
    expect(mockFetch).toHaveBeenCalledOnce();
     expect(mockLogger.warn).toHaveBeenCalledWith('Configuration with name "Config NonExistent" not found via API.');
  });

  it('findByName should return null on fetch failure', async () => {
    mockFetchFailure({ message: 'Not Found' }, 404);
    const result = await adapter.findByName('Config 1');
    expect(result).toBeNull();
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockLogger.error).toHaveBeenCalledWith('API Error 404: Not Found', { message: 'Not Found' });
  });

  // --- Tests pour findById ---
  it('findById should fetch config by id and return it on success', async () => {
    mockFetchSuccess(testConfig1);
    const result = await adapter.findById('id1');
    expect(result).toEqual(testConfig1);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE_URL}/configs/id1`);
  });

  it('findById should return null on fetch failure', async () => {
    mockFetchFailure({ message: 'Not Found' }, 404);
    const result = await adapter.findById('id-nonexistent');
    expect(result).toBeNull();
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockLogger.error).toHaveBeenCalledWith('API Error 404: Not Found', { message: 'Not Found' });
  });

  // --- Tests pour save (Create POST) ---
  it('save should make a POST request for new config (no _id)', async () => {
    const newConfig = { name: 'New Config', content: JSON.stringify({ md: '', mmd: '' }) };
    mockFetchSuccess({ ...newConfig, _id: 'newId123' }, 201); // API renvoie l'objet créé avec ID

    await adapter.save(newConfig as Configuration);

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/configs`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify(newConfig) })
    );
     expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('created successfully'), expect.anything());
  });

  // --- Tests pour save (Update PUT) ---
  it('save should make a PUT request for existing config (with _id)', async () => {
    mockFetchSuccess(testConfig2); // API renvoie l'objet mis à jour

    await adapter.save(testConfig2);

    expect(mockFetch).toHaveBeenCalledOnce();
    // Vérifier que apiUrl et apiKey sont envoyés séparément pour PUT
    const expectedBody = {
        name: testConfig2.name,
        content: testConfig2.content,
        preprompt: testConfig2.preprompt,
        apiUrl: testConfig2.api?.url,
        apiKey: testConfig2.api?.key
    };
    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/configs/${testConfig2._id}`,
      expect.objectContaining({ method: 'PUT', body: JSON.stringify(expectedBody) })
    );
     expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('updated successfully'), expect.anything());
  });

  it('save should log error on fetch failure during save', async () => {
    mockFetchFailure({ message: 'Save Failed' }, 500);
    await adapter.save(testConfig1); // Tente de mettre à jour
    expect(mockFetch).toHaveBeenCalledOnce();
     // Vérifier le log spécifique de handleApiResponse
     expect(mockLogger.error).toHaveBeenCalledWith('API Error 500: Save Failed', { message: 'Save Failed' });
  });

  // --- Tests pour deleteById ---
  it('deleteById should make a DELETE request', async () => {
     mockFetch.mockResolvedValueOnce({ ok: true, status: 204, statusText: 'No Content' }); // Simule 204 No Content
    await adapter.deleteById('id1');
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/configs/id1`,
      expect.objectContaining({ method: 'DELETE' })
    );
     expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('deleted successfully'));
  });

  it('deleteById should log error on fetch failure', async () => {
    mockFetchFailure({ message: 'Delete Failed' }, 500);
    await adapter.deleteById('id1');
    expect(mockFetch).toHaveBeenCalledOnce();
    // Vérifier le log spécifique de handleApiResponse
    expect(mockLogger.error).toHaveBeenCalledWith('API Error 500: Delete Failed', { message: 'Delete Failed' });
  });
}); 