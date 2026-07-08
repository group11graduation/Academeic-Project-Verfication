# Building Management System (BMS)

A comprehensive Building Management System API built with Node.js, Express, and MongoDB.

## Features

- User authentication with JWT
- Role-based access control (Super Admin, Manager, Sub Manager, Super Manager)
- Building, Floor, Room, and Person management
- Maintenance request tracking
- Approval workflow system
- Reports generation

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: Helmet, CORS, Rate Limiting

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- npm or yarn

## Installation

1. Clone the repository
```bash
git clone <repository-url>
cd BMS
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env` file in the root directory
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:
```env
MONGO_URI=mongodb://localhost:27017/bms
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
PORT=5000
NODE_ENV=development
CORS_ORIGIN=*
```

5. Start the development server
```bash
npm run dev
```

The server will start on `http://localhost:5000` (or the port specified in `.env`).

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login

### Admin Routes
- `POST /api/admin/create-manager` - Create a new manager (Super Admin only)
- `POST /api/admin/create-building` - Create a new building (Super Admin only)

### Manager Routes
- Various endpoints for managing buildings, floors, rooms, and people

### Maintenance Routes
- `POST /api/maintenance` - Create maintenance request
- `GET /api/maintenance` - Get all maintenance requests
- `GET /api/maintenance/:requestId` - Get single maintenance request
- `PATCH /api/maintenance/:requestId` - Update maintenance request

### Reports Routes
- `GET /api/reports/manager` - Get manager dashboard report

### Sub Manager Routes
- Various endpoints for creating and requesting updates to floors, rooms, and people

## Project Structure

```
BMS/
├── src/
│   ├── config/          # Database and environment configuration
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Custom middleware (auth, error handling, validation)
│   ├── models/          # Mongoose models
│   ├── routes/          # Express routes
│   └── utils/           # Utility functions
├── server.js            # Application entry point
├── package.json         # Dependencies and scripts
└── .env.example         # Environment variables template
```

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting on API endpoints
- Helmet.js for security headers
- CORS configuration
- Input validation
- Global error handling

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGO_URI` | MongoDB connection string | Yes |
| `JWT_SECRET` | Secret key for JWT tokens | Yes |
| `PORT` | Server port | No (default: 5000) |
| `NODE_ENV` | Environment (development/production) | No |
| `CORS_ORIGIN` | Allowed CORS origins | No |

## Scripts

- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests (to be implemented)

## Health Check

The API includes a health check endpoint:
```
GET /health
```

Returns:
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Error Handling

The API uses a centralized error handling middleware that:
- Handles validation errors
- Handles database errors (duplicate keys, invalid IDs)
- Handles JWT errors
- Provides consistent error response format

## Rate Limiting

- General API: 100 requests per 15 minutes per IP
- Login endpoint: 5 requests per 15 minutes per IP

## License

ISC

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request
