const authorizenet = require("authorizenet");
const { APIContracts, Constants, APIControllers } = authorizenet;
const { logger } = require("firebase-functions");
const ErrorMapper = require("../utils/errorMapper");

class PaymentService {
    constructor() {
        this.apiLoginId = "934RH38faDN";
        this.transactionKey = "8Y9SUR87pr73Jk6y";
        this.environment = Constants.endpoint.production;
        this.errorMapper = new ErrorMapper();

        // Plan pricing configuration
        this.planPricing = {
            'essentials': {
                monthly: '99.00',
                annual: '990.00'
            },
            'premium': {
                monthly: '199.00',
                annual: '1990.00'
            }
        };
    }

    getPlanPrice(planName, billingCycle = 'monthly') {
        const planType = planName.toLowerCase().includes('essentials') ? 'essentials' : 'premium';
        const cycle = billingCycle.toLowerCase() === 'annual' ? 'annual' : 'monthly';

        return this.planPricing[planType][cycle];
    }

    determineBillingCycle(planName, planPrice = null) {
        // If price is provided, use it to determine cycle
        if (planPrice) {
            const price = parseFloat(planPrice);
            return price >= 990 ? 'annual' : 'monthly';
        }

        // Otherwise, check plan name for indicators
        if (planName.toLowerCase().includes('annual') || planName.toLowerCase().includes('year')) {
            return 'annual';
        }

        return 'monthly';
    }

    getMerchantAuthentication() {
        const merchantAuth = new APIContracts.MerchantAuthenticationType();
        merchantAuth.setName(this.apiLoginId);
        merchantAuth.setTransactionKey(this.transactionKey);
        return merchantAuth;
    }

    createPaymentSchedule(planPrice, startDate = null) {
        const paymentSchedule = new APIContracts.PaymentScheduleType();
        const interval = new APIContracts.PaymentScheduleType.Interval();

        // Determine billing cycle based on price (annual plans are higher priced)
        const price = parseFloat(planPrice);
        const isAnnual = price >= 990; // 990+ indicates annual plan

        // For annual plans, use 12 months instead of YEARS enum (which doesn't exist)
        interval.setLength(isAnnual ? 12 : 1);
        interval.setUnit(APIContracts.ARBSubscriptionUnitEnum.MONTHS);

        paymentSchedule.setInterval(interval);

        // Use provided start date or default to today for backward compatibility
        const subscriptionStartDate = startDate || new Date().toISOString().substring(0, 10);
        paymentSchedule.setStartDate(subscriptionStartDate);
        paymentSchedule.setTotalOccurrences(9999);

        return paymentSchedule;
    }

    createCreditCard(cardNumber, expiryDate, cardCode) {
        const creditCard = new APIContracts.CreditCardType();
        creditCard.setCardNumber(cardNumber);

        if (typeof expiryDate !== 'string' || !expiryDate.includes('/')) {
            throw new Error('Invalid expiry date format. Use MM/YY.');
        }
        const [month, year] = expiryDate.split('/');
        creditCard.setExpirationDate(`20${year}-${month}`);
        creditCard.setCardCode(cardCode);

        return creditCard;
    }

    createBillingAddress(name, billingAddress = null) {
        const billTo = new APIContracts.NameAndAddressType();
        const nameParts = name.split(' ');
        billTo.setFirstName(nameParts[0] || 'First');
        billTo.setLastName(nameParts.slice(1).join(' ') || 'Last');

        if (billingAddress) {
            // Use provided billing address
            billTo.setAddress(billingAddress.addressLine1);
            if (billingAddress.addressLine2) {
                billTo.setAddress(billingAddress.addressLine1 + ' ' + billingAddress.addressLine2);
            }
            billTo.setCity(billingAddress.city);
            billTo.setState(billingAddress.state);
            billTo.setZip(billingAddress.zipCode);
            billTo.setCountry(billingAddress.country);

        } else {
            billTo.setAddress('123 Main Street');
            billTo.setCity('Anytown');
            billTo.setState('WA');
            billTo.setZip('99999');
            billTo.setCountry('USA');
        }

        return billTo;
    }

    createCustomer(email) {
        const customer = new APIContracts.CustomerType();
        customer.setEmail(email);
        return customer;
    }

