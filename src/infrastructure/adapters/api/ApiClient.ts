class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  async get(endpoint: string) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`);
      if (!response.ok) {
        let message = response.statusText;
        try {
          const errData = await response.json();
          message = errData.message || message;
        } catch (e) {
          // ignore parsing error
        }
        throw new Error(`API Error fetching data from ${endpoint}: ${message}`);
      }
      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error fetching data from ${endpoint}: ${error.message}`);
      }
      throw new Error(`An unknown error occurred while fetching data from ${endpoint}`);
    }
  }

  async post(endpoint: string, data: any) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        let message = response.statusText;
        try {
          const errData = await response.json();
          message = errData.message || message;
        } catch (e) {
          // ignore parsing error
        }
        throw new Error(`API Error posting data to ${endpoint}: ${message}`);
      }
      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error posting data to ${endpoint}: ${error.message}`);
      }
      throw new Error(`An unknown error occurred while posting data to ${endpoint}`);
    }
  }
}

export default ApiClient;