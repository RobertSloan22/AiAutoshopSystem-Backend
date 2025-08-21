import axios from 'axios';
var axiosInstance = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000/api',
    timeout: 60000,
    headers: {
        'Content-Type': 'application/json'
    }
});
// Add request interceptor for authentication
axiosInstance.interceptors.request.use(function (config) {
    var token = localStorage.getItem('authToken');
    if (token) {
        config.headers.Authorization = "Bearer ".concat(token);
    }
    return config;
}, function (error) {
    return Promise.reject(error);
});
// Add response interceptor for error handling
axiosInstance.interceptors.response.use(function (response) { return response; }, function (error) {
    var _a;
    if (((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) === 401) {
        // Handle unauthorized access
        localStorage.removeItem('authToken');
        window.location.href = '/login';
    }
    return Promise.reject(error);
});
export default axiosInstance;
