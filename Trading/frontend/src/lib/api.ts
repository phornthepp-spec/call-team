import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status } = error.response;

      if (status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }

      if (status === 403) {
        console.error("Access forbidden");
      }

      if (status === 429) {
        console.error("Rate limited. Please wait before retrying.");
      }

      if (status >= 500) {
        console.error("Server error. Please try again later.");
      }
    } else if (error.request) {
      console.error("Network error. Please check your connection.");
    }

    return Promise.reject(error);
  }
);

export default api;
