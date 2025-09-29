export const SUBSCRIPTION_PLANS = {
  basic: {
    id: "basic",
    name: "Basic",
    price: 1500.0, // GMD 1,500 per month
    maxEmployees: 10,
    features: ["attendance", "leave", "basic_reports"],
  },
  pro: {
    id: "pro",
    name: "Professional",
    price: 4000.0, // GMD 4,000 per month
    maxEmployees: 50,
    features: ["attendance", "leave", "payroll", "reports", "performance"],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    price: 10000.0, // GMD 10,000 per month
    maxEmployees: null, // unlimited
    features: [
      "attendance",
      "leave",
      "payroll",
      "reports",
      "performance",
      "api_access",
      "custom_integrations",
    ],
  },
};

export const FEATURE_DEFINITIONS = {
  attendance: "Attendance Tracking",
  leave: "Leave Management",
  payroll: "Payroll Processing",
  reports: "Advanced Reports",
  performance: "Performance Reviews",
  api_access: "API Access",
  custom_integrations: "Custom Integrations",
};

// Currency configuration for The Gambia
export const CURRENCY_CONFIG = {
  code: "GMD",
  symbol: "D",
  name: "Gambian Dalasi",
  decimalPlaces: 0, // GMD doesn't use decimal places
};
