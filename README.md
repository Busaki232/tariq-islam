# Tariq Islam - Global Muslims Connect

A comprehensive mobile and web application designed to connect Muslims worldwide with prayer times, mosque locations, community features, and more.

## Features

- **Prayer Times**: Accurate prayer times based on your location
- **Qibla Compass**: Visual compass pointing to Mecca
- **Mosque Finder**: Discover mosques worldwide
- **Community Chat**: Connect with Muslims globally
- **Islamic Calendar**: Hijri date tracking and Islamic holidays
- **Quran Player**: Listen to Quran recitations
- **Tasbih Counter**: Digital dhikr counter
- **Events**: Community events and gatherings

## Technology Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **UI Components**: shadcn/ui
- **Backend**: Supabase (Database, Auth, Edge Functions, Storage)
- **Mobile**: Capacitor (iOS & Android)
- **Real-time**: Supabase Realtime for messaging and calls
- **Video/Audio Calls**: Daily.co

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Git

### Installation

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project directory
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Start the development server
npm run dev
```

### Mobile Development

For native mobile app development:

```sh
# Add iOS/Android platforms
npx cap add ios
npx cap add android

# Build the web app
npm run build

# Sync with native platforms
npx cap sync

# Run on device/emulator
npx cap run android  # or ios
```

## Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/          # Page components
├── hooks/          # Custom React hooks
├── lib/            # Utility functions
├── i18n/           # Internationalization
└── integrations/   # External service integrations

supabase/
├── functions/      # Edge functions
└── migrations/     # Database migrations
```

## Deployment

Build the production bundle:

```sh
npm run build
```

The output will be in the `dist` folder, ready for deployment to any static hosting service.

## License

Copyright © 2025 Busaki Investments LLC. All rights reserved.

## Contact

- Website: https://global-muslims-connect.com
- Support: support@global-muslims-connect.com
