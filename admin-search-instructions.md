# Finding User "Paul" in SimpliFinance Database

## Quick Access Methods (Ordered by Ease)

### 🥇 Method 1: Admin Web Interface (Easiest)

1. **Login to Admin Dashboard:**
   - Go to: https://simplifinance-65ac9.web.app/admin
   - Login with admin credentials (admin@simplifinance.com)

2. **Search for Paul:**
   - Click on "User Management" tab
   - The system automatically loads all users
   - Use Ctrl+F (or Cmd+F on Mac) to search for "Paul" on the page
   - Look through the user table for Paul's record

3. **View Paul's Details:**
   - Once found, you'll see:
     - User ID
     - Name
     - Email
     - Plan (Essentials/Premium)
     - Subscription Status
     - Role (Admin/Advisor)
     - Created Date

### 🥈 Method 2: Firebase Console (Direct Database Access)

1. **Access Firebase Console:**
   - Go to: https://console.firebase.google.com/project/simplifinance-65ac9/firestore/data
   - Login with Google account that has access to this project

2. **Navigate to Users:**
   - Click on "users" collection
   - Browse through user documents
   - Look for documents where "name" field contains "Paul"

3. **View Full Record:**
   - Click on a user document to see all fields:
     - authNetSubscriptionId (Authorize.Net subscription)
     - customerProfileId (payment profile)
     - billingAddress
     - subscriptionStatus

### 🥉 Method 3: Browser Console (If Admin Logged In)

1. **Open Browser Developer Tools:**
   - Go to admin dashboard (Method 1)
   - Press F12 (or right-click → Inspect)
   - Go to Console tab

2. **Run Search Script:**
   ```javascript
   // Copy and paste this into the console:
   const searchPaul = async () => {
       try {
           const { httpsCallable } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js");
           const adminGetAllUsers = httpsCallable(window.simpliFinanceApp.functions, 'adminGetAllUsers');
           const result = await adminGetAllUsers();
           
           if (result.data.status === 'success') {
               const paulUsers = result.data.users.filter(user => 
                   user.name && user.name.toLowerCase().includes('paul')
               );
               
               console.log(`Found ${paulUsers.length} users named Paul:`);
               paulUsers.forEach(user => {
                   console.log(`
                   Name: ${user.name}
                   Email: ${user.email}
                   Plan: ${user.plan}
                   Subscription ID: ${user.authNetSubscriptionId}
                   Status: ${user.subscriptionStatus}
                   User ID: ${user.id}
                   `);
               });
               return paulUsers;
           }
       } catch (error) {
           console.error("Search failed:", error);
       }
   };
   
   // Run the search
   searchPaul();
   ```

### 🔧 Method 4: Firebase CLI Export

1. **Install Firebase CLI:**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login and Export Data:**
   ```bash
   firebase login
   firebase use simplifinance-65ac9
   firebase firestore:export ./firestore-backup
   ```

3. **Search Exported Data:**
   - Navigate to exported JSON files
   - Use text search tools to find "Paul"

## Paul's Expected Data Structure

When you find Paul, his user record will contain:

```javascript
{
  id: "firebase_user_id",
  name: "Paul [LastName]",
  email: "paul@example.com",
  plan: "Premium Plan" | "Essentials Plan",
  subscriptionStatus: "active" | "cancelled" | "pending",
  authNetSubscriptionId: "123456789", // Authorize.Net subscription
  customerProfileId: "987654321",     // Authorize.Net customer profile
  customerPaymentProfileId: "456789", // Payment method
  isAdmin: false,
  isAdvisor: true | false,
  billingAddress: {
    addressLine1: "123 Main St",
    city: "City",
    state: "State",
    zipCode: "12345",
    country: "US"
  },
  createdAt: { seconds: 1234567890 },
  // ... other fields
}
```

## Important Notes

- **Admin Access Required:** Most methods require admin authentication
- **Subscription Data:** Paul's billing info is in `authNetSubscriptionId` and `customerProfileId`
- **Multiple Pauls:** There might be multiple users with "Paul" in their name
- **Case Sensitivity:** Search is case-insensitive in most methods

## Troubleshooting

### If You Can't Access Admin Dashboard:
1. Verify admin credentials
2. Check if account has `isAdmin: true` in database
3. Try logging out and back in

### If Firebase Console Access Denied:
1. Contact project owner for access
2. Check IAM permissions in Google Cloud Console

### If Search Returns No Results:
1. Paul might be spelled differently (Paolo, Paulie, etc.)
2. Paul might be in the last name field
3. Try broader search terms

## Next Steps After Finding Paul

1. **Document Paul's Details:**
   - User ID
   - Subscription ID
   - Customer Profile ID
   - Current plan and status

2. **Check Authorize.Net:**
   - Use Paul's `authNetSubscriptionId` to look up billing details
   - Check payment history and subscription status

3. **Review Access Permissions:**
   - Check what content Paul has access to
   - Verify advisor status if applicable

## Contact Information

If you need help accessing any of these methods:
- Project ID: `simplifinance-65ac9`
- Admin Email: `admin@simplifinance.com`
- Firebase Console: https://console.firebase.google.com/project/simplifinance-65ac9