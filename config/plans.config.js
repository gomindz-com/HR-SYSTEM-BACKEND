
export const SUBSCRIPTION_PLANS = {
  basic: {
    id: "basic",
    name: "Basic",
    price: 75, // 75 GMD per user per month
    maxEmployees: null,
    features: ["attendance", "leave", "basic_reports"],
  },
  pro: {
    id: "pro",
    name: "Professional",
    price: 150, // 150 GMD per user per month
    maxEmployees: null,
    features: ["attendance", "leave", "payroll", "reports", "performance"],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    price: 200, // 200 GMD per user per month
    maxEmployees: null, 
    features: [
      "attendance",
      "leave",
      "payroll",
      "reports",
      "performance",
      "analytics",
      "api_access",
      "custom_integrations",
    ],
  },
};

export const FEATURE_DEFINITIONS = {
  attendance: "Attendance Tracking",
  leave: "Leave Management",
  basic_reports: "Basic Reports",
  payroll: "Payroll Processing",
  reports: "Advanced Reports",
  performance: "Performance Reviews",
  analytics: "Analytics",
  api_access: "API Access",
  custom_integrations: "Custom Integrations",
};

// Currency configuration for display (what users see)
export const DISPLAY_CURRENCY = {
  code: "USD",
  symbol: "$",
  name: "United States Dollar",
  decimalPlaces: 2,
};

// Currency configuration for payment processing (what Modem Pay requires)
export const PAYMENT_CURRENCY = {
  code: "GMD",
  symbol: "D",
  name: "Gambian Dalasi",
  decimalPlaces: 0,
};

// Conversion rate: 1 USD = X GMD
// Adjust this rate based on current exchange rates
export const USD_TO_GMD_RATE = 74; // 1 USD ≈ 74 GMD           TODO: USE LIVE RATE CONVERTER FROM ExchangeRate-API.io WHEN EVERYTHING IS READY

// Legacy export for backward compatibility
export const CURRENCY_CONFIG = DISPLAY_CURRENCY;
