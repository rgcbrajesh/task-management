# Development Guide

This guide provides detailed information for developers working on the Task Management System.

## Project Structure

```
task-management-system/
├── backend/                    # Node.js Express API
│   ├── src/
│   │   ├── config/            # Database and app configuration
│   │   ├── controllers/       # Route controllers (to be implemented)
│   │   ├── middleware/        # Custom middleware
│   │   ├── models/           # Database models (to be implemented)
│   │   ├── routes/           # API routes
│   │   ├── services/         # Business logic services
│   │   └── utils/            # Utility functions (to be implemented)
│   ├── tests/                # Backend tests
│   ├── uploads/              # File uploads directory
│   ├── logs/                 # Application logs
│   ├── .env.example          # Environment variables template
│   ├── package.json          # Backend dependencies
│   └── server.js             # Main server file
├── frontend/                  # React application
│   ├── public/               # Static files
│   ├── src/
│   │   ├── components/       # Reusable React components
│   │   │   ├── auth/         # Authentication components
│   │   │   ├── layout/       # Layout components
│   │   │   └── ui/           # UI components
│   │   ├── contexts/         # React contexts
│   │   ├── hooks/            # Custom React hooks
│   │   ├── pages/            # Page components
│   │   ├── services/         # API services
│   │   ├── utils/            # Utility functions
│   │   ├── App.js            # Main App component
│   │   ├── index.js          # React entry point
│   │   └── index.css         # Global styles
│   ├── package.json          # Frontend dependencies
│   ├── tailwind.config.js    # Tailwind CSS configuration
│   └── postcss.config.js     # PostCSS configuration
├── docs/                     # Documentation
├── .gitignore               # Git ignore rules
├── README.md                # Project overview
├── DEVELOPMENT.md           # This file
└── setup.sh                # Setup script
```

## Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MySQL** - Database
- **JWT** - Authentication
- **Bcrypt** - Password hashing
- **Twilio** - WhatsApp notifications
- **Node-cron** - Task scheduling
- **Express-validator** - Input validation
- **Helmet** - Security middleware
- **CORS** - Cross-origin resource sharing

### Frontend
- **React 18** - UI library
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **Formik** - Form handling
- **Yup** - Schema validation
- **React Query** - Data fetching and caching
- **Axios** - HTTP client
- **React Hot Toast** - Notifications
- **Chart.js** - Data visualization
- **Lucide React** - Icons

## Development Setup

### Prerequisites
- Node.js 16 or higher
- MySQL 8 or higher
- npm or yarn

### Quick Start
1. Run the setup script:
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

2. Configure environment variables:
   ```bash
   # Backend
   cp backend/.env.example backend/.env
   # Edit backend/.env with your database credentials
   
   # Frontend
   # .env file is created automatically by setup script
   ```

3. Create MySQL database:
   ```sql
   CREATE DATABASE task_management;
   ```

4. Start development servers:
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
- `POST /api/auth/verify` - Token verification
- `POST /api/auth/refresh` - Token refresh
- `POST /api/auth/change-password` - Change password

### User Endpoints
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/dashboard` - Get dashboard data
- `GET /api/users/notification-settings` - Get notification settings
- `PUT /api/users/notification-settings` - Update notification settings
- `GET /api/users/search` - Search users

### Task Endpoints
- `GET /api/tasks` - Get tasks with filtering
- `POST /api/tasks` - Create new task
- `GET /api/tasks/:id` - Get task by ID
- `PUT /api/tasks/:id` - Update task
- `PUT /api/tasks/:id/status` - Update task status
- `DELETE /api/tasks/:id` - Delete task

### Group Endpoints
- `GET /api/groups` - Get user's groups
- `POST /api/groups` - Create new group (Admin only)
- `GET /api/groups/:id` - Get group details
- `PUT /api/groups/:id` - Update group (Admin only)
- `DELETE /api/groups/:id` - Delete group (Admin only)
- `POST /api/groups/:id/members` - Add group member (Admin only)
- `DELETE /api/groups/:groupId/members/:userId` - Remove member (Admin only)

### Notification Endpoints
- `GET /api/notifications/logs` - Get notification logs
- `GET /api/notifications/stats` - Get notification statistics
- `POST /api/notifications/test` - Send test notification
- `POST /api/notifications/:id/retry` - Retry failed notification

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20),
  user_type ENUM('individual', 'group_admin') NOT NULL DEFAULT 'individual',
  is_active BOOLEAN DEFAULT true,
  notification_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Groups Table
```sql
CREATE TABLE groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  admin_id INT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Tasks Table
```sql
CREATE TABLE tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
  status ENUM('pending', 'in_progress', 'completed', 'overdue') DEFAULT 'pending',
  created_by INT NOT NULL,
  assigned_to INT NOT NULL,
  group_id INT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
);
```

## Frontend Architecture

### Component Structure
- **Pages** - Top-level route components
- **Layout** - Header, sidebar, and main layout
- **UI Components** - Reusable UI elements
- **Auth Components** - Authentication-related components

### State Management
- **React Context** - Global state (Auth, Theme)
- **React Query** - Server state management
- **Local State** - Component-specific state

### Styling
- **Tailwind CSS** - Utility-first CSS framework
- **Custom Components** - Pre-built component classes
- **Responsive Design** - Mobile-first approach

## Development Workflow

### Code Style
- Use ESLint for JavaScript linting
- Use Prettier for code formatting
- Follow React best practices
- Use meaningful variable and function names

### Git Workflow
1. Create feature branch from main
2. Make changes and commit with descriptive messages
3. Push branch and create pull request
4. Code review and merge

### Testing
- Backend: Jest for unit tests
- Frontend: React Testing Library
- API: Supertest for integration tests

## Environment Variables

### Backend (.env)
```env
# Server
PORT=5000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=task_management
DB_USER=root
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=7d

# Twilio (WhatsApp)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_APP_NAME=Task Management System
REACT_APP_VERSION=1.0.0
```

## Deployment

### Backend Deployment
1. Set up production database
2. Configure environment variables
3. Deploy to cloud service (Heroku, AWS, etc.)
4. Set up SSL certificate

### Frontend Deployment
1. Build production bundle: `npm run build`
2. Deploy to static hosting (Vercel, Netlify, GitHub Pages)
3. Configure environment variables

## Security Considerations

- JWT tokens for authentication
- Password hashing with bcrypt
- Input validation and sanitization
- CORS configuration
- Rate limiting
- Helmet for security headers
- HTTPS in production

## Performance Optimization

- Database indexing
- API response caching
- Image optimization
- Code splitting
- Lazy loading
- Bundle optimization

## Troubleshooting

### Common Issues
1. **Database connection errors** - Check MySQL service and credentials
2. **CORS errors** - Verify frontend URL in backend CORS config
3. **JWT errors** - Check token expiration and secret key
4. **WhatsApp notifications not working** - Verify Twilio credentials

### Debug Mode
- Set `NODE_ENV=development` for detailed error messages
- Use browser dev tools for frontend debugging
- Check server logs for backend issues

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details