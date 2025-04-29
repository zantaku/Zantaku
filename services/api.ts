import axios from 'axios';

// Create an axios instance with default config
const api = axios.create({
  timeout: 30000, // 30 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Export the axios instance
export default api;

// Re-export axios
export { axios }; 