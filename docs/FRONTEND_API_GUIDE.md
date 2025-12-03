# Frontend API Guide - Querying Diagnostic Sessions

## 🚗 Finding Sessions for a Vehicle

Your frontend agent has **multiple ways** to query diagnostic sessions for a specific vehicle.

---

## Method 1: Using the Dedicated Vehicle Endpoint (Recommended)

**Endpoint:** `GET /api/obd2/vehicles/:vehicleId/sessions`

This is the **most intuitive** way to get sessions for a vehicle.

### Basic Usage

```javascript
// Get all sessions for a vehicle
const response = await fetch(
  `${API_BASE_URL}/api/obd2/vehicles/${vehicleId}/sessions`
);
const data = await response.json();

console.log(data.sessions); // Array of sessions
console.log(data.total);    // Total count
```

### Response Format

```json
{
  "vehicleId": "VEH123456",
  "sessions": [
    {
      "id": "session_id_here",
      "_id": "mongodb_id_here",
      "vehicleId": "VEH123456",
      "sessionName": "Check Engine Light Diagnostic",
      "startTime": "2024-01-15T10:30:00Z",
      "endTime": "2024-01-15T10:45:00Z",
      "duration": 900,
      "status": "completed",
      "dataPointCount": 1250,
      "vehicleInfo": {
        "make": "Toyota",
        "model": "Camry",
        "year": 2018,
        "vin": "1HGBH41JXMN109186",
        "engine": "2.5L 4-cyl",
        "mileage": 75000
      },
      "dtcCodes": ["P0171", "P0420"],
      "affectedSystems": "Fuel and Emissions",
      "focusAreas": ["fuel_trim", "o2_sensors"],
      "sessionNotes": "Customer reports rough idle",
      "tags": ["check_engine_light", "fuel_system"],
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:45:00Z"
    }
  ],
  "total": 15,
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 15
  }
}
```

### With Filters

```javascript
// Get only completed sessions from the last 30 days
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const response = await fetch(
  `${API_BASE_URL}/api/obd2/vehicles/${vehicleId}/sessions?` +
  new URLSearchParams({
    status: 'completed',
    startDate: thirtyDaysAgo.toISOString(),
    limit: 20,
    offset: 0,
    sortBy: 'startTime',
    sortOrder: 'desc'
  })
);
```

### With Summary Statistics

```javascript
// Get sessions WITH vehicle summary
const response = await fetch(
  `${API_BASE_URL}/api/obd2/vehicles/${vehicleId}/sessions?includeSummary=true`
);
const data = await response.json();

console.log(data.summary);
// {
//   totalSessions: 15,
//   completedSessions: 12,
//   activeSessions: 1,
//   totalDataPoints: 18750,
//   totalDuration: 13500,  // seconds
//   latestSession: "2024-01-15T10:30:00Z",
//   commonDTCs: [
//     { code: "P0171", count: 8 },
//     { code: "P0420", count: 5 }
//   ],
//   vehicleInfo: { make: "Toyota", model: "Camry", year: 2018 }
// }
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | - | Filter by status: `active`, `completed`, `paused`, `error`, `cancelled` |
| `startDate` | ISO date | - | Filter sessions after this date |
| `endDate` | ISO date | - | Filter sessions before this date |
| `limit` | number | 50 | Max sessions to return |
| `offset` | number | 0 | Pagination offset |
| `sortBy` | string | `startTime` | Sort field: `startTime`, `duration`, `dataPointCount` |
| `sortOrder` | string | `desc` | Sort direction: `asc` or `desc` |
| `includeSummary` | boolean | `false` | Include summary statistics |

---

## Method 2: Using the General Sessions Endpoint

**Endpoint:** `GET /api/obd2/sessions`

This endpoint supports filtering by `vehicleId` along with many other filters.

### Basic Usage

```javascript
// Get sessions for a vehicle using query parameter
const response = await fetch(
  `${API_BASE_URL}/api/obd2/sessions?vehicleId=${vehicleId}`
);
const data = await response.json();
```

### Advanced Multi-Filter Query

```javascript
// Complex query: Sessions for specific vehicle AND user, with status and tags
const params = new URLSearchParams({
  vehicleId: 'VEH123456',
  userId: 'USER789',
  status: 'completed',
  tags: 'check_engine_light,fuel_system',  // comma-separated
  startDate: '2024-01-01T00:00:00Z',
  endDate: '2024-12-31T23:59:59Z',
  limit: 100,
  offset: 0,
  sortBy: 'startTime',
  sortOrder: 'desc'
});

