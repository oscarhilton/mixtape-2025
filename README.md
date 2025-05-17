<img width="1505" alt="Screenshot 2025-05-17 at 22 40 49" src="https://github.com/user-attachments/assets/c1cdeac1-f71a-4c95-a17a-6baea0702aea" />

# Music Sharing Platform

A modern web application that allows users to share and discover playlists with location-based features. Built with Next.js, TypeScript, and Spotify integration.

## Features

- **Spotify Integration**
  - Seamless authentication with Spotify
  - Playlist creation and management
  - Real-time playback controls
  - Track comments and discussions

- **Location-Based Features**

  - Automatic location detection
  - Manual address entry
  - Geocoding support via Nominatim
  - Playlist placement on map

- **Social Features**
  - Playlist voting system
  - Track-specific comments
  - User profiles and authentication
  - Real-time updates

## Tech Stack

- **Frontend**

  - Next.js 14
  - TypeScript
  - Tailwind CSS
  - Heroicons
  - React Context for state management

- **Backend**

  - Express.js
  - Knex.js for database operations
  - PostgreSQL database
  - Passport.js for authentication

- **Development Tools**
  - Turborepo for monorepo management
  - ESLint for code linting
  - Prettier for code formatting
  - TypeScript for type safety

## Project Structure

```
├── apps/
│   ├── web/           # Main Next.js application
│   └── docs/          # Documentation site
├── packages/
│   ├── api/           # Express.js backend
│   ├── shared-ui/     # Shared React components
│   ├── shared-contexts/# Shared React contexts
│   └── eslint-config/ # Shared ESLint configuration
```

## Getting Started

### Prerequisites

- Node.js 18 or later
- pnpm package manager
- PostgreSQL database
- Spotify Developer account

### Environment Setup

1. Create a `.env` file in the root directory with the following variables:

```env
# Spotify API
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# API
API_PORT=3001
SESSION_SECRET=your_session_secret
```

2. Install dependencies:

```bash
pnpm install
```

3. Run database migrations:

```bash
cd packages/api
pnpm migrate:latest
```

4. Start the development servers:

```bash
pnpm dev
```

The application will be available at:

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## Development

### Available Scripts

- `pnpm dev` - Start all applications in development mode
- `pnpm build` - Build all applications and packages
- `pnpm lint` - Run ESLint across all packages
- `pnpm test` - Run tests across all packages

### Database Migrations

To create a new migration:

```bash
cd packages/api
pnpm migrate:make migration_name
```

To run migrations:

```bash
pnpm migrate:latest
```

To rollback migrations:

```bash
pnpm migrate:rollback
```

## API Endpoints

### Authentication

- `GET /auth/spotify` - Initiate Spotify authentication
- `GET /auth/spotify/callback` - Spotify OAuth callback
- `GET /auth/me` - Get current user session
- `GET /auth/logout` - Logout user

### Playlists

- `GET /playlists` - Get all playlists
- `POST /playlists` - Create new playlist
- `GET /playlists/:id` - Get playlist by ID
- `PUT /playlists/:id` - Update playlist
- `POST /playlists/:id/vote` - Vote for playlist
- `DELETE /playlists/:id` - Delete playlist

### Comments

- `POST /comments` - Create new comment
- `GET /playlists/:playlistId/comments` - Get playlist comments

### Spotify Integration

- `GET /spotify/playlist-name/:playlistId` - Get playlist name
- `GET /spotify/playlist/:playlistId/tracks` - Get playlist tracks
- `PUT /spotify/play` - Control playback

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Spotify Web API for music integration
- Nominatim for geocoding services
- The open-source community for various tools and libraries
