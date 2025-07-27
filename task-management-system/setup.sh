#!/bin/bash

# Task Management System Setup Script
echo "🚀 Setting up Task Management System..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 16 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    print_error "Node.js version 16 or higher is required. Current version: $(node -v)"
    exit 1
fi

print_status "Node.js version: $(node -v)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm."
    exit 1
fi

print_status "npm version: $(npm -v)"

# Check if MySQL is installed
if ! command -v mysql &> /dev/null; then
    print_warning "MySQL is not found in PATH. Make sure MySQL is installed and running."
    print_info "You can install MySQL from: https://dev.mysql.com/downloads/"
else
    print_status "MySQL is available"
fi

# Install backend dependencies
print_info "Installing backend dependencies..."
cd backend
if npm install; then
    print_status "Backend dependencies installed successfully"
else
    print_error "Failed to install backend dependencies"
    exit 1
fi

# Install frontend dependencies
print_info "Installing frontend dependencies..."
cd ../frontend
if npm install; then
    print_status "Frontend dependencies installed successfully"
else
    print_error "Failed to install frontend dependencies"
    exit 1
fi

cd ..

# Create environment files if they don't exist
if [ ! -f "backend/.env" ]; then
    print_info "Creating backend .env file..."
    cp backend/.env.example backend/.env
    print_status "Backend .env file created from template"
    print_warning "Please update backend/.env with your database credentials"
fi

if [ ! -f "frontend/.env" ]; then
    print_info "Creating frontend .env file..."
    cat > frontend/.env << EOF
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_APP_NAME=Task Management System
REACT_APP_VERSION=1.0.0
EOF
    print_status "Frontend .env file created"
fi

# Database setup instructions
print_info "Database Setup Instructions:"
echo "1. Make sure MySQL is running"
echo "2. Create a database named 'task_management':"
echo "   mysql -u root -p -e \"CREATE DATABASE task_management;\""
echo "3. Update backend/.env with your database credentials"
echo ""

# Final instructions
print_status "Setup completed successfully!"
echo ""
print_info "Next steps:"
echo "1. Configure your database connection in backend/.env"
echo "2. Start the backend server:"
echo "   cd backend && npm run dev"
echo "3. In a new terminal, start the frontend:"
echo "   cd frontend && npm start"
echo ""
print_info "The application will be available at:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:5000"
echo "   Health Check: http://localhost:5000/health"
echo ""
print_warning "Demo Credentials:"
echo "   Individual User: user@demo.com / password123"
echo "   Group Admin: admin@demo.com / password123"
echo ""
print_status "Happy coding! 🎉"