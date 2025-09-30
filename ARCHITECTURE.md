# SimpliFinance - System Architecture Overview

**Last Updated:** September 30, 2025
**Platform:** Firebase (Hosting, Functions, Firestore, Auth, Storage)
**Payment Provider:** Authorize.Net
**Domain:** simplifinancellc.com

---

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Application Flow](#application-flow)
3. [Component Architecture](#component-architecture)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [Authentication & Authorization](#authentication--authorization)
6. [Payment Processing](#payment-processing)
7. [Content Access Control](#content-access-control)
8. [Admin Workflows](#admin-workflows)
9. [Key Integration Points](#key-integration-points)

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  index.html  │  │   JS Modules │  │  Components  │          │
│  │  (SPA Entry) │  │   (ES6)      │  │  (HTML)      │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                   │
│         └──────────────────┴──────────────────┘                   │
│                            │                                       │
└────────────────────────────┼───────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FIREBASE SERVICES                             │
│                                                                   │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │   Hosting     │  │  Auth         │  │  Firestore    │       │
│  │  (Static)     │  │  (Users)      │  │  (Database)   │       │
│  └───────────────┘  └───────────────┘  └───────────────┘       │
│                                                                   │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │  Storage      │  │  Functions    │  │  Router       │       │
│  │  (Files)      │  │  (Backend)    │  │  (Rewrites)   │       │
│  └───────────────┘  └───────┬───────┘  └───────────────┘       │
└──────────────────────────────┼───────────────────────────────────┘
                               │
                               ▼
                    ┌──────────────────┐
                    │  Authorize.Net   │
                    │  Payment Gateway │
                    └──────────────────┘
```

---

## Application Flow

### 1. Application Initialization Flow

```
Page Load (index.html)
    │
    ├──> Load ComponentLoader
    │       └──> Load initial components (header, footer, hero, etc.)
    │
    ├──> Initialize SimpliFinanceApp (js/app.js)
    │       │
    │       ├──> Initialize Firebase (js/config.js)
    │       │       └──> Connect to: Auth, Firestore, Functions, Storage
    │       │
    │       ├──> Initialize UI Managers
    │       │       ├──> PageManager (navigation)
    │       │       ├──> DashboardManager (user dashboard)
    │       │       ├──> LibraryManager (content display)
    │       │       ├──> SignupFormManager (subscription forms)
    │       │       └──> AdminManager (admin panel)
    │       │
    │       ├──> Initialize Handlers
    │       │       ├──> AuthHandler (login/logout)
    │       │       ├──> SignupHandler (subscription creation)
    │       │       ├──> DashboardHandler (user actions)
    │       │       ├──> LibraryHandler (content loading)
    │       │       └──> AdminHandler (admin actions)
    │       │
    │       └──> Setup Auth State Listener
    │               └──> onAuthStateChanged → Update UI based on user
    │
    └──> Initialize Router (js/routing/router.js)
            └──> Handle current URL path
```

### 2. User Journey Flow

#### A. Visitor (Not Logged In)
```
Visit Site
    │
    ├──> See: Home, About, Services, Login
    │
    ├──> Click "Get Started" or Plan Button
    │       └──> Navigate to /signup
    │               │
    │               ├──> Step 1: Select Plan (Essentials/Premium, Monthly/Annual)
    │               ├──> Step 2: Account Creation (Email, Password, Name)
    │               ├──> Step 3: Payment Info (Card, Billing Address)
    │               └──> Submit
    │                       │
    │                       └──> Call: createSubscription() Firebase Function
    │                               │
    │                               ├──> Create User in Firebase Auth
    │                               ├──> Create Subscription in Authorize.Net
    │                               ├──> Store User Data in Firestore
    │                               └──> Store Customer Profile for future use
    │
    └──> Redirect to /dashboard (logged in)
```

#### B. Active Subscriber
```
Login (/login)
    │
    └──> Firebase Auth → onAuthStateChanged
            │
            ├──> Fetch User Data from Firestore
            │
            ├──> Update Navigation
            │       ├──> Show: Dashboard, Library, Logout
            │       └──> Hide: Login, Schedule Demo
            │
            └──> Can Access:
                    ├──> /dashboard - Manage subscription, update payment
                    └──> /library - View and download educational content
```

#### C. Admin User
```
Login as Admin
    │
    └──> Detect isAdmin: true
            │
            ├──> Show Admin Panel in Navigation
            │
            └──> Can Access:
                    ├──> /admin - Full admin dashboard
                    │       ├──> User Management
                    │       │       ├──> Create users
                    │       │       ├──> Update passwords
                    │       │       ├──> Delete users
                    │       │       ├──> Update roles
                    │       │       └──> Manage content access
                    │       │
                    │       ├──> Content Upload
                    │       │       ├──> Upload ZIP files
                    │       │       ├──> Upload thumbnails
                    │       │       └──> Set access permissions
                    │       │
                    │       └──> Content Management
                    │               ├──> Edit metadata
                    │               ├──> Update access rules
                    │               └──> Delete content
                    │
                    └──> /library - Preview content for all users
```

---

## Component Architecture

### Frontend Component Hierarchy

```
SimpliFinanceApp (js/app.js) - Main Application Controller
    │
    ├──> UIManager (js/ui.js) - Central UI Coordination
    │       │
    │       ├──> PageManager (js/ui/page-manager.js)
    │       │       ├── Navigation control
    │       │       ├── Page visibility toggling
    │       │       └── Auth-based UI updates
    │       │
    │       ├──> DashboardManager (js/ui/dashboard-manager.js)
    │       │       ├── Display user info
    │       │       ├── Show subscription status
    │       │       └── Payment update forms
    │       │
    │       ├──> LibraryManager (js/ui/library-manager.js)
    │       │       ├── Display content items
    │       │       ├── Category organization
    │       │       └── Download handling
    │       │
    │       ├──> SignupFormManager (js/ui/signup-form-manager.js)
    │       │       ├── Multi-step form logic
    │       │       ├── Form validation
    │       │       └── Payment input formatting
    │       │
    │       └──> AdminManager (js/ui/admin-manager.js)
    │               ├── User table display
    │               ├── Content table display
    │               └── Modal management
    │
    ├──> Handlers (Business Logic)
    │       │
    │       ├──> AuthHandler (js/app/auth-handler.js)
    │       │       ├── handleLogin()
    │       │       ├── handleLogout()
    │       │       └── Auth state management
    │       │
    │       ├──> SignupHandler (js/app/signup-handler.js)
    │       │       ├── setupMultiStepSignup()
    │       │       ├── handleSubscriptionSubmit()
    │       │       └── Payment validation
    │       │
    │       ├──> DashboardHandler (js/app/dashboard-handler.js)
    │       │       ├── setupDashboard()
    │       │       ├── handleCancelSubscription()
    │       │       └── handleUpdatePayment()
    │       │
    │       ├──> LibraryHandler (js/app/library-handler.js)
    │       │       ├── loadLibraryContent()
    │       │       ├── groupContentByCategory()
    │       │       └── filterContentForUser()
    │       │
    │       └──> AdminHandler (js/app/admin-handler.js)
    │               ├── loadAllUsers()
    │               ├── loadAllContent()
    │               ├── handleUserOperations()
    │               └── handleContentOperations()
    │
    ├──> Router (js/routing/router.js)
    │       ├── URL path mapping
    │       ├── Auth-based route protection
    │       └── Browser history management
    │
    └──> ComponentManager (js/component-manager.js)
            ├── Dynamic component loading
            └── Component caching
```

---

## Data Flow Diagrams

### 1. User Registration & Subscription Creation

```
User fills signup form
    │
    ├──> Step 1: Select Plan
    │       └──> Store: planName, planPrice, billingCycle
    │
    ├──> Step 2: Account Info
    │       └──> Store: email, password, name, isAdvisor
    │
    ├──> Step 3: Payment Info
    │       └──> Store: cardNumber, expiryDate, cardCode, billingAddress
    │
    └──> Submit Form
            │
            └──> SignupHandler.handleSubscriptionSubmit()
                    │
                    └──> Call Firebase Function: createSubscription()
                            │
                            ├──> 1. Validate all input data
                            │
                            ├──> 2. Check for existing customer profile (resubscription)
                            │
                            ├──> 3. PaymentService.createSubscription()
                            │       │
                            │       ├──> Create/Reuse Customer Profile in Authorize.Net
                            │       ├──> Create Payment Profile
                            │       ├──> Create ARB Subscription
                            │       └──> Return: subscriptionId, transactionId, profileIds
                            │
                            ├──> 4. DatabaseService.createUser()
                            │       │
                            │       └──> Store in Firestore /users/{uid}:
                            │               ├── name
                            │               ├── email
                            │               ├── plan
                            │               ├── planLevel (essentials/premium)
                            │               ├── subscriptionStatus: "active"
                            │               ├── authNetSubscriptionId
                            │               ├── isAdvisor
                            │               ├── billingAddress
                            │               └── timestamps
                            │
                            ├──> 5. DatabaseService.storeCustomerProfile()
                            │       │
                            │       └──> Store in Firestore /customerProfiles/{uid}:
                            │               ├── customerProfileId
                            │               ├── customerPaymentProfileId
                            │               ├── customerAddressId
                            │               ├── planName
                            │               ├── billingCycle
                            │               └── isActive: true
                            │
                            └──> 6. Return success → Frontend redirects to /dashboard
```

### 2. Content Access & Library Loading

```
User navigates to /library
    │
    └──> Router checks authentication
            │
            ├──> Not authenticated → Redirect to /login
            │
            └──> Authenticated → Load library-page
                    │
                    └──> LibraryHandler.loadLibraryContent()
                            │
                            ├──> Check: currentUserData.subscriptionStatus === 'active'
                            │       └──> Inactive → Show "Subscription Required"
                            │
                            └──> Call Firebase Function: getUserAccessibleContent()
                                    │
                                    ├──> Get User Data from Firestore
                                    │       └──> Extract: planLevel, email, accessibleContent[]
                                    │
                                    ├──> Query Firestore /content collection
                                    │       └──> Where: isActive === true
                                    │
                                    ├──> Filter content by access rules:
                                    │       │
                                    │       ├──> planRequirement: "essentials"
                                    │       │       └──> Available to ALL users
                                    │       │
                                    │       ├──> planRequirement: "premium"
                                    │       │       └──> Available to premium users only
                                    │       │
                                    │       └──> planRequirement: "custom"
                                    │               └──> Check if user.email in specificUsers[]
                                    │
                                    ├──> Generate Signed URLs (30-day expiry)
                                    │       ├── downloadUrl (ZIP file)
                                    │       └── thumbnailUrl (Image)
                                    │
                                    ├──> Cache URLs in Firestore (performance optimization)
                                    │
                                    └──> Return: { content: [...], userPlan: "premium" }
                                            │
                                            └──> LibraryManager displays:
                                                    ├── Group by category
                                                    ├── Render cards with thumbnails
                                                    └── Setup download handlers
```

### 3. Payment Update Flow

```
User clicks "Update Payment Method" on dashboard
    │
    └──> DashboardHandler.handleUpdatePayment()
            │
            ├──> Show payment form modal
            │
            └──> User submits new card info
                    │
                    └──> Call Firebase Function: updatePaymentProfile()
                            │
                            ├──> 1. Validate authentication & subscription status
                            │
                            ├──> 2. Get customer profile from Firestore
                            │       └──> Extract: customerProfileId, customerPaymentProfileId
                            │
                            ├──> 3. PaymentService.updateCustomerPaymentProfile()
                            │       │
                            │       └──> Authorize.Net API Call:
                            │               └──> updateCustomerPaymentProfile
                            │                       ├── New card number (masked after)
                            │                       ├── New expiry date
                            │                       ├── New CVV
                            │                       └── Updated billing address
                            │
                            ├──> 4. Update Firestore /users/{uid}
                            │       └──> Store new billingAddress, updatedAt
                            │
                            ├──> 5. Update Firestore /customerProfiles/{uid}
                            │       └──> Store paymentMethodUpdatedAt timestamp
                            │
                            └──> 6. Return success → Show confirmation message
```

### 4. Admin User Management Flow

```
Admin navigates to /admin → User Management tab
    │
    └──> AdminHandler.loadAllUsers()
            │
            └──> Call Firebase Function: adminGetAllUsers()
                    │
                    ├──> Verify isAdmin === true
                    │
                    ├──> Query Firestore /users (all documents)
                    │
                    └──> Return all user data
                            │
                            └──> AdminManager.displayUsersTable()
                                    │
                                    └──> Shows table with actions:
                                            ├── Update Password
                                            ├── Update Role (admin/advisor)
                                            ├── Delete User
                                            └── Manage Content Access

Admin clicks "Delete User"
    │
    └──> AdminHandler.handleDeleteUser(userId)
            │
            └──> Call Firebase Function: adminDeleteUser(userId)
                    │
                    ├──> Verify isAdmin === true
                    │
                    ├──> Prevent self-deletion (userId !== auth.uid)
                    │
                    ├──> Try: Delete from Firebase Auth
                    │       └──> May fail if user doesn't exist (continue anyway)
                    │
                    ├──> Delete from Firestore /users/{userId}
                    │
                    └──> Return success → Refresh user table
```

---

## Authentication & Authorization

### Authentication States

```
┌─────────────────────────────────────────────────────────────┐
│  Firebase Auth.onAuthStateChanged() - Runs on every page   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    User Object Exists?
                    │
        ┌───────────┴───────────┐
        │                       │
       YES                     NO
        │                       │
        ▼                       ▼
  Fetch Firestore        Show Public UI
  /users/{uid}           ├── Show Login
        │                └── Hide Dashboard/Library
        │
        ▼
  User Data Retrieved
        │
        ├──> Store: currentUser, currentUserData
        │
        ├──> Check: isAdmin
        │       ├── True → Show Admin Panel
        │       └── False → Show Dashboard
        │
        ├──> Check: subscriptionStatus
        │       ├── "active" → Grant Library Access
        │       └── "cancelled" → Hide Library
        │
        └──> Update Navigation UI
```

### Route Protection (js/routing/router.js)

```javascript
Route: /library (requiresAuth: true)
    │
    └──> Router.canAccessRoute()
            │
            ├──> Check: currentUser exists?
            │       └── No → Redirect to /login
            │
            └──> Yes → Allow access
                    └──> LibraryHandler checks subscriptionStatus
                            ├── Active → Load content
                            └── Inactive → Show "Subscription Required"

Route: /admin (requiresAuth: true, adminOnly: true)
    │
    └──> Router.canAccessRoute()
            │
            ├──> Check: currentUser exists?
            │       └── No → Redirect to /login
            │
            └──> Check: isAdmin === true?
                    ├── No → Redirect to /
                    └── Yes → Load admin panel
```

---

## Payment Processing

### Payment Service Architecture (functions/services/payment.js)

```
PaymentService Class
    │
    ├──> Authorize.Net API Configuration
    │       ├── API Login ID (from environment)
    │       ├── Transaction Key (from environment)
    │       └── Environment: Production
    │
    ├──> createSubscription()
    │       │
    │       ├──> 1. Check for existing customer profile (resubscription)
    │       │
    │       ├──> 2. Create or reuse Customer Profile
    │       │       └── createCustomerProfile() or use existing
    │       │
    │       ├──> 3. Create Payment Profile
    │       │       └── createCustomerPaymentProfile()
    │       │
    │       ├──> 4. Create Subscription (ARB)
    │       │       └── ARBCreateSubscription
    │       │               ├── amount (from plan)
    │       │               ├── interval (monthly/annually)
    │       │               ├── startDate (today or custom)
    │       │               ├── customer profile ID
    │       │               └── payment profile ID
    │       │
    │       └──> Return: subscriptionId, transactionId, profileIds
    │
    ├──> cancelSubscription()
    │       └── ARBCancelSubscription
    │
    ├──> updateCustomerPaymentProfile()
    │       └── updateCustomerPaymentProfile (update card details)
    │
    ├──> getSubscription()
    │       └── ARBGetSubscriptionStatus
    │
    └──> createSubscriptionWithDate() (admin use for billing date changes)
            └── Same as createSubscription but with custom startDate
```

### Subscription States

```
1. ACTIVE
   ├── User can access library
   ├── Billing occurs automatically
   └── Display: "Active" badge

2. CANCELLED
   ├── No library access
   ├── Can resubscribe (uses saved payment profile)
   └── Display: "Cancelled" status

3. SUSPENDED (Payment Failed)
   ├── No library access
   ├── User must update payment method
   └── Display: Warning message
```

---

## Content Access Control

### Access Control Matrix

```
┌─────────────────┬──────────────┬──────────────┬──────────────┐
│ Content Type    │ Essentials   │ Premium      │ Custom       │
├─────────────────┼──────────────┼──────────────┼──────────────┤
│ planRequirement │ "essentials" │ "premium"    │ "custom"     │
│                 │              │              │              │
│ Who can access? │ ALL active   │ Premium      │ Specific     │
│                 │ subscribers  │ subscribers  │ users only   │
│                 │              │              │ (by email)   │
└─────────────────┴──────────────┴──────────────┴──────────────┘
```

### Content Access Logic (functions/index.js: getUserAccessibleContent)

```javascript
For each content item in /content collection:

    if (user.isAdmin) {
        // Admins see everything
        return ALL content;
    }

    if (content.planRequirement === "essentials") {
        // Available to all active subscribers
        grant access;
    }

    if (content.planRequirement === "premium") {
        if (user.planLevel === "premium") {
            grant access;
        }
    }

    if (content.planRequirement === "custom") {
        if (content.specificUsers.includes(user.email)) {
            grant access;
        }
        // Also check legacy ID-based access
        if (user.accessibleContent.includes(content.id)) {
            grant access;
        }
    }
```

### Content Storage Structure

```
Firebase Storage: /library/{contentId}/
    ├── content.zip (the actual ZIP file)
    └── thumbnail.png (preview image)

Firestore: /content/{contentId}
    ├── title
    ├── description
    ├── category
    ├── planRequirement ("essentials"|"premium"|"custom")
    ├── specificUsers: ["email1@example.com", "email2@example.com"]
    ├── thumbnailUrl (signed URL, cached)
    ├── downloadUrl (signed URL, cached)
    ├── cachedDownloadUrl (performance cache)
    ├── cachedThumbnailUrl (performance cache)
    ├── urlExpiry (timestamp, 30 days)
    ├── storagePaths: { content, thumbnail }
    ├── uploadedBy (admin userId)
    ├── uploadedAt (timestamp)
    └── downloadCount
```

---

## Admin Workflows

### Admin Function Categories

```
1. USER MANAGEMENT
   ├── adminCreateUser() - Create user with admin-set password
   ├── adminDeleteUser() - Delete from Auth + Firestore
   ├── adminUpdateUserPassword() - Reset user password
   ├── adminUpdateUserRole() - Set admin/advisor status
   └── adminUpdateUserContent() - Manage custom content access

2. CONTENT MANAGEMENT
   ├── uploadContent() - Upload ZIP + thumbnail
   ├── updateContent() - Edit metadata
   ├── setContentAccess() - Change access permissions
   └── deleteContent() - Remove content + files

3. SUBSCRIPTION MANAGEMENT
   ├── adminSearchUser() - Find users by name/email
   ├── adminUpdateSubscriptionDate() - Change billing date
   └── updateUserBillingDate() - Change billing date by email

4. CATEGORY MANAGEMENT
   ├── initializeCategories() - Setup default categories
   ├── getCategories() - List all categories
   └── deleteCategory() - Mark category inactive
```

### Admin Content Upload Flow

```
Admin uploads content
    │
    ├──> Select ZIP file (max 50MB)
    ├──> Select thumbnail image (PNG/JPG/WebP)
    ├──> Enter title, description, category
    ├──> Set plan requirement (Essentials/Premium/Custom)
    └──> If Custom: Select specific user emails
            │
            └──> Call Firebase Function: uploadContent()
                    │
                    ├──> Validate all inputs
                    │
                    ├──> Create Firestore document in /content
                    │       └──> Get generated contentId
                    │
                    ├──> Upload files to Storage
                    │       ├── /library/{contentId}/content.zip
                    │       └── /library/{contentId}/thumbnail.png
                    │
                    ├──> Generate signed URLs (far-future expiry)
                    │
                    ├──> Update Firestore document with URLs
                    │
                    ├──> Update category count in /categories
                    │
                    └──> If custom access: Update user documents
                            └── Add contentId to user.accessibleContent[]
```

---

## Key Integration Points

### 1. Firebase Functions → Authorize.Net

```
Location: functions/services/payment.js

Integration Points:
├── createSubscription()
│   └── Authorize.Net API: ARBCreateSubscriptionRequest
│
├── cancelSubscription()
│   └── Authorize.Net API: ARBCancelSubscriptionRequest
│
├── getSubscription()
│   └── Authorize.Net API: ARBGetSubscriptionStatusRequest
│
└── updateCustomerPaymentProfile()
    └── Authorize.Net API: updateCustomerPaymentProfileRequest

Configuration:
├── API Login ID: process.env.AUTHORIZENET_API_LOGIN_ID
├── Transaction Key: process.env.AUTHORIZENET_TRANSACTION_KEY
└── Environment: Production (api.authorize.net)
```

### 2. Frontend → Firebase Functions

```
Location: All handler files (js/app/*.js)

Pattern:
import { httpsCallable } from "firebase-functions";
const functionRef = httpsCallable(functions, 'functionName');
const result = await functionRef(data);

Key Functions Called:
├── createSubscription({ planName, planPrice, paymentDetails, ... })
├── cancelSubscription({ subscriptionId })
├── updatePaymentProfile({ paymentDetails, billingAddress })
├── getUserAccessibleContent({ getAllContent: false })
├── adminGetAllUsers()
├── adminDeleteUser({ userId })
├── adminCreateUser({ email, password, name, plan, ... })
└── uploadContent({ title, description, contentFile, thumbnailFile, ... })
```

### 3. Firebase Auth → Firestore

```
Relationship: Firebase Auth UID = Firestore Document ID

Firebase Auth:
└── User Account (email, password, displayName)

Firestore /users/{uid}:
└── User Profile Data (name, plan, subscription status, etc.)

Firestore /customerProfiles/{uid}:
└── Authorize.Net Profile Data (for resubscription)

Sync Points:
├── On Signup: Create Auth user → Create Firestore document
├── On Login: Auth provides UID → Fetch Firestore data
└── On Delete: Delete Auth user → Delete Firestore document
```

### 4. Firebase Storage → Signed URLs

```
Location: functions/index.js (getUserAccessibleContent)

Flow:
1. Content is uploaded to Storage:
   └── /library/{contentId}/filename.zip

2. Function generates signed URL:
   └── bucket.file(filePath).getSignedUrl({ action: 'read', expires: Date })

3. URL is cached in Firestore:
   └── /content/{contentId}/cachedDownloadUrl

4. Client uses URL directly:
   └── <a href="{signedUrl}" download>Download</a>

URL Lifecycle:
├── Generated on-demand
├── Cached for 30 days
├── Regenerated if expiry < 7 days
└── Client downloads directly from Storage (no function calls)
```

---

## Database Schema

### Firestore Collections

#### /users/{userId}
```javascript
{
    name: string,
    email: string,
    plan: string, // "Premium - Annual", "Essentials - Monthly"
    planLevel: string, // "premium" | "essentials"
    subscriptionStatus: string, // "active" | "cancelled"
    authNetSubscriptionId: string,
    isAdmin: boolean,
    isAdvisor: boolean,
    billingAddress: {
        addressLine1: string,
        addressLine2: string,
        city: string,
        state: string,
        zipCode: string
    },
    accessibleContent: string[], // Array of content IDs for custom access
    createdAt: Timestamp,
    updatedAt: Timestamp,
    // Admin operations tracking:
    createdBy: string, // userId of admin who created (if admin-created)
    passwordUpdatedAt: Timestamp,
    passwordUpdatedBy: string,
    roleUpdatedAt: Timestamp,
    roleUpdatedBy: string
}
```

#### /customerProfiles/{userId}
```javascript
{
    customerProfileId: string, // Authorize.Net customer profile ID
    customerPaymentProfileId: string, // Authorize.Net payment profile ID
    customerAddressId: string, // Authorize.Net address ID
    planName: string,
    billingCycle: string, // "monthly" | "annual"
    isActive: boolean,
    createdAt: Timestamp,
    lastUpdatedAt: Timestamp,
    paymentMethodUpdatedAt: Timestamp
}
```

#### /content/{contentId}
```javascript
{
    contentId: string,
    title: string,
    description: string,
    category: string,
    planRequirement: string, // "essentials" | "premium" | "custom"
    specificUsers: string[], // Email addresses for custom access
    thumbnailUrl: string,
    downloadUrl: string,
    cachedDownloadUrl: string, // Performance optimization
    cachedThumbnailUrl: string,
    urlExpiry: Timestamp, // When cached URLs expire
    urlLastUpdated: Timestamp,
    storagePaths: {
        content: string, // Storage path: library/{id}/file.zip
        thumbnail: string // Storage path: library/{id}/thumb.png
    },
    originalContentFilename: string,
    originalThumbnailFilename: string,
    uploadedBy: string, // Admin userId
    uploadedAt: Timestamp,
    createdAt: Timestamp,
    updatedAt: Timestamp,
    updatedBy: string,
    fileSize: number,
    downloadCount: number,
    isActive: boolean
}
```

#### /categories/{categoryId}
```javascript
{
    name: string,
    description: string,
    createdBy: string,
    createdAt: Timestamp,
    updatedAt: Timestamp,
    contentCount: number,
    isActive: boolean,
    isDefault: boolean // True for system-created categories
}
```

---

## Error Handling Strategy

### Frontend Error Handling

```javascript
try {
    const result = await functionRef(data);
    // Handle success
} catch (error) {
    // HttpsError from Firebase Functions
    const errorCode = error.code; // 'unauthenticated', 'invalid-argument', etc.
    const errorMessage = error.message; // User-friendly message
    const errorDetails = error.details; // Additional context

    // Display to user
    showErrorMessage(errorMessage);
}
```

### Backend Error Handling (Firebase Functions)

```javascript
// Structured error responses
throw new HttpsError('invalid-argument', 'User-friendly message', {
    code: 'CUSTOM_ERROR_CODE',
    details: { field: 'value' }
});

// Common error codes:
├── 'unauthenticated' - Not logged in
├── 'permission-denied' - No access rights
├── 'invalid-argument' - Bad input data
├── 'not-found' - Resource doesn't exist
├── 'failed-precondition' - Business logic error
└── 'internal' - Server error
```

---

## Deployment Process

### Deployment Checklist

```
1. Build CSS (if changed):
   └── npm run build-css-prod

2. Deploy Functions:
   └── firebase deploy --only functions
       └── Deploys all functions in functions/index.js
       └── Updates: Node.js 18 runtime (upgrade to 20 before Oct 2025)

3. Deploy Hosting:
   └── firebase deploy --only hosting
       └── Uploads all files (800+ files)
       └── Updates: simplifinancellc.com

4. Deploy Everything:
   └── firebase deploy
       └── Deploys functions, hosting, firestore rules, storage rules

5. Test Deployment:
   └── Create test channel: firebase hosting:channel:deploy test
       └── Get preview URL for testing
```

### Environment Variables (Firebase Functions)

```
Required in Firebase Functions configuration:

├── AUTHORIZENET_API_LOGIN_ID
│   └── Set via: firebase functions:config:set authorizenet.api_login_id="VALUE"
│
└── AUTHORIZENET_TRANSACTION_KEY
    └── Set via: firebase functions:config:set authorizenet.transaction_key="VALUE"

View current config:
└── firebase functions:config:get
```

---

## Performance Optimizations

### 1. Signed URL Caching
- **Problem**: Generating signed URLs on every library load is slow
- **Solution**: Cache URLs in Firestore with 30-day expiry
- **Implementation**: getUserAccessibleContent() checks cache first

### 2. Component Dynamic Loading
- **Problem**: Loading all HTML components upfront slows page load
- **Solution**: Load components on-demand when pages are accessed
- **Implementation**: ComponentManager.loadComponent()

### 3. Debounced UI Updates
- **Problem**: Multiple rapid auth state changes cause flickering
- **Solution**: Debounce UI updates with timeouts
- **Implementation**: debouncedUpdateHomePageForAuth()

### 4. Subscription Profile Reuse
- **Problem**: Creating new Authorize.Net profiles on resubscription
- **Solution**: Store customer profile IDs for reuse
- **Implementation**: /customerProfiles collection

---

## Security Considerations

### 1. Function-Level Security
```javascript
// All admin functions verify:
const adminResult = await dbService.getUser(auth.uid);
if (!adminResult.success || !adminResult.userData.isAdmin) {
    throw new HttpsError('permission-denied', 'Admin access required');
}
```

### 2. Route Protection
```javascript
// Router checks auth before navigation:
if (route.requiresAuth && !currentUser) {
    router.navigateTo('/login');
}

if (route.adminOnly && !isAdmin) {
    router.navigateTo('/');
}
```

### 3. Firestore Security Rules
```
Location: firestore.rules

Key Rules:
├── Users can only read/write their own /users/{userId} document
├── Only authenticated users can read /content
├── Only admins can write /content, /categories
└── /customerProfiles are completely private (admin only)
```

### 4. Input Validation
```javascript
// All inputs are validated before processing:
const dataValidation = ValidationUtils.validateSubscriptionData(data);
if (!dataValidation.isValid) {
    throw new HttpsError('invalid-argument', dataValidation.errors.join(', '));
}
```

---

## Monitoring & Logging

### Firebase Functions Logs

```bash
# View recent logs:
firebase functions:log

# View logs for specific function:
firebase functions:log --only functionName

# Access via Console:
https://console.firebase.google.com/project/simplifinancellc-a6795/functions/logs
```

### Key Log Patterns

```javascript
// Success logs:
logger.info(`SUCCESS: User ${userId} action completed`);

// Error logs:
logger.error("Error in functionName:", error);

// Warning logs:
logger.warn(`Warning: Edge case encountered for user ${userId}`);
```

---

## Common Troubleshooting

### Issue: Library not loading
**Check:**
1. User is authenticated (`currentUser` exists)
2. User has active subscription (`subscriptionStatus === 'active'`)
3. Content exists in Firestore `/content` collection
4. Browser console for JavaScript errors
5. Function logs for backend errors

### Issue: Payment processing fails
**Check:**
1. Authorize.Net credentials are set in Firebase config
2. Card details are valid
3. Billing address is complete
4. Function logs for specific Authorize.Net error codes
5. Authorize.Net dashboard for transaction details

### Issue: Admin panel not accessible
**Check:**
1. User document has `isAdmin: true` in Firestore
2. Router is protecting /admin route properly
3. Navigation shows admin link (should be red)
4. Browser cache (hard refresh: Cmd+Shift+R)

### Issue: Delete user fails
**Check:**
1. User exists in both Firebase Auth and Firestore
2. User is not trying to delete themselves
3. Function has proper admin verification
4. Error logs show specific failure point

---

## Future Improvements

### Recommended Enhancements

1. **Upgrade to Node.js 20**
   - Current: Node.js 18 (deprecated Oct 2025)
   - Action: Update `functions/package.json` engines

2. **Add Email Notifications**
   - Welcome emails on signup
   - Payment failure notifications
   - Content upload confirmations

3. **Enhanced Analytics**
   - Track content downloads
   - Monitor user engagement
   - Payment conversion tracking

4. **Subscription Webhooks**
   - Listen for Authorize.Net events
   - Auto-update subscription status
   - Handle payment failures automatically

5. **Content Versioning**
   - Track content updates
   - Allow users to download specific versions
   - Version history in admin panel

6. **Search Functionality**
   - Search library content by title/description
   - Filter by category
   - Sort by upload date/popularity

---

## Contact & Support

**Firebase Project ID:** simplifinancellc-a6795
**Production Domain:** https://simplifinancellc.com
**Firebase Console:** https://console.firebase.google.com/project/simplifinancellc-a6795

**Key Services:**
- Hosting: Firebase Hosting
- Backend: Firebase Functions (Node.js 18)
- Database: Cloud Firestore
- Storage: Cloud Storage
- Auth: Firebase Authentication
- Payment: Authorize.Net (Production)

---

**Document Version:** 1.0
**Last Updated:** September 30, 2025
**Maintained By:** Development Team
