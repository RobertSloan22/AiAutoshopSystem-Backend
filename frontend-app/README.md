# AI Autoshop System - Frontend

A comprehensive React-based frontend for the AI Autoshop System, providing an intuitive interface for vehicle diagnostics, real-time monitoring, AI-powered analysis, and web search capabilities.

## 🚀 Features

### Core Functionality
- **Real-time AI Diagnostic Chat**: Streaming conversations with OpenAI GPT models
- **OBD2 Vehicle Monitoring**: Live data streaming and historical analysis
- **Image Analysis**: AI-powered vehicle image analysis with drag-and-drop upload
- **Web Search Integration**: Automotive-specific web and image search
- **Chart Gallery**: Manage and view generated visualizations
- **Vehicle Management**: Full CRUD operations for vehicle database
- **System Dashboard**: Comprehensive system status monitoring

### Technical Features
- **Server-Sent Events (SSE)**: Real-time streaming chat responses
- **WebSocket Integration**: Live OBD2 data streaming
- **Dual Image Serving**: Base64 embedded + API URL serving
- **React Query**: Efficient data fetching and caching
- **Responsive Design**: Mobile-first with Tailwind CSS
- **Dark/Light Themes**: User-configurable appearance
- **Progressive Web App**: Installable and offline-capable

## 🛠️ Technology Stack

- **Frontend Framework**: React 18 with Vite
- **Styling**: Tailwind CSS with custom automotive theme
- **State Management**: React Query + Context API
- **Icons**: Lucide React
- **Charts**: Recharts for data visualization
- **Animations**: Framer Motion
- **File Upload**: React Dropzone
- **HTTP Client**: Axios

## 📦 Installation

### Prerequisites
- Node.js 18+ and npm/yarn
- AI Autoshop System Backend running

### Setup Steps

1. **Install Dependencies**
   ```bash
   cd frontend-app
   npm install
   ```

2. **Environment Configuration**
   Create `.env` file:
   ```env
   VITE_API_BASE_URL=http://localhost:3001
   VITE_WS_BASE_URL=ws://localhost:3001
   ```

3. **Development Server**
   ```bash
   npm run dev
   ```

4. **Production Build**
   ```bash
   npm run build
   npm run preview
   ```

## 🏗️ Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── common/          # Generic components (buttons, cards, etc.)
│   ├── Charts/          # Chart-related components
│   └── Layout/          # Layout and navigation components
├── context/             # React Context providers
├── pages/               # Main application pages
├── services/            # API clients and utilities
├── styles/              # Global styles and Tailwind config
└── utils/               # Helper functions and constants
```

## 📱 Application Pages

### Dashboard
- System status overview
- Quick actions and navigation
- Real-time metrics display
- Service health indicators

### AI Diagnostic Chat
- Streaming chat interface with AI
- Vehicle context integration
- Tool execution visualization
- Chat history management
- Export conversations

### OBD2 Monitor
- Real-time vehicle data display
- Historical data charts
- DTC code reading/clearing
- Adapter connection management
- Live metrics with customizable views

### Image Analysis
- Drag-and-drop image upload
- AI-powered analysis with context
- Search previous analyses
- Export analysis results
- Support for multiple image formats

### Web Search
- Automotive-focused web search
- Technical image search
- Vehicle context integration
- Search result filtering
- Quick search suggestions

### Chart Gallery
- View all generated charts
- Grid and list view modes
- Bulk operations (download/delete)
- Advanced filtering options
- Chart metadata management

### Vehicle Management
- Add/edit/delete vehicles
- Vehicle selection and context
- Search and filter capabilities
- Detailed vehicle information
- Integration with all services

### Settings
- Appearance customization
- Notification preferences
- Data retention settings
- System status monitoring
- Settings import/export

## 🔧 Configuration

### Environment Variables
```env
# API Configuration
VITE_API_BASE_URL=http://localhost:3001
VITE_WS_BASE_URL=ws://localhost:3001

# Feature Flags
VITE_ENABLE_DEBUG=false
VITE_ENABLE_ANALYTICS=false

