# SimpliFinance

## Update Authorize.net Keys

1. Replace the `apiLoginId` and `transactionKey` in the `functions/services/payment.js` file line 7 and 8 with the new keys.
```javascript
class PaymentService {
    constructor() {
        this.apiLoginId = "7V4Drk4V";
        this.transactionKey = "45Rs7ua39ADf6cAd";
```

2. Replace the `environment` in the `functions/services/payment.js` file line 10 with the new environment.
```javascript
        this.environment = Constants.endpoint;
```

## Deployment

1. Install the Firebase CLI:

```bash
npm install -g firebase-tools
```

2. Login to Firebase:

```bash
firebase login
```

3. Initialize Firebase in the project directory:

```bash
firebase use default
```

4. Build Production CSS:

```bash
npm run build-css-prod
```

5. Deploy the project:


```bash
firebase deploy
```
