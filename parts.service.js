import axios from 'axios';
import * as cheerio from 'cheerio';

class PartsRetriever {
    constructor(config = {}) {
        this.baseUrl = 'https://www.autozone.com';
        this.config = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Cookie': '', // AutoZone might require cookies for session handling
                ...config.headers
            },
            timeout: config.timeout || 10000,
            retries: config.retries || 3,
            retryDelay: config.retryDelay || 1000
        };
    }

    async searchParts(query, vehicle) {
        try {
            if (!query || !vehicle) {
                throw new Error('Query and vehicle information are required');
            }

            const searchUrl = `${this.baseUrl}/search`;
            const params = new URLSearchParams({
                q: query,
                year: vehicle.year || '',
                make: vehicle.make || '',
                model: vehicle.model || '',
                engine: vehicle.engine || ''
            });

            const response = await this._makeRequest(`${searchUrl}?${params}`);
            if (!response?.data) {
                throw new Error('No data received from AutoZone');
            }

            const results = this._parseSearchResults(response.data);
            if (!results || results.length === 0) {
                console.warn('No parts found for query:', query);
                return [];
            }

            return results;
        } catch (error) {
            console.error('Error searching parts:', error);
            throw new Error(`Failed to search parts: ${error.message}`);
        }
    }

    async getPartDetails(partUrl) {
        try {
            if (!partUrl) {
                throw new Error('Part URL is required');
            }

            const response = await this._makeRequest(partUrl);
            if (!response?.data) {
                throw new Error('No data received from AutoZone');
            }

            return this._parsePartDetails(response.data);
        } catch (error) {
            console.error('Error getting part details:', error);
            throw new Error(`Failed to get part details: ${error.message}`);
        }
    }

    async _makeRequest(url, retryCount = 0) {
        try {
            const response = await axios.get(url, {
                headers: this.config.headers,
                timeout: this.config.timeout,
                validateStatus: status => status === 200
            });

            // Store any cookies returned for subsequent requests
            const cookies = response.headers['set-cookie'];
            if (cookies) {
                this.config.headers.Cookie = cookies.join('; ');
            }

            return response;
        } catch (error) {
            if (retryCount < this.config.retries) {
                console.warn(`Request failed, retrying (${retryCount + 1}/${this.config.retries})...`);
                await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * (retryCount + 1)));
                return this._makeRequest(url, retryCount + 1);
            }
            throw error;
        }
    }

    _parseSearchResults(html) {
        try {
            const $ = cheerio.load(html);
            const results = [];

            // Updated selectors based on AutoZone's current HTML structure
            $('.product-tile').each((_, element) => {
                const $el = $(element);
                const result = {
                    name: $el.find('[data-testid="product-title"]').text().trim(),
                    price: $el.find('[data-testid="product-price"]').text().trim(),
                    partNumber: $el.find('[data-testid="product-number"]').text().trim(),
                    brand: $el.find('[data-testid="product-brand"]').text().trim(),
                    url: this.baseUrl + ($el.find('a[href]').attr('href') || ''),
                    availability: $el.find('[data-testid="availability-status"]').text().trim(),
                    fitment: $el.find('[data-testid="fitment-info"]').text().trim()
                };

                // Only add results with valid data
                if (result.name && result.url.includes(this.baseUrl)) {
                    results.push(result);
                }
            });

            return results;
        } catch (error) {
            console.error('Error parsing search results:', error);
            return [];
        }
    }

    _parsePartDetails(html) {
        try {
            const $ = cheerio.load(html);
            
            return {
                name: $('[data-testid="product-title"]').text().trim(),
                description: $('[data-testid="product-description"]').text().trim(),
                specifications: this._parseSpecifications($),
                pricing: {
                    regular: $('[data-testid="regular-price"]').text().trim(),
                    sale: $('[data-testid="sale-price"]').text().trim(),
                    savings: $('[data-testid="savings"]').text().trim()
                },
                availability: {
                    inStore: $('[data-testid="store-availability"]').text().trim(),
                    online: $('[data-testid="online-availability"]').text().trim(),
                    delivery: $('[data-testid="delivery-options"]').text().trim()
                },
                fitment: {
                    vehicles: $('[data-testid="vehicle-fitment"]').text().trim(),
                    notes: $('[data-testid="fitment-notes"]').text().trim()
                },
                warranty: $('[data-testid="warranty-info"]').text().trim(),
                reviews: {
                    rating: $('[data-testid="rating"]').text().trim(),
                    count: $('[data-testid="review-count"]').text().trim()
                }
            };
        } catch (error) {
            console.error('Error parsing part details:', error);
            return {
                name: '',
                description: '',
                specifications: {},
                pricing: { regular: '', sale: '', savings: '' },
                availability: { inStore: '', online: '', delivery: '' },
                fitment: { vehicles: '', notes: '' },
                warranty: '',
                reviews: { rating: '', count: '' }
            };
        }
    }

    _parseSpecifications($) {
        try {
            const specs = {};
            $('[data-testid="specifications-table"] tr').each((_, row) => {
                const $row = $(row);
                const key = $row.find('th').text().trim();
                const value = $row.find('td').text().trim();
                if (key && value) {
                    specs[key] = value;
                }
            });
            return specs;
        } catch (error) {
            console.error('Error parsing specifications:', error);
            return {};
        }
    }
}

export default PartsRetriever; 