# Timeouts (milliseconds)
VITE_API_TIMEOUT=30000
VITE_UPLOAD_TIMEOUT=60000
```

### Tailwind Theme
The application uses a custom automotive theme with primary colors and component styles defined in `tailwind.config.js`.

### Dark Mode Support
Full dark mode implementation with system preference detection and user override capability.

## 🌐 API Integration

### Supported Endpoints

#### AI Responses
- `POST /api/responses/stream` - Streaming chat
- `GET /api/responses/history` - Chat history
- `GET /api/responses/status` - Service status

#### OBD2 Monitoring
- `GET /api/obd2/status` - Connection status
- `POST /api/obd2/connect` - Connect adapter
- `WS /api/obd2/stream` - Live data stream

#### Image Analysis
- `POST /api/image-analysis/analyze` - Analyze images
- `GET /api/image-analysis/search` - Search analyses
- `GET /api/images/charts` - Chart gallery

#### Web Search
- `POST /api/websearch/search` - Web search
- `POST /api/websearch/images` - Image search
- `GET /api/websearch/status` - Search status

#### Vehicle Management
- `GET /api/vehicles` - List vehicles
- `POST /api/vehicles` - Create vehicle
- `PUT /api/vehicles/:id` - Update vehicle
- `DELETE /api/vehicles/:id` - Delete vehicle

#### System
- `GET /api/system/status` - System status
- `GET /api/system/services` - Services status
- `DELETE /api/system/cache` - Clear cache

## 🎨 Styling Guide

### Color Palette
- **Primary**: Automotive Blue (#1e40af)
- **Secondary**: Gray scale for contrast
- **Success**: Green (#10b981)
- **Warning**: Amber (#f59e0b)
- **Error**: Red (#ef4444)

### Component Classes
- `.btn` - Base button styles
- `.card` - Container components
- `.input` - Form inputs
- `.badge` - Status indicators

### Responsive Breakpoints
- `sm`: 640px+
- `md`: 768px+
- `lg`: 1024px+
- `xl`: 1280px+

## 🔄 State Management

### App Context
Global application state including:
- Current vehicle selection
- System status
- User preferences
- Notification system

### React Query
- API data caching and synchronization
- Background refetching
- Error handling
- Loading states

## 📊 Performance Features

### Optimization Techniques
- **Code Splitting**: Lazy-loaded routes
- **Image Optimization**: Lazy loading with error handling
- **Data Virtualization**: Large lists with pagination
- **Caching**: React Query with intelligent invalidation
- **Bundle Splitting**: Separate vendor and app bundles

### Monitoring
- Error boundaries for graceful failure handling
- Performance metrics collection
- API response time tracking

## 🧪 Development

### Available Scripts
```bash
npm run dev          # Development server
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # ESLint checking
npm run test         # Run tests
npm run type-check   # TypeScript checking
```

### Code Standards
- ESLint + Prettier for code formatting
- Conventional commits for version control
- Component-first architecture
- Hook-based state management

## 🚀 Deployment

### Production Build
```bash
npm run build
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"]
```

### Environment Setup
- Ensure backend API is accessible
- Configure CORS settings
- Set up SSL certificates for production
- Configure environment variables

## 🤝 Integration Guide

### Backend Integration
1. Ensure all API endpoints are available
2. Configure WebSocket support
3. Set up file upload handling
4. Enable CORS for frontend domain

### Service Dependencies
- **OpenAI API**: For AI responses
- **Serper API**: For web search
- **Python Environment**: For chart generation
- **MongoDB**: For data persistence

## 🐛 Troubleshooting

### Common Issues

#### Connection Issues
```bash
# Check backend status
curl http://localhost:3001/api/system/status

# Verify WebSocket connection
# Check browser developer tools > Network tab
```

#### Build Issues
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check Node.js version
node --version  # Should be 18+
```

#### Styling Issues
```bash
# Rebuild Tailwind CSS
npm run build:css

# Check for conflicting styles
# Use browser developer tools
```

## 📄 License

This project is part of the AI Autoshop System and follows the same licensing terms.

## 🤖 Generated with Claude Code

This frontend was generated using Claude Code AI assistant, providing comprehensive integration with all backend services and a modern, responsive user interface for automotive diagnostics and analysis.