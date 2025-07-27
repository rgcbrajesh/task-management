# Task Management System

A comprehensive web application for individual users and groups to manage tasks efficiently with automated WhatsApp notifications.

## Features

- **User Authentication**: Secure JWT-based authentication for Individual Users and Group Admins
- **Group Management**: Admins can create groups, add/remove members, and manage permissions
- **Task Management**: Create, assign, update, and track tasks with priority levels
- **Real-time Notifications**: Hourly WhatsApp reminders for incomplete tasks
- **Dashboard**: Responsive dashboard with filtering, sorting, and analytics
- **Task Analytics**: Performance tracking and CSV export for admins

## Tech Stack

### Frontend
- React 18
- Tailwind CSS
- React Router
- Axios
- Formik
- Chart.js

### Backend
- Node.js
- Express.js
- MySQL
- JWT Authentication
- WhatsApp Business API / Twilio
- Bcrypt

### Deployment
- Backend: Heroku/AWS
- Frontend: Vercel/GitHub Pages
- Database: MySQL Cloud Instance

## Project Structure

```
task-management-system/
├── backend/                 # Node.js Express API
│   ├── src/
│   │   ├── controllers/     # Route controllers
│   │   ├── models/         # Database models
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Custom middleware
│   │   ├── services/       # Business logic
│   │   ├── utils/          # Utility functions
│   │   └── config/         # Configuration files
│   ├── tests/              # Backend tests
│   └── package.json
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom hooks
│   │   ├── services/       # API services
│   │   ├── utils/          # Utility functions
│   │   └── styles/         # CSS files
│   ├── public/
│   └── package.json
├── database/               # Database scripts
│   ├── migrations/
│   └── seeds/
└── docs/                   # Documentation
```

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MySQL (v8 or higher)
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd task-management-system
```

2. Install backend dependencies
```bash
cd backend
npm install
```

3. Install frontend dependencies
```bash
cd ../frontend
npm install
```

4. Set up environment variables
```bash
# Backend .env
cp backend/.env.example backend/.env
# Configure your database and API keys
```

5. Set up the database
```bash
cd backend
npm run migrate
npm run seed
```

6. Start the development servers
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm start
```

## API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### User Management
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile

### Group Management
- `POST /api/groups` - Create group (Admin only)
- `GET /api/groups` - Get user's groups
- `POST /api/groups/:id/members` - Add member to group
- `DELETE /api/groups/:id/members/:userId` - Remove member

### Task Management
- `GET /api/tasks` - Get user's tasks
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `PUT /api/tasks/:id/status` - Update task status

### Notifications
- `GET /api/notifications/settings` - Get notification preferences
- `PUT /api/notifications/settings` - Update notification preferences

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License