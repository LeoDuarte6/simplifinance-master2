# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SimpliFinance is a wealth education platform built with:
- **Frontend**: Vanilla JavaScript ES6 modules with component-based architecture
- **Styling**: TailwindCSS with custom configuration
- **Backend**: Firebase Functions (Node.js) with Firebase Firestore database
- **Hosting**: Firebase Hosting with client-side routing
- **Payments**: Authorize.Net integration for subscription management

## Development Commands

### CSS Build Commands
- `npm run build-css` - Build CSS with watch mode for development
- `npm run build-css-prod` - Build production CSS with minification

### Firebase Deployment
1. Build production CSS: `npm run build-css-prod`
2. Deploy to Firebase: `firebase deploy`

## Architecture Overview

### Frontend Architecture
The application uses a modular component-based architecture:

- **Component System**: HTML components in `/components/` directory loaded dynamically via `ComponentLoader`
- **Application Core**: Main app logic in `/js/app.js` with centralized state management
- **Routing**: Client-side routing handled by `/js/routing/router.js` with Firebase Hosting rewrites
- **UI Management**: Centralized UI management via `UIManager` in `/js/ui.js`
- **Module Structure**:
  - `/js/app/` - Feature-specific handlers (auth, dashboard, admin, etc.)
  - `/js/ui/` - UI-specific managers and helpers
  - `/js/validation.js` - Form validation utilities

### Backend Architecture (Firebase Functions)
- **Main Functions**: Located in `/functions/index.js` with comprehensive subscription and user management
- **Services**:
  - `PaymentService` - Authorize.Net payment processing
  - `DatabaseService` - Firestore database operations
- **Key Functions**:
  - User authentication and profile management
  - Subscription creation, cancellation, and payment updates
  - Admin user management and content management
  - Content access control based on subscription tiers

### Firebase Configuration
- **Hosting**: Configured for single-page application with client-side routing
- **Functions**: Located in `/functions/` directory with Node.js runtime
- **Firestore**: Database for user data, subscriptions, and content
- **Storage**: File storage for library content and thumbnails

## Key Implementation Details

### Component Loading
Components are loaded asynchronously using fetch API. The main component map is defined in `index.html`.

### Authentication Flow
Firebase Authentication integrated with custom user management. Auth state changes trigger UI updates and routing decisions.

### Payment Integration
Authorize.Net integration for subscription management. Payment credentials are configured in `/functions/services/payment.js`.

### Content Management
Three-tier access system:
- **Essentials**: Basic content access
- **Premium**: Full content library access  
- **Custom**: Admin-controlled specific user access

## Important File Locations

### Configuration Files
- `firebase.json` - Firebase project configuration
- `tailwind.config.js` - TailwindCSS configuration
- `package.json` - Dependencies and scripts

### Security Rules
- `firestore.rules` - Firestore security rules
- `storage.rules` - Firebase Storage security rules

### Key Frontend Files
- `index.html` - Main application entry point
- `js/app.js` - Application initialization and core logic
- `js/config.js` - Firebase configuration

### Key Backend Files
- `functions/index.js` - All Firebase Functions
- `functions/services/payment.js` - Payment processing
- `functions/services/database.js` - Database operations

## Development Notes

- The application uses ES6 modules with dynamic imports
- Components are HTML files loaded at runtime
- Firebase Hosting handles client-side routing via rewrites
- Admin functionality requires special user permissions in Firestore
- Payment processing includes comprehensive error handling and validation