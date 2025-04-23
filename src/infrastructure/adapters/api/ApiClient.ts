import axios, { AxiosError } from 'axios';

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  async get(endpoint: string) {
    try {
      const response = await axios.get(`${this.baseURL}${endpoint}`);
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        const message = error.response?.data?.message || error.message;
        throw new Error(`API Error fetching data from ${endpoint}: ${message}`);
      } else if (error instanceof Error) {
        throw new Error(`Error fetching data from ${endpoint}: ${error.message}`);
      } else {
        throw new Error(`An unknown error occurred while fetching data from ${endpoint}`);
      }
    }
  }

  async post(endpoint: string, data: any) {
    try {
      const response = await axios.post(`${this.baseURL}${endpoint}`, data);
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        const message = error.response?.data?.message || error.message;
        throw new Error(`API Error posting data to ${endpoint}: ${message}`);
      } else if (error instanceof Error) {
        throw new Error(`Error posting data to ${endpoint}: ${error.message}`);
      } else {
        throw new Error(`An unknown error occurred while posting data to ${endpoint}`);
      }
    }
  }
}

export default ApiClient;