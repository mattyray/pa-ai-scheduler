# PA Scheduling System

A comprehensive web application for managing personal assistant (PA) scheduling for disability care needs.

## Tech Stack

**Frontend:**
- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
- Deployed on Netlify

**Backend:**
- Django 5.x
- Django REST Framework
- PostgreSQL 16
- Redis 7
- Celery
- Django Channels (WebSockets)
- Deployed on Fly.io

## Development Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker & Docker Compose
- Git

### Getting Started

1. Clone the repository
2. Copy `.env.example` to `.env` in the backend directory
3. Run `docker-compose up` to start all services
4. Access the application at `http://localhost:3000`

## Project Structure
```
scheduler/
├── backend/          # Django application
├── frontend/         # Next.js application
└── README.md
```

## Features

- User authentication (Admin & PA roles)
- Shift request and approval workflow
- Real-time schedule updates via WebSockets
- AI-powered scheduling assistance
- Coverage monitoring for critical care times
- Email notifications
- Mobile-responsive design

## License

Private - All rights reserved