    async createSubscription(subscriptionData) {
        const {
            planName,
            planPrice,
            paymentDetails,
            name,
            email,
            isAdvisor,
            billingAddress,
            existingCustomerProfile
        } = subscriptionData;

        const { cardNumber, expiryDate, cardCode } = paymentDetails;

        logger.info('Creating payment with subscription setup:', {
            planName,
            planPrice,
            email,
            hasExistingProfile: !!existingCustomerProfile
        });

        try {
            let customerProfileId, customerPaymentProfileId, customerAddressId, transactionId;

            if (existingCustomerProfile) {
                // For existing customers, process payment first
                logger.info('Processing payment for existing customer:', existingCustomerProfile);

                // Update payment profile with new payment details if provided
                if (paymentDetails && paymentDetails.cardNumber) {
                    await this.updateCustomerPaymentProfile(
                        existingCustomerProfile.customerProfileId,
                        existingCustomerProfile.customerPaymentProfileId,
                        paymentDetails,
                        billingAddress
                    );
                }

                // Process payment using existing profile
                const paymentResult = await this.processPaymentFromProfile({
                    customerProfileId: existingCustomerProfile.customerProfileId,
                    customerPaymentProfileId: existingCustomerProfile.customerPaymentProfileId,
                    amount: planPrice,
                    planName
                });

                if (!paymentResult.success) {
                    throw new Error(`Payment failed: ${paymentResult.message}`);
                }

                customerProfileId = existingCustomerProfile.customerProfileId;
                customerPaymentProfileId = existingCustomerProfile.customerPaymentProfileId;
                customerAddressId = existingCustomerProfile.customerAddressId;
                transactionId = paymentResult.transactionId;
            } else {
                // For new customers, process payment first
                logger.info('Processing payment for new customer');
                const paymentResult = await this.processPayment({
                    paymentDetails,
                    amount: planPrice,
                    planName,
                    customerInfo: { name, email },
                    billingAddress
                });

                if (!paymentResult.success) {
                    throw new Error(`Payment failed: ${paymentResult.message}`);
                }

                transactionId = paymentResult.transactionId;

                // Create customer profile from successful transaction
                const profileResult = await this.createCustomerProfileFromTransaction(transactionId);
                if (!profileResult.success) {
                    logger.error('Failed to create customer profile from transaction, falling back to manual profile creation');
                    // Fallback: create profile manually with the same payment details
                    const manualProfileResult = await this.createCustomerProfile(name, email, billingAddress, paymentDetails);
                    if (!manualProfileResult.success) {
                        throw new Error(`Failed to create customer profile: ${manualProfileResult.message}`);
                    }
                    customerProfileId = manualProfileResult.customerProfileId;
                    customerPaymentProfileId = manualProfileResult.customerPaymentProfileId;
                    customerAddressId = manualProfileResult.customerAddressId;
                } else {
                    customerProfileId = profileResult.customerProfileId;
                    customerPaymentProfileId = profileResult.customerPaymentProfileId;
                    customerAddressId = profileResult.customerAddressId;
                }
            }

            // Calculate next billing date (1 month or 1 year from now based on plan)
            const billingCycle = this.determineBillingCycle(planName, planPrice);
            const nextBillingDate = new Date();
            if (billingCycle === 'annual') {
                nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
            } else {
                nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
            }

            // Create subscription starting from next billing cycle
            const subscriptionResult = await this.createSubscriptionFromProfile({
                customerProfileId,
                customerPaymentProfileId,
                customerAddressId,
                planName,
                planPrice,
                startDate: nextBillingDate.toISOString().substring(0, 10)
            });

            if (subscriptionResult.success) {
                return {
                    success: true,
                    transactionId: transactionId,
                    subscriptionId: subscriptionResult.subscriptionId,
                    customerProfileId: customerProfileId,
                    customerPaymentProfileId: customerPaymentProfileId,
                    customerAddressId: customerAddressId,
                    message: 'Payment processed and subscription created successfully'
                };
            } else {
                // Payment was successful, but subscription creation failed
                // Log this for manual intervention
                logger.error('Payment successful but subscription creation failed:', {
                    transactionId,
                    customerProfileId,
                    error: subscriptionResult.message
                });
                throw new Error(`Payment processed successfully, but subscription setup failed: ${subscriptionResult.message}`);
            }

        } catch (error) {
            logger.error('Error in createSubscription:', error);
            throw error;
        }
    }

