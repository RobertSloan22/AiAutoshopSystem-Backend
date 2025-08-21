import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set correctly' : 'Not loaded');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('MONGO_DB_URI:', process.env.MONGO_DB_URI ? 'Set correctly' : 'Not loaded');