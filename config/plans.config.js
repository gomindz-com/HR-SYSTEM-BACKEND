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
    features: [
      "attendance",
      "leave",
      "basic_reports",
      "payroll_and_payslip_automation",
      "benefits_and_tax_configuration",
      "reports",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    price: 200, // 200 GMD per user per month
    maxEmployees: null,
    features: [
      "attendance",
      "leave",
      "basic_reports",
      "payroll_and_payslip_automation",
      "benefits_and_tax_configuration",
      "reports",
      "performance",
      "recruitment_and_onboarding",
      "advanced_analytics_dashboard",
      "staff_document_upload",
    ],
  },
};

export const FEATURE_DEFINITIONS = {
  attendance: "Attendance Tracking",
  leave: "Leave Management",
  basic_reports: "Basic Reports",
  payroll_and_payslip_automation: "Payroll & Payslip Automation",
  benefits_and_tax_configuration: "Benefits & Tax Configuration",
  reports: "Advanced Reports",
  performance: "Performance Reviews",
  recruitment_and_onboarding: "Recruitment & Onboarding",
  advanced_analytics_dashboard: "Advanced Analytics Dashboard",
  staff_document_upload: "Staff Document Upload",
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