const response = await fetch(
  `${API_BASE_URL}/api/obd2/sessions?${params}`
);
const data = await response.json();
```

### Response Format

```json
{
  "sessions": [...],
  "total": 15,
  "filters": {
    "userId": "USER789",
    "vehicleId": "VEH123456",
    "status": "completed",
    "tags": "check_engine_light,fuel_system",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-12-31T23:59:59Z"
  },
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 15
  }
}
```

### All Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `vehicleId` | string | - | Filter by vehicle ID |
| `userId` | string | - | Filter by user ID |
| `status` | string | - | Filter by status |
| `sessionType` | string | - | Filter by session type |
| `startDate` | ISO date | - | Sessions after this date |
| `endDate` | ISO date | - | Sessions before this date |
| `tags` | string | - | Comma-separated tags (OR logic) |
| `limit` | number | 50 | Max results |
| `offset` | number | 0 | Pagination offset |
| `sortBy` | string | `startTime` | Sort field |
| `sortOrder` | string | `desc` | Sort direction |

---

## Method 3: Get Active Sessions Only

**Endpoint:** `GET /api/obd2/sessions/active`

Quickly find active sessions (useful for real-time monitoring).

```javascript
// Get active sessions for a specific user
const response = await fetch(
  `${API_BASE_URL}/api/obd2/sessions/active?userId=${userId}`
);

// Or get ALL active sessions
const response = await fetch(
  `${API_BASE_URL}/api/obd2/sessions/active`
);

const data = await response.json();
console.log(data.activeSessions);
console.log(data.count);
```

---

## 🎯 Real-World Frontend Agent Examples

### Example 1: Vehicle History Dashboard

```javascript
class VehicleHistoryAgent {
  async getVehicleHistory(vehicleId) {
    // Get all sessions with summary
    const response = await fetch(
      `${API_BASE_URL}/api/obd2/vehicles/${vehicleId}/sessions?` +
      new URLSearchParams({
        includeSummary: 'true',
        limit: 100
      })
    );

    const data = await response.json();

    return {
      vehicle: data.summary.vehicleInfo,
      totalSessions: data.summary.totalSessions,
      sessions: data.sessions,
      commonIssues: data.summary.commonDTCs,
      totalMileage: this.calculateMileageCovered(data.sessions)
    };
  }
}
```

### Example 2: Recent Issues Tracker

```javascript
class IssuesTrackerAgent {
  async getRecentIssues(vehicleId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const response = await fetch(
      `${API_BASE_URL}/api/obd2/vehicles/${vehicleId}/sessions?` +
      new URLSearchParams({
        startDate: startDate.toISOString(),
        status: 'completed',
        sortBy: 'startTime',
        sortOrder: 'desc'
      })
    );

    const data = await response.json();

    // Extract all DTCs from recent sessions
    const allDTCs = new Map();
    data.sessions.forEach(session => {
      (session.dtcCodes || []).forEach(code => {
        if (!allDTCs.has(code)) {
          allDTCs.set(code, {
            code,
            sessions: [],
            firstSeen: session.startTime,
            lastSeen: session.startTime
          });
        }
        const dtcInfo = allDTCs.get(code);
        dtcInfo.sessions.push(session.id);
        dtcInfo.lastSeen = session.startTime;
      });
    });

    return {
      recentSessions: data.sessions,
      dtcs: Array.from(allDTCs.values()),
      totalIssues: allDTCs.size
    };
  }
}
```

### Example 3: Compare Sessions

```javascript
class SessionComparisonAgent {
  async compareVehicleSessions(vehicleId, sessionId1, sessionId2) {
    // Get both sessions
    const [session1, session2] = await Promise.all([
      fetch(`${API_BASE_URL}/api/obd2/sessions/${sessionId1}`).then(r => r.json()),
      fetch(`${API_BASE_URL}/api/obd2/sessions/${sessionId2}`).then(r => r.json())
    ]);

    // Use compare endpoint
    const compareResponse = await fetch(
      `${API_BASE_URL}/api/obd2/sessions/compare`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionIds: [sessionId1, sessionId2],
          metrics: ['fuel_economy', 'performance', 'emissions']
        })
      }
    );

    return await compareResponse.json();
  }
}
```

### Example 4: Pagination Handler

```javascript
class SessionPaginationAgent {
  async getAllVehicleSessions(vehicleId, pageSize = 50) {
    const allSessions = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `${API_BASE_URL}/api/obd2/vehicles/${vehicleId}/sessions?` +
        new URLSearchParams({
          limit: pageSize,
          offset: offset
        })
      );