    async processPayment({ paymentDetails, amount, planName, customerInfo, billingAddress }) {
        try {
            logger.info('Processing payment:', { amount, planName, customerEmail: customerInfo.email });

            const merchantAuth = this.getMerchantAuthentication();

            // Create credit card
            const creditCard = this.createCreditCard(
                paymentDetails.cardNumber,
                paymentDetails.expiryDate,
                paymentDetails.cardCode
            );

            const payment = new APIContracts.PaymentType();
            payment.setCreditCard(creditCard);

            // Create billing address
            const billTo = this.createBillingAddress(customerInfo.name, billingAddress);

            // Create order details
            const orderDetails = new APIContracts.OrderType();
            orderDetails.setInvoiceNumber(`INV-${Date.now()}`);
            orderDetails.setDescription(`${planName} Subscription - First Payment`);

            // Create customer info
            const customer = this.createCustomer(customerInfo.email);

            // Create transaction request
            const transactionRequest = new APIContracts.TransactionRequestType();
            transactionRequest.setTransactionType(APIContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
            transactionRequest.setPayment(payment);
            transactionRequest.setAmount(parseFloat(amount));
            transactionRequest.setOrder(orderDetails);
            transactionRequest.setBillTo(billTo);
            transactionRequest.setCustomer(customer);

            const createRequest = new APIContracts.CreateTransactionRequest();
            createRequest.setMerchantAuthentication(merchantAuth);
            createRequest.setTransactionRequest(transactionRequest);

            const ctrl = new APIControllers.CreateTransactionController(createRequest.getJSON());
            ctrl.setEnvironment(this.environment);

            return new Promise((resolve, reject) => {
                ctrl.execute(() => {
                    try {
                        const apiResponse = ctrl.getResponse();
                        const response = new APIContracts.CreateTransactionResponse(apiResponse);

                        logger.info('Payment response:', JSON.stringify(apiResponse, null, 2));

                        if (response != null && response.getMessages().getResultCode() === APIContracts.MessageTypeEnum.OK) {
                            if (response.getTransactionResponse().getMessages() != null) {
                                const transactionId = response.getTransactionResponse().getTransId();
                                const responseCode = response.getTransactionResponse().getResponseCode();

                                logger.info(`Payment successful: Transaction ID: ${transactionId}, Response Code: ${responseCode}`);

                                resolve({
                                    success: true,
                                    transactionId: transactionId,
                                    responseCode: responseCode,
                                    message: 'Payment processed successfully'
                                });
                            } else {
                                const errors = response.getTransactionResponse().getErrors();
                                const errorMessage = errors ? errors.getError()[0].getErrorText() : 'Transaction failed';

                                logger.error('Payment failed:', errorMessage);
                                resolve({
                                    success: false,
                                    message: errorMessage
                                });
                            }
                        } else {
                            let errorMessage = 'Payment processing failed';
                            if (response.getTransactionResponse() && response.getTransactionResponse().getErrors()) {
                                errorMessage = response.getTransactionResponse().getErrors().getError()[0].getErrorText();
                            } else if (response.getMessages()) {
                                errorMessage = response.getMessages().getMessage()[0].getText();
                            }

                            const mappedError = this.errorMapper.getUserFriendlyError(errorMessage);
                            logger.error('Payment failed:', errorMessage);
                            resolve({
                                success: false,
                                message: mappedError.userMessage,
                                details: {
                                    errorCode: mappedError.errorCode,
                                    technicalDetails: mappedError.technicalDetails,
                                    originalMessage: mappedError.originalMessage
                                },
                                originalMessage: errorMessage
                            });
                        }
                    } catch (error) {
                        logger.error('Error in processPayment callback:', error);
                        reject(new Error('Error processing payment'));
                    }
                });
            });

        } catch (error) {
            logger.error('Error in processPayment:', error);
            throw error;
        }
    }

    async processPaymentFromProfile({ customerProfileId, customerPaymentProfileId, amount, planName }) {
        try {
            logger.info('Processing payment from customer profile:', {
                customerProfileId,
                customerPaymentProfileId,
                amount,
                planName
            });

            const merchantAuth = this.getMerchantAuthentication();

            // Create customer profile reference
            const profileToCharge = new APIContracts.CustomerProfilePaymentType();
            profileToCharge.setCustomerProfileId(customerProfileId);
            profileToCharge.setPaymentProfile(new APIContracts.PaymentProfile());
            profileToCharge.getPaymentProfile().setPaymentProfileId(customerPaymentProfileId);

            const paymentType = new APIContracts.PaymentType();
            paymentType.setProfile(profileToCharge);

            // Create order details
            const orderDetails = new APIContracts.OrderType();
            orderDetails.setInvoiceNumber(`INV-${Date.now()}`);
            orderDetails.setDescription(`${planName} Subscription - Renewal Payment`);

            // Create transaction request
            const transactionRequest = new APIContracts.TransactionRequestType();
            transactionRequest.setTransactionType(APIContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
            transactionRequest.setPayment(paymentType);
            transactionRequest.setAmount(parseFloat(amount));
            transactionRequest.setOrder(orderDetails);

            const createRequest = new APIContracts.CreateTransactionRequest();
            createRequest.setMerchantAuthentication(merchantAuth);
            createRequest.setTransactionRequest(transactionRequest);

            const ctrl = new APIControllers.CreateTransactionController(createRequest.getJSON());
            ctrl.setEnvironment(this.environment);

            return new Promise((resolve, reject) => {
                ctrl.execute(() => {
                    try {
                        const apiResponse = ctrl.getResponse();
                        const response = new APIContracts.CreateTransactionResponse(apiResponse);

                        logger.info('Profile payment response:', JSON.stringify(apiResponse, null, 2));

                        if (response != null && response.getMessages().getResultCode() === APIContracts.MessageTypeEnum.OK) {
                            if (response.getTransactionResponse().getMessages() != null) {
                                const transactionId = response.getTransactionResponse().getTransId();
                                const responseCode = response.getTransactionResponse().getResponseCode();

                                logger.info(`Profile payment successful: Transaction ID: ${transactionId}, Response Code: ${responseCode}`);

                                resolve({
                                    success: true,
                                    transactionId: transactionId,
                                    responseCode: responseCode,
                                    message: 'Payment processed successfully from profile'
                                });
                            } else {
                                const errors = response.getTransactionResponse().getErrors();
                                const errorMessage = errors ? errors.getError()[0].getErrorText() : 'Transaction failed';

                                logger.error('Profile payment failed:', errorMessage);
                                resolve({
                                    success: false,
                                    message: errorMessage
                                });
                            }
                        } else {
                            let errorMessage = 'Payment processing failed';
                            if (response.getTransactionResponse() && response.getTransactionResponse().getErrors()) {
                                errorMessage = response.getTransactionResponse().getErrors().getError()[0].getErrorText();
                            } else if (response.getMessages()) {
                                errorMessage = response.getMessages().getMessage()[0].getText();
                            }

                            const mappedError = this.errorMapper.getUserFriendlyError(errorMessage);
                            logger.error('Profile payment failed:', errorMessage);
                            resolve({
                                success: false,
                                message: mappedError.userMessage,
                                details: {
                                    errorCode: mappedError.errorCode,
                                    technicalDetails: mappedError.technicalDetails,
                                    originalMessage: mappedError.originalMessage
                                },
                                originalMessage: errorMessage
                            });
                        }
                    } catch (error) {
                        logger.error('Error in processPaymentFromProfile callback:', error);
                        reject(new Error('Error processing payment from profile'));
                    }
                });
            });

        } catch (error) {
            logger.error('Error in processPaymentFromProfile:', error);
            throw error;
        }
    }

    async createCustomerProfileFromTransaction(transactionId) {
        try {
            logger.info(`Creating customer profile from transaction: ${transactionId}`);

            const merchantAuth = this.getMerchantAuthentication();

            const createRequest = new APIContracts.CreateCustomerProfileFromTransactionRequest();
            createRequest.setTransId(transactionId);
            createRequest.setMerchantAuthentication(merchantAuth);

            const ctrl = new APIControllers.CreateCustomerProfileFromTransactionController(createRequest.getJSON());
            ctrl.setEnvironment(this.environment);

            return new Promise((resolve, reject) => {
                ctrl.execute(() => {
                    try {
                        const apiResponse = ctrl.getResponse();
                        const response = new APIContracts.CreateCustomerProfileResponse(apiResponse);

                        logger.info('Customer profile from transaction response:', JSON.stringify(apiResponse, null, 2));

                        if (response != null && response.getMessages().getResultCode() === APIContracts.MessageTypeEnum.OK) {
                            const customerProfileId = response.getCustomerProfileId();
                            const paymentProfileIds = response.getCustomerPaymentProfileIdList();
                            const shippingAddressIds = response.getCustomerShippingAddressIdList();

                            // Validate that we have the required profile IDs
                            if (!paymentProfileIds || !paymentProfileIds.getNumericString() || paymentProfileIds.getNumericString().length === 0) {
                                logger.error('No payment profile IDs returned from transaction profile creation');
                                resolve({
                                    success: false,
                                    message: 'Failed to create customer profile: No payment profile ID returned'
                                });
                                return;
                            }

                            if (!shippingAddressIds || !shippingAddressIds.getNumericString() || shippingAddressIds.getNumericString().length === 0) {
                                logger.error('No shipping address IDs returned from transaction profile creation');
                                resolve({
                                    success: false,
                                    message: 'Failed to create customer profile: No shipping address ID returned'
                                });
                                return;
                            }

                            const customerPaymentProfileId = paymentProfileIds.getNumericString()[0];
                            const customerAddressId = shippingAddressIds.getNumericString()[0];

                            logger.info(`Customer profile created from transaction: ${customerProfileId}, Payment Profile: ${customerPaymentProfileId}, Address: ${customerAddressId}`);

                            resolve({
                                success: true,
                                customerProfileId: customerProfileId,
                                customerPaymentProfileId: customerPaymentProfileId,
                                customerAddressId: customerAddressId
                            });
                        } else {
                            const message = response.getMessages().getMessage()[0];
                            const errorMessage = message.getText();
                            const errorCode = message.getCode();
                            const fullErrorText = errorCode ? `Code ${errorCode} - ${errorMessage}` : errorMessage;

                            logger.error(`Customer profile creation from transaction failed: ${fullErrorText}`);

                            const mappedError = this.errorMapper.getUserFriendlyError(fullErrorText);
                            resolve({
                                success: false,
                                message: mappedError.userMessage
                            });
                        }
                    } catch (error) {
                        logger.error('Error in createCustomerProfileFromTransaction callback:', error);
                        reject(new Error('Error creating customer profile from transaction'));
                    }
                });
            });

        } catch (error) {
            logger.error('Error in createCustomerProfileFromTransaction:', error);
            throw error;
        }
    }

    async getSubscription(subscriptionId) {
        try {
            const merchantAuth = this.getMerchantAuthentication();

            const getRequest = new APIContracts.ARBGetSubscriptionRequest();
            getRequest.setMerchantAuthentication(merchantAuth);
            getRequest.setSubscriptionId(subscriptionId);

            const ctrl = new APIControllers.ARBGetSubscriptionController(getRequest.getJSON());
            ctrl.setEnvironment(this.environment);

            return new Promise((resolve, reject) => {
                ctrl.execute(() => {
                    try {
                        const apiResponse = ctrl.getResponse();
                        const response = new APIContracts.ARBGetSubscriptionResponse(apiResponse);

                        if (response != null && response.getMessages().getResultCode() === APIContracts.MessageTypeEnum.OK) {
                            resolve({
                                success: true,
                                subscription: response.getSubscription()
                            });
                        } else {
                            const message = response.getMessages().getMessage()[0];
                            const errorMessage = message.getText();
                            const errorCode = message.getCode();
                            const fullErrorText = errorCode ? `Code ${errorCode} - ${errorMessage}` : errorMessage;

                            const mappedError = this.errorMapper.getUserFriendlyError(fullErrorText);
                            reject(new Error(mappedError.userMessage));
                        }
                    } catch (error) {
                        logger.error('Error in getSubscription callback:', error);
                        reject(new Error('Error retrieving subscription details'));
                    }
                });
            });

        } catch (error) {
            logger.error('Error getting subscription:', error);
            throw error;
        }
    }

    async createCustomerProfile(name, email, billingAddress, paymentDetails) {
        try {
            const merchantAuth = this.getMerchantAuthentication();

            // Create customer profile
            const customerProfile = new APIContracts.CustomerProfileType();
            // Generate unique merchantCustomerId that stays within Authorize.net's 20-char limit
            // Format: prefix (up to 8 chars) + timestamp in base36 (11 chars)
            const prefix = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
            const timestamp = Date.now().toString(36);
            const merchantId = `${prefix}_${timestamp}`.substring(0, 20);
            customerProfile.setMerchantCustomerId(merchantId);
            customerProfile.setEmail(email);

            // Create payment profile with credit card
            const creditCard = this.createCreditCard(
                paymentDetails.cardNumber,
                paymentDetails.expiryDate,
                paymentDetails.cardCode
            );

            const payment = new APIContracts.PaymentType();
            payment.setCreditCard(creditCard);

            const customerPaymentProfile = new APIContracts.CustomerPaymentProfileType();
            customerPaymentProfile.setCustomerType(APIContracts.CustomerTypeEnum.INDIVIDUAL);
            customerPaymentProfile.setPayment(payment);

            // Add billing address to payment profile
            const billTo = this.createBillingAddress(name, billingAddress);
            customerPaymentProfile.setBillTo(billTo);

            customerProfile.setPaymentProfiles([customerPaymentProfile]);

            // Create customer address profile
            const customerAddress = new APIContracts.CustomerAddressType();
            const nameParts = name.split(' ');
            customerAddress.setFirstName(nameParts[0] || 'First');
            customerAddress.setLastName(nameParts.slice(1).join(' ') || 'Last');
            customerAddress.setAddress(billingAddress.addressLine1);
            if (billingAddress.addressLine2) {
                customerAddress.setAddress(billingAddress.addressLine1 + ' ' + billingAddress.addressLine2);
            }
            customerAddress.setCity(billingAddress.city);
            customerAddress.setState(billingAddress.state);
            customerAddress.setZip(billingAddress.zipCode);
            customerAddress.setCountry(billingAddress.country);
            if (billingAddress.phoneNumber) {
                customerAddress.setPhoneNumber(billingAddress.phoneNumber);
            }

            customerProfile.setShipToList([customerAddress]);

            const createRequest = new APIContracts.CreateCustomerProfileRequest();
            createRequest.setMerchantAuthentication(merchantAuth);
            createRequest.setProfile(customerProfile);
            createRequest.setValidationMode(APIContracts.ValidationModeEnum.LIVEMODE);

            const ctrl = new APIControllers.CreateCustomerProfileController(createRequest.getJSON());
            ctrl.setEnvironment(this.environment);

            return new Promise((resolve, reject) => {
                ctrl.execute(() => {
                    try {
                        const apiResponse = ctrl.getResponse();
                        const response = new APIContracts.CreateCustomerProfileResponse(apiResponse);

                        logger.info('Customer profile creation response:', JSON.stringify(apiResponse, null, 2));

                        if (response != null && response.getMessages().getResultCode() === APIContracts.MessageTypeEnum.OK) {
                            const customerProfileId = response.getCustomerProfileId();
                            const paymentProfileIds = response.getCustomerPaymentProfileIdList();
                            const shippingAddressIds = response.getCustomerShippingAddressIdList();

                            // Validate that we have the required profile IDs
                            if (!paymentProfileIds || !paymentProfileIds.getNumericString() || paymentProfileIds.getNumericString().length === 0) {
                                logger.error('No payment profile IDs returned from profile creation');
                                reject(new Error('Failed to create customer profile: No payment profile ID returned'));
                                return;
                            }

                            if (!shippingAddressIds || !shippingAddressIds.getNumericString() || shippingAddressIds.getNumericString().length === 0) {
                                logger.error('No shipping address IDs returned from profile creation');
                                reject(new Error('Failed to create customer profile: No shipping address ID returned'));
                                return;
                            }

                            const customerPaymentProfileId = paymentProfileIds.getNumericString()[0];
                            const customerAddressId = shippingAddressIds.getNumericString()[0];

                            logger.info(`Customer profile created successfully: ${customerProfileId}, Payment Profile: ${customerPaymentProfileId}, Address: ${customerAddressId}`);
                            resolve({
                                success: true,
                                customerProfileId: customerProfileId,
                                customerPaymentProfileId: customerPaymentProfileId,
                                customerAddressId: customerAddressId
                            });
                        } else {
                            const message = response.getMessages().getMessage()[0];
                            const errorMessage = message.getText();
                            const errorCode = message.getCode();
                            const fullErrorText = errorCode ? `Code ${errorCode} - ${errorMessage}` : errorMessage;

                            logger.error(`Customer profile creation failed: ${fullErrorText}`);

                            const mappedError = this.errorMapper.getUserFriendlyError(fullErrorText);
                            reject(new Error(mappedError.userMessage));
                        }
                    } catch (error) {
                        logger.error('Error in createCustomerProfile callback:', error);
                        reject(new Error('Error creating customer profile'));
                    }
                });
            });

        } catch (error) {
            logger.error('Error creating customer profile:', error);
            throw error;
        }
    }

    async updateCustomerPaymentProfile(customerProfileId, customerPaymentProfileId, paymentDetails, billingAddress) {
        const { cardNumber, expiryDate, cardCode } = paymentDetails;

        try {
            logger.info(`Updating payment profile ${customerPaymentProfileId} for customer ${customerProfileId}`);

            const merchantAuth = this.getMerchantAuthentication();
            const creditCard = new APIContracts.CreditCardType();
            creditCard.setCardNumber(cardNumber);
            creditCard.setExpirationDate(expiryDate);
            creditCard.setCardCode(cardCode);

            const paymentType = new APIContracts.PaymentType();
            paymentType.setCreditCard(creditCard);

            const paymentProfile = new APIContracts.CustomerPaymentProfileExType();
            paymentProfile.setCustomerPaymentProfileId(customerPaymentProfileId);
            paymentProfile.setPayment(paymentType);

            if (billingAddress) {
                const customerAddress = new APIContracts.CustomerAddressType();
                customerAddress.setFirstName(billingAddress.firstName || '');
                customerAddress.setLastName(billingAddress.lastName || '');
                customerAddress.setAddress(billingAddress.address || '');
                customerAddress.setCity(billingAddress.city || '');
                customerAddress.setState(billingAddress.state || '');
                customerAddress.setZip(billingAddress.zip || '');
                customerAddress.setCountry(billingAddress.country || 'US');
                paymentProfile.setBillTo(customerAddress);
            }

            const updateRequest = new APIContracts.UpdateCustomerPaymentProfileRequest();
            updateRequest.setMerchantAuthentication(merchantAuth);
            updateRequest.setCustomerProfileId(customerProfileId);
            updateRequest.setPaymentProfile(paymentProfile);

            const ctrl = new APIControllers.UpdateCustomerPaymentProfileController(updateRequest.getJSON());

            return new Promise((resolve, reject) => {
                ctrl.execute(() => {
                    const apiResponse = ctrl.getResponse();
                    const response = new APIContracts.UpdateCustomerPaymentProfileResponse(apiResponse);

                    if (response.getMessages().getResultCode() === APIContracts.MessageTypeEnum.OK) {
                        logger.info('Customer payment profile updated successfully');
                        resolve({ success: true });
                    } else {
                        const message = response.getMessages().getMessage()[0];
                        const errorMessage = message.getText();
                        logger.error(`Payment profile update failed: ${errorMessage}`);
                        reject(new Error(`Failed to update payment profile: ${errorMessage}`));
                    }
                });
            });

        } catch (error) {
            logger.error('Error updating customer payment profile:', error);
            throw error;
        }
    }

    async createSubscriptionFromProfile(profileData) {
        const { customerProfileId, customerPaymentProfileId, customerAddressId, planName, planPrice, startDate } = profileData;

        try {
            logger.info(`Creating subscription from profile: ${customerProfileId}, paymentProfile: ${customerPaymentProfileId}, address: ${customerAddressId}`);

            const merchantAuth = this.getMerchantAuthentication();
            const paymentSchedule = this.createPaymentSchedule(planPrice, startDate);

            // Create customer profile reference
            const customerProfileIdType = new APIContracts.CustomerProfileIdType();
            customerProfileIdType.setCustomerProfileId(customerProfileId);
            customerProfileIdType.setCustomerPaymentProfileId(customerPaymentProfileId);
            customerProfileIdType.setCustomerAddressId(customerAddressId);

            const arbSubscription = new APIContracts.ARBSubscriptionType();
            arbSubscription.setName(planName);
            arbSubscription.setPaymentSchedule(paymentSchedule);
            arbSubscription.setAmount(parseFloat(planPrice));
            arbSubscription.setProfile(customerProfileIdType);

            const createRequest = new APIContracts.ARBCreateSubscriptionRequest();
            createRequest.setMerchantAuthentication(merchantAuth);
            createRequest.setSubscription(arbSubscription);

            logger.info('Subscription request payload:', JSON.stringify(createRequest.getJSON(), null, 2));

            const ctrl = new APIControllers.ARBCreateSubscriptionController(createRequest.getJSON());
            ctrl.setEnvironment(this.environment);

            return new Promise((resolve, reject) => {
                ctrl.execute(() => {
                    try {
                        const apiResponse = ctrl.getResponse();
                        const response = new APIContracts.ARBCreateSubscriptionResponse(apiResponse);

                        logger.info('Subscription creation response:', JSON.stringify(apiResponse, null, 2));

                        if (response != null && response.getMessages().getResultCode() === APIContracts.MessageTypeEnum.OK) {
                            const subscriptionId = response.getSubscriptionId();
                            logger.info(`Subscription created from profile: ${subscriptionId}`);
                            resolve({
                                success: true,
                                subscriptionId: subscriptionId
                            });
                        } else {
                            const message = response.getMessages().getMessage()[0];
                            const errorMessage = message.getText();
                            const errorCode = message.getCode();
                            const fullErrorText = errorCode ? `Code ${errorCode} - ${errorMessage}` : errorMessage;

                            logger.error(`Subscription creation from profile failed: ${fullErrorText}`);

                            // Check for specific error codes that might indicate timing issues
                            if (errorCode === 'E00040' || errorMessage.includes('record cannot be found')) {
                                logger.info('Attempting subscription creation with retry after profile propagation delay...');
                                // Wait a bit longer and try once more
                                setTimeout(() => {
                                    this.retrySubscriptionCreation(profileData, resolve, reject, 1);
                                }, 5000); // Increased delay to 5 seconds
                            } else {
                                const mappedError = this.errorMapper.getUserFriendlyError(fullErrorText);
                                reject(new Error(mappedError.userMessage));
                            }
                        }
                    } catch (error) {
                        logger.error('Error in createSubscriptionFromProfile callback:', error);
                        reject(new Error('Error creating subscription from profile'));
                    }
                });
            });

        } catch (error) {
            logger.error('Error creating subscription from profile:', error);
            throw error;
        }
    }

        async retrySubscriptionCreation(profileData, resolve, reject, attemptNumber = 1) {
        const { customerProfileId, customerPaymentProfileId, customerAddressId, planName, planPrice, startDate } = profileData;
        const maxRetries = 3;

        try {
            logger.info(`Retrying subscription creation after delay (attempt ${attemptNumber})...`);

            const merchantAuth = this.getMerchantAuthentication();
            const paymentSchedule = this.createPaymentSchedule(planPrice, startDate);

            const customerProfileIdType = new APIContracts.CustomerProfileIdType();
            customerProfileIdType.setCustomerProfileId(customerProfileId);
            customerProfileIdType.setCustomerPaymentProfileId(customerPaymentProfileId);
            customerProfileIdType.setCustomerAddressId(customerAddressId);

            const arbSubscription = new APIContracts.ARBSubscriptionType();
            arbSubscription.setName(planName);
            arbSubscription.setPaymentSchedule(paymentSchedule);
            arbSubscription.setAmount(parseFloat(planPrice));
            arbSubscription.setProfile(customerProfileIdType);

            const createRequest = new APIContracts.ARBCreateSubscriptionRequest();
            createRequest.setMerchantAuthentication(merchantAuth);
            createRequest.setSubscription(arbSubscription);

            const ctrl = new APIControllers.ARBCreateSubscriptionController(createRequest.getJSON());
            ctrl.setEnvironment(this.environment);

            ctrl.execute(() => {
                try {
                    const apiResponse = ctrl.getResponse();
                    const response = new APIContracts.ARBCreateSubscriptionResponse(apiResponse);

                    if (response != null && response.getMessages().getResultCode() === APIContracts.MessageTypeEnum.OK) {
                        const subscriptionId = response.getSubscriptionId();
                        logger.info(`Subscription created from profile on retry attempt ${attemptNumber}: ${subscriptionId}`);
                        resolve({
                            success: true,
                            subscriptionId: subscriptionId
                        });
                    } else {
                        const message = response.getMessages().getMessage()[0];
                        const errorMessage = message.getText();
                        const errorCode = message.getCode();

                        const fullErrorText = errorCode ? `Code ${errorCode} - ${errorMessage}` : errorMessage;
                        logger.error(`Subscription creation retry ${attemptNumber} failed: ${fullErrorText}`);

                        // Check if we should retry again
                        if (attemptNumber < maxRetries && (errorCode === 'E00040' || errorMessage.includes('record cannot be found'))) {
                            logger.info(`First retry failed with timing issue, attempting second retry...`);
                            setTimeout(() => {
                                this.retrySubscriptionCreation(profileData, resolve, reject, attemptNumber + 1);
                            }, 5000); // Wait 5 more seconds for next retry
                        } else {
                            const mappedError = this.errorMapper.getUserFriendlyError(fullErrorText);
                            reject(new Error(mappedError.userMessage));
                        }
                    }
                } catch (error) {
                    logger.error(`Error in retry ${attemptNumber} callback:`, error);

                    if (attemptNumber < maxRetries) {
                        setTimeout(() => {
                            this.retrySubscriptionCreation(profileData, resolve, reject, attemptNumber + 1);
                        }, 5000);
                    } else {
                        reject(new Error(`Error creating subscription from profile after ${attemptNumber} retries`));
                    }
                }
            });

        } catch (error) {
            logger.error(`Error in retry ${attemptNumber} subscription creation:`, error);

            if (attemptNumber < maxRetries) {
                setTimeout(() => {
                    this.retrySubscriptionCreation(profileData, resolve, reject, attemptNumber + 1);
                }, 5000);
            } else {
                reject(new Error(`Error in retry subscription creation after ${attemptNumber} attempts`));
            }
        }
    }

    async updateCustomerPaymentProfile(customerProfileId, customerPaymentProfileId, paymentDetails) {
        try {
            const merchantAuth = this.getMerchantAuthentication();

            // Create updated credit card
            const creditCard = this.createCreditCard(
                paymentDetails.cardNumber,
                paymentDetails.expiryDate,
                paymentDetails.cardCode
            );

            const payment = new APIContracts.PaymentType();
            payment.setCreditCard(creditCard);

            const customerPaymentProfile = new APIContracts.CustomerPaymentProfileExType();
            customerPaymentProfile.setCustomerPaymentProfileId(customerPaymentProfileId);
            customerPaymentProfile.setPayment(payment);

            const updateRequest = new APIContracts.UpdateCustomerPaymentProfileRequest();
            updateRequest.setMerchantAuthentication(merchantAuth);
            updateRequest.setCustomerProfileId(customerProfileId);
            updateRequest.setPaymentProfile(customerPaymentProfile);
            updateRequest.setValidationMode(APIContracts.ValidationModeEnum.LIVEMODE);

            const ctrl = new APIControllers.UpdateCustomerPaymentProfileController(updateRequest.getJSON());
            ctrl.setEnvironment(this.environment);

            return new Promise((resolve, reject) => {
                ctrl.execute(() => {
                    try {
                        const apiResponse = ctrl.getResponse();
                        const response = new APIContracts.UpdateCustomerPaymentProfileResponse(apiResponse);

                        if (response != null && response.getMessages().getResultCode() === APIContracts.MessageTypeEnum.OK) {
                            logger.info(`Customer payment profile ${customerPaymentProfileId} updated successfully`);
                            resolve({
                                success: true,
                                message: 'Payment profile updated successfully'
                            });
                        } else {
                            const message = response.getMessages().getMessage()[0];
                            const errorMessage = message.getText();
                            const errorCode = message.getCode();
                            const fullErrorText = errorCode ? `Code ${errorCode} - ${errorMessage}` : errorMessage;

                            logger.error(`Payment profile update failed: ${fullErrorText}`);

                            const mappedError = this.errorMapper.getUserFriendlyError(fullErrorText);
                            resolve({
                                success: false,
                                message: mappedError.userMessage,
                                details: {
                                    errorCode: mappedError.errorCode,
                                    technicalDetails: mappedError.technicalDetails,
                                    originalMessage: mappedError.originalMessage
                                },
                                originalMessage: fullErrorText
                            });
                        }
                    } catch (error) {
                        logger.error('Error in updateCustomerPaymentProfile callback:', error);
                        reject(new Error('Error updating payment profile'));
                    }
                });
            });

        } catch (error) {
            logger.error('Error updating customer payment profile:', error);
            throw error;
        }
    }

    async cancelSubscription(subscriptionId) {
        try {
            const merchantAuth = this.getMerchantAuthentication();

            const cancelRequest = new APIContracts.ARBCancelSubscriptionRequest();
            cancelRequest.setMerchantAuthentication(merchantAuth);
            cancelRequest.setSubscriptionId(subscriptionId);

            const ctrl = new APIControllers.ARBCancelSubscriptionController(cancelRequest.getJSON());
            ctrl.setEnvironment(this.environment);

            return new Promise((resolve, reject) => {
                ctrl.execute(() => {
                    try {
                        const apiResponse = ctrl.getResponse();
                        const response = new APIContracts.ARBCancelSubscriptionResponse(apiResponse);

                        if (response != null && response.getMessages().getResultCode() === APIContracts.MessageTypeEnum.OK) {
                            logger.info(`Subscription ${subscriptionId} cancelled successfully`);
                            resolve({
                                success: true,
                                message: 'Subscription cancelled successfully'
                            });
                        } else {
                            const message = response.getMessages().getMessage()[0];
                            const errorMessage = message.getText();
                            const errorCode = message.getCode();
                            const fullErrorText = errorCode ? `Code ${errorCode} - ${errorMessage}` : errorMessage;

                            const mappedError = this.errorMapper.getUserFriendlyError(fullErrorText);
                            reject(new Error(mappedError.userMessage));
                        }
                    } catch (error) {
                        logger.error('Error in cancelSubscription callback:', error);
                        reject(new Error('Error cancelling subscription'));
                    }
                });
            });

        } catch (error) {
            logger.error('Error cancelling subscription:', error);
            throw error;
        }
    }
}

module.exports = PaymentService;