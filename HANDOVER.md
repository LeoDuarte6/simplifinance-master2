# SimpliFinance Platform - Technical Handover Documentation

**Last Updated:** September 29, 2025
**Migration Completed:** September 2025
**Firebase Project:** `simplifinancellc-a6795`

---

## Table of Contents
1. [Platform Overview](#platform-overview)
2. [Architecture](#architecture)
3. [Payment System (Critical)](#payment-system-critical)
4. [User Management](#user-management)
5. [Content Management](#content-management)
6. [Deployment Process](#deployment-process)
7. [Common Maintenance Tasks](#common-maintenance-tasks)
8. [Troubleshooting](#troubleshooting)
9. [Security & Credentials](#security--credentials)
10. [Database Structure](#database-structure)

---

## Platform Overview

SimpliFinance is a wealth education SaaS platform that provides financial advisors with educational content. The platform features:

- **User Authentication**: Firebase Authentication with password-based login
- **Subscription Management**: Two-tier subscription system (Essentials $99/mo, Premium $199/mo)
- **Payment Processing**: Authorize.Net recurring billing integration
- **Content Library**: 200+ educational materials with tiered access control
- **Admin Dashboard**: Complete user and content management interface
- **Whitelabel Content**: Client-specific content delivery system

### Key Numbers (Post-Migration)
- **Users**: 11 active users with passwords preserved
- **Content Items**: 200 educational materials
- **Active Subscriptions**: 4 users with Authorize.Net recurring billing
- **Storage**: ~15GB of content files and thumbnails

---

## Architecture

### Frontend Stack
- **Framework**: Vanilla JavaScript ES6 modules
- **Styling**: TailwindCSS 3.x with custom configuration
- **Build Tool**: Tailwind CLI for CSS compilation
- **Hosting**: Firebase Hosting with SPA routing
- **Component System**: Dynamic HTML component loading

### Backend Stack
- **Runtime**: Node.js 18 (Firebase Functions 2nd Gen)
- **Database**: Cloud Firestore
- **Storage**: Firebase Cloud Storage
- **Authentication**: Firebase Authentication
- **Payments**: Authorize.Net SDK (authorizenet npm package)

### Key File Locations

```
simplifinance-master/
├── index.html                    # Main entry point
├── js/
│   ├── app.js                   # Application initialization
│   ├── config.js                # Firebase config
│   ├── routing/router.js        # Client-side routing
│   ├── app/
│   │   ├── admin-handler.js     # Admin dashboard logic
│   │   ├── auth-handler.js      # Authentication flows
│   │   ├── dashboard-handler.js # User dashboard
│   │   └── library-handler.js   # Content library
│   └── ui/
│       ├── library-manager.js   # Library UI management
│       └── admin-manager.js     # Admin UI management
├── components/                   # HTML components
│   ├── admin.html
│   ├── library.html
│   └── dashboard.html
├── functions/
│   ├── index.js                 # All Firebase Functions
│   └── services/
│       ├── payment.js           # Authorize.Net integration
│       └── database.js          # Firestore operations
├── firebase.json                # Firebase configuration
├── firestore.rules              # Database security rules
└── storage.rules                # Storage security rules
```

---

## Payment System (CRITICAL)

### Authorize.Net Configuration

**Production Credentials** (in `functions/services/payment.js`):
- **API Login ID**: `934RH38faDN`
- **Transaction Key**: `8Y9SUR87pr73Jk6y`
- **Environment**: PRODUCTION

⚠️ **DO NOT CHANGE THESE CREDENTIALS** - They are tied to the existing Authorize.Net merchant account. Changing them will break all payment processing.

### How Subscriptions Work

1. **User Signs Up**: User enters payment info on signup page
2. **Create Customer Profile**: Backend creates customer profile in Authorize.Net
3. **Create Subscription**: Backend creates recurring subscription (monthly/annual)
4. **Store Subscription ID**: `authNetSubscriptionId` stored in Firestore user record
5. **Auto-Renewal**: Authorize.Net automatically charges on billing date

### Subscription Management Functions

#### Create Subscription
```javascript
// Function: createSubscription
// Triggered when user signs up with payment
// Creates Authorize.Net subscription and customer profile
```

#### Cancel Subscription
```javascript
// Function: cancelSubscription
// Cancels recurring billing in Authorize.Net
// User retains access until end of current billing period
```

#### Update Payment
```javascript
// Function: updatePaymentProfile
// Updates credit card info in Authorize.Net customer profile
```

#### Update Billing Date
```javascript
// Function: updateUserBillingDate
// Cancels old subscription and creates new one with different start date
// Only use for admin corrections (e.g., fixing billing cycle issues)
```

### Pricing Structure

```javascript
planPricing = {
  'essentials': {
    monthly: '99.00',
    annual: '990.00'
  },
  'premium': {
    monthly: '199.00',
    annual: '1990.00'
  }
}
```

### Testing Payments

**Test Credit Card Numbers** (Authorize.Net Sandbox):
- Visa: `4111111111111111`
- Mastercard: `5424000000000015`
- Amex: `378282246310005`
- CVV: Any 3 digits
- Expiry: Any future date

**IMPORTANT**: Current setup uses PRODUCTION mode, not sandbox. Testing with real cards will charge actual money.

---

## User Management

### User Roles

1. **Admin** (`isAdmin: true`)
   - Full access to admin dashboard
   - Can create/delete users
   - Can manage all content
   - Can preview any user's library view

2. **Advisor** (`isAdvisor: true`)
   - Standard user with subscription
   - Access to library based on plan level
   - Can request new content topics

3. **User** (default)
   - Standard user with subscription
   - Access to library based on plan level

### Admin Functions

#### View All Users
```javascript
// Function: adminGetAllUsers
// Returns all users with subscription and profile data
```

#### Create User
```javascript
// Function: adminCreateUser
// Creates Firebase Auth account and Firestore user record
// Does NOT create subscription - user must subscribe separately
```

#### Update User Password
```javascript
// Function: adminUpdateUserPassword
// Updates Firebase Auth password
// Useful for password reset assistance
```

#### Update User Role
```javascript
// Function: adminUpdateUserRole
// Toggle admin/advisor status
```

#### Delete User
```javascript
// Function: adminDeleteUser
// Deletes Firebase Auth account and Firestore record
// Does NOT cancel Authorize.Net subscription automatically
// ⚠️ Manual cleanup required in Authorize.Net if user has subscription
```

### User Subscription States

A user record contains:
```javascript
{
  email: "user@example.com",
  name: "User Name",
  plan: "Premium Plan" | "Essentials Plan",
  planLevel: "premium" | "essentials",
  subscriptionStatus: "active" | "inactive" | "cancelled",
  authNetSubscriptionId: "70218588", // Authorize.Net subscription ID
  isAdmin: false,
  isAdvisor: true,
  accessibleContent: [] // For custom content assignments
}
```

⚠️ **Important**: Users without `authNetSubscriptionId` do NOT have automatic billing. They were either:
- Created manually by admin
- Subscription payment failed
- Legacy user from migration

---

## Content Management

### Content Structure

Each content item in Firestore (`content` collection):
```javascript
{
  title: "Investment Basics",
  description: "An overview of investment types...",
  category: "Investments & Market Concepts",
  planRequirement: "essentials" | "premium" | "custom",
  specificUsers: ["email@example.com"], // For custom content
  fileName: "investment-basics.zip",
  thumbnailUrl: "https://storage.googleapis.com/...",
  downloadUrl: "https://storage.googleapis.com/...",
  uploadedBy: "adminUserId",
  uploadedAt: Timestamp,
  isActive: true
}
```

### Access Control Tiers

1. **Essentials**: Available to all paid users
2. **Premium**: Only available to Premium plan subscribers
3. **Custom**: Only available to specific users (whitelist by email)

### Content Upload Process

1. Admin uploads content file (.zip) and thumbnail image
2. Files stored in Firebase Storage: `library/{contentId}/{filename}`
3. Metadata stored in Firestore `content` collection
4. Signed URLs generated with 30-day expiry (cached in Firestore)
5. URLs auto-refresh when they have <7 days remaining

### Signed URL Caching

For performance, download/thumbnail URLs are cached:
```javascript
{
  cachedDownloadUrl: "https://storage.googleapis.com/...",
  cachedThumbnailUrl: "https://storage.googleapis.com/...",
  urlExpiry: Timestamp,
  urlLastUpdated: Timestamp
}
```

Reduces load time from ~5 seconds to <1 second after initial cache.

### Categories

Categories are stored in `categories` collection:
```javascript
{
  name: "Investments & Market Concepts",
  isActive: true,
  createdAt: Timestamp
}
```

Default categories:
- Investments & Market Concepts
- Taxes and Retirement
- Economic & Financial Concepts
- Market Update
- Whitelabel

Admins can create new categories or delete unused ones via admin panel.

---

## Deployment Process

### Prerequisites

```bash
npm install -g firebase-tools
firebase login
```

### CSS Build (Required Before Deploy)

```bash
# Development (watch mode)
npm run build-css

# Production (minified)
npm run build-css-prod
```

⚠️ **ALWAYS** run production CSS build before deploying hosting.

### Deploy Everything

```bash
firebase deploy
```

This deploys:
- Functions (backend)
- Hosting (frontend)
- Firestore rules
- Storage rules

### Deploy Specific Components

```bash
# Frontend only
firebase deploy --only hosting

# Backend only
firebase deploy --only functions

# Specific function
firebase deploy --only functions:createSubscription

# Database rules
firebase deploy --only firestore:rules,storage:rules
```

### Rollback

```bash
# View previous deployments
firebase hosting:clone [SOURCE_SITE_ID]:[SOURCE_VERSION_ID] [TARGET_SITE_ID]

# List versions
firebase hosting:channel:list
```

---

## Common Maintenance Tasks

### 1. Add a New User (Admin-Created)

**Via Admin Dashboard:**
1. Login as admin
2. Go to Admin → User Management
3. Click "Create New User"
4. Fill in email, password, name, plan
5. User is created but has NO subscription

**Important**: Admin-created users need to either:
- Be given a manual subscription via Authorize.Net
- Go through normal subscription signup flow

### 2. Reset User Password

**Via Admin Dashboard:**
1. Find user in User Management
2. Click actions menu → Change Password
3. Enter new password
4. User can now login with new password

### 3. Cancel Subscription

**Via Admin Dashboard:**
1. Find user in User Management
2. Click on user's subscription info
3. Click "Cancel Subscription"
4. Backend cancels in Authorize.Net
5. User retains access until current period ends

**Note**: Cancellation in Authorize.Net is immediate billing stop. Access control is managed separately in Firestore.

### 4. Upload New Content

**Via Admin Dashboard:**
1. Login as admin
2. Go to Admin → Content Upload
3. Fill in title, description, select category
4. Choose plan requirement (essentials/premium/custom)
5. Upload .zip file and thumbnail image
6. Submit - content is immediately available

### 5. Delete Old Content

**Via Admin Dashboard:**
1. Go to Admin → Content Management
2. Search/sort to find content
3. Click actions → Delete
4. Confirm deletion
5. Content is marked inactive (soft delete)

### 6. View User's Library (Whitelabel Testing)

**Via Admin Dashboard:**
1. Go to Admin → User Management
2. Click actions → Preview Library
3. See exactly what that user sees
4. Useful for testing custom content assignments

### 7. Update Billing Date

**Use Case**: User was charged on wrong date, need to fix billing cycle.

**Via Admin Dashboard:**
1. Find user in User Management
2. Click actions → Update Billing Date
3. Select new billing date
4. Backend cancels old subscription and creates new one with correct date

⚠️ **Warning**: This cancels and recreates the subscription. Only use for corrections.

### 8. Check Subscription Status

```bash
# View Firebase Functions logs
firebase functions:log

# Filter for specific user
firebase functions:log | grep "user@example.com"

# Check payment service logs
firebase functions:log | grep "PaymentService"
```

---

## Troubleshooting

### Thumbnails Not Loading

**Symptom**: Content shows but thumbnails are blank

**Cause**: Signed URLs expired or IAM permissions missing

**Fix**:
```bash
# Grant service account signing permissions
gcloud iam service-accounts add-iam-policy-binding \
  simplifinancellc-a6795@appspot.gserviceaccount.com \
  --member="serviceAccount:simplifinancellc-a6795@appspot.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --project=simplifinancellc-a6795
```

Also check: `functions/index.js` line 1532-1545 for URL generation logic.

### Payment Fails with "Authentication Error"

**Cause**: Wrong Authorize.Net credentials or sandbox/production mismatch

**Fix**: Verify credentials in `functions/services/payment.js`:
- `apiLoginId`: Should be `934RH38faDN`
- `transactionKey`: Should be `8Y9SUR87pr73Jk6y`
- `environment`: Should be `Constants.endpoint.production`

### User Can't Login

**Cause**: Password incorrect or Firebase Auth account doesn't exist

**Debug**:
1. Check Firebase Console → Authentication
2. Verify email exists
3. Check if email is verified (shouldn't be required but check settings)
4. Try admin password reset

### Content Upload Fails

**Cause**: File too large or wrong file type

**Limits**:
- Content file: 50MB max
- Thumbnail: 5MB max
- Allowed types: Any for content, images for thumbnail

**Fix**: Check `functions/index.js` line 1287-1290 for file size validation.

### Admin Panel Won't Load

**Cause**: User not marked as admin in Firestore

**Fix**:
1. Open Firebase Console
2. Go to Firestore Database
3. Find user in `users` collection
4. Set `isAdmin: true`

### Subscription Not Auto-Renewing

**Cause**: User doesn't have `authNetSubscriptionId`

**Check**:
1. View user in admin panel
2. Look for subscription info
3. If missing, user needs to subscribe through normal flow

**Manual Fix**:
1. Create subscription in Authorize.Net portal
2. Copy subscription ID
3. Add to user's Firestore record: `authNetSubscriptionId: "12345678"`

---

## Security & Credentials

### Firebase Project

- **Project ID**: `simplifinancellc-a6795`
- **Project Number**: `599812082035`
- **Region**: `us-central1`

### Authorize.Net

- **Login**: Access via merchant portal
- **API Login ID**: `934RH38faDN`
- **Transaction Key**: `8Y9SUR87pr73Jk6y`
- **Mode**: Production

### Firebase Admin Access

Current admin users in Firestore (check `isAdmin: true`):
- Check Firebase Console → Firestore → `users` collection

### Service Account Permissions

The app service account needs:
- `roles/iam.serviceAccountTokenCreator` - For signed URLs
- Default Firebase Functions permissions

---

## Database Structure

### Firestore Collections

#### `users`
Stores user accounts and subscription info
```
users/{userId}
  - email: string
  - name: string
  - plan: string
  - planLevel: string
  - subscriptionStatus: string
  - authNetSubscriptionId: string
  - isAdmin: boolean
  - isAdvisor: boolean
  - accessibleContent: array
  - createdAt: timestamp
```

#### `content`
Stores educational content metadata
```
content/{contentId}
  - title: string
  - description: string
  - category: string
  - planRequirement: string
  - specificUsers: array
  - fileName: string
  - thumbnailFileName: string
  - cachedDownloadUrl: string
  - cachedThumbnailUrl: string
  - urlExpiry: timestamp
  - uploadedBy: string
  - uploadedAt: timestamp
  - isActive: boolean
```

#### `categories`
Stores content categories
```
categories/{categoryId}
  - name: string
  - isActive: boolean
  - createdAt: timestamp
```

#### `customerProfiles`
Stores Authorize.Net customer profile IDs
```
customerProfiles/{userId}
  - customerProfileId: string
  - customerPaymentProfileId: string
  - billingCycle: string
  - createdAt: timestamp
```

### Firebase Storage Structure

```
gs://simplifinancellc-a6795.firebasestorage.app/
└── library/
    └── {contentId}/
        ├── content-file.zip
        └── thumbnail.png
```

---

## Migration Notes

### What Was Migrated (September 2025)

✅ **Firebase Authentication** (11 users)
- Passwords preserved using Firebase password export/import
- All user accounts functional

✅ **Firestore Database**
- All users with subscriptions, plans, roles
- All 200 content items with metadata
- All categories
- Customer profiles

✅ **Firebase Storage**
- All content files (~15GB)
- All thumbnail images
- Proper folder structure maintained

✅ **Authorize.Net Subscriptions**
- Subscription IDs migrated
- Active subscriptions still billing correctly
- Payment credentials unchanged

### Known Issues Post-Migration

1. **Paul Williams** - No `authNetSubscriptionId`, manual billing only
2. **Thumbnail caching** - URLs regenerated with 30-day expiry
3. **Admin-created users** - Need manual subscription setup

---

## Future Considerations

### Performance Optimizations
- Current signed URL caching reduces load time significantly
- Consider CDN for static assets if traffic grows
- Database indexes are optimized for current query patterns

### Scaling
- Current Firebase plan handles ~1000 users easily
- Authorize.Net has no subscription limits
- Storage costs are negligible at current size

### Domain Setup
To add custom domain (simplifinancellc.com):
1. Firebase Console → Hosting → Add custom domain
2. Add DNS records provided by Firebase
3. No code changes required

### Monitoring
- Firebase Console → Functions → Logs
- Firebase Console → Performance
- Authorize.Net merchant portal for payment analytics

---

## Support Contacts

### Platform Maintenance
- **Developer**: Contact guy's dad (developer)
- **Firebase**: Firebase Support (via console)
- **Authorize.Net**: Merchant support portal

### Emergency Contacts
- **Firebase Console**: https://console.firebase.google.com/project/simplifinancellc-a6795
- **Authorize.Net Portal**: https://account.authorize.net

---

## Quick Reference Commands

```bash
# Deploy everything
firebase deploy

# Deploy frontend only
firebase deploy --only hosting

# Deploy backend only
firebase deploy --only functions

# Build CSS for production
npm run build-css-prod

# View logs
firebase functions:log

# List deployments
firebase hosting:channel:list

# Check project info
firebase projects:list
```

---

**End of Documentation**

For additional questions or issues not covered here, check:
- Firebase Functions logs for backend issues
- Browser console for frontend issues
- Authorize.Net merchant portal for payment issues