      const data = await response.json();
      allSessions.push(...data.sessions);

      offset += pageSize;
      hasMore = data.sessions.length === pageSize;
    }

    return allSessions;
  }
}
```

---

## 🔍 Best Practices for Frontend Agents

### 1. **Use the Dedicated Vehicle Endpoint**
```javascript
// ✅ GOOD - Cleaner, more semantic
GET /api/obd2/vehicles/VEH123/sessions

// ❌ LESS IDEAL - Works but less intuitive
GET /api/obd2/sessions?vehicleId=VEH123
```

### 2. **Always Handle Pagination**
```javascript
// Don't assume all sessions fit in one response
const limit = 50;
let offset = 0;
let sessions = [];

while (true) {
  const data = await fetchSessions(vehicleId, limit, offset);
  sessions.push(...data.sessions);

  if (data.sessions.length < limit) break;
  offset += limit;
}
```

### 3. **Use includeSummary for Dashboard Views**
```javascript
// One request gets both sessions AND summary stats
const { sessions, summary } = await fetch(
  `/api/obd2/vehicles/${vehicleId}/sessions?includeSummary=true`
).then(r => r.json());
```

### 4. **Cache Vehicle Session Lists**
```javascript
class VehicleSessionCache {
  constructor() {
    this.cache = new Map();
    this.TTL = 5 * 60 * 1000; // 5 minutes
  }

  async getSessions(vehicleId, forceRefresh = false) {
    const cached = this.cache.get(vehicleId);

    if (!forceRefresh && cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.data;
    }

    const data = await fetch(
      `/api/obd2/vehicles/${vehicleId}/sessions?includeSummary=true`
    ).then(r => r.json());

    this.cache.set(vehicleId, {
      data,
      timestamp: Date.now()
    });

    return data;
  }
}
```

### 5. **Filter by Status for Performance**
```javascript
// Only get completed sessions (faster queries)
GET /api/obd2/vehicles/VEH123/sessions?status=completed

// Only get active sessions (monitoring)
GET /api/obd2/vehicles/VEH123/sessions?status=active
```

---

## 📊 Response Field Reference

Each session object includes:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Frontend-friendly ID |
| `_id` | string | MongoDB ObjectId |
| `vehicleId` | string | Vehicle identifier |
| `userId` | string | User who created session |
| `sessionName` | string | Human-readable name |
| `startTime` | ISO date | Session start |
| `endTime` | ISO date | Session end |
| `duration` | number | Duration in seconds |
| `status` | string | `active`, `completed`, etc. |
| `dataPointCount` | number | Number of data points collected |
| `vehicleInfo` | object | Make, model, year, VIN, etc. |
| `dtcCodes` | string[] | Diagnostic trouble codes |
| `affectedSystems` | string | Systems with issues |
| `focusAreas` | string[] | Areas to focus analysis on |
| `sessionNotes` | string | Technician notes |
| `tags` | string[] | Tags for categorization |
| `autoAnalysis` | object | Auto-generated analysis results |
| `intervalAnalysis` | object | Real-time interval analysis |
| `createdAt` | ISO date | Record creation time |
| `updatedAt` | ISO date | Last update time |

---

## 🚀 Quick Reference

```javascript
// Get all sessions for a vehicle
GET /api/obd2/vehicles/:vehicleId/sessions

// Get sessions with filters
GET /api/obd2/vehicles/:vehicleId/sessions?status=completed&limit=10

// Get sessions with summary
GET /api/obd2/vehicles/:vehicleId/sessions?includeSummary=true

// Multi-criteria search
GET /api/obd2/sessions?vehicleId=X&userId=Y&status=completed

// Get active sessions only
GET /api/obd2/sessions/active?userId=X

// Get specific session
GET /api/obd2/sessions/:sessionId

// Compare sessions
POST /api/obd2/sessions/compare
Body: { sessionIds: ["id1", "id2"], metrics: ["fuel_economy"] }
```

---

## Need Help?

Check the main API documentation at `/docs/API.md` or contact the backend team.
