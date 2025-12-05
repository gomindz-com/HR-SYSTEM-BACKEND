import puppeteer from "puppeteer-core";

/**
 * Format date to readable string
 */
const formatDate = (date) => {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/**
 * Format number with commas and 2 decimal places
 */
const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return "0.00";
  return Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Generate employee ID from prisma ID if not available
 */
const generateEmployeeId = (employee) => {
  if (employee.employeeId) return employee.employeeId;
  // Generate ID like "EMP-001", "EMP-023", etc.
  return `EMP-${String(employee.id).padStart(3, "0")}`;
};

/**
 * Generate HTML template for payslip (matches professional template design)
 */
const generatePayslipHTML = (payrollData, employee, company) => {
  const currentDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const formatDateLong = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            color: #000;
            line-height: 1.5;
            padding: 60px 80px;
            background: white;
          }
          
          .payslip-container {
            max-width: 800px;
            margin: 0 auto;
          }
          
          /* Header Section */
          .header {
            display: flex;
            align-items: center;
            gap: 20px;
            margin-bottom: 10px;
          }
          
          .logo {
            width: 60px;
            height: 60px;
            background: #000;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 24px;
            flex-shrink: 0;
          }
          
          .header-text h1 {
            font-size: 11px;
            font-weight: 400;
            color: #666;
            margin-bottom: 2px;
            letter-spacing: 1px;
          }
          
          .header-text h2 {
            font-size: 32px;
            font-weight: 700;
            color: #000;
            margin-bottom: 2px;
            letter-spacing: -0.5px;
          }
          
          .header-text p {
            font-size: 11px;
            color: #666;
          }
          
          /* Title Section */
          .title-section {
            text-align: center;
            margin: 35px 0 25px;
          }
          
          .title-section h3 {
            font-size: 28px;
            font-weight: 600;
            color: #000;
          }
          
          /* Date Section */
          .date-section {
            display: flex;
            justify-content: center;
            gap: 40px;
            margin-bottom: 12px;
            font-size: 13px;
          }
          
          .date-section div {
            display: flex;
            gap: 8px;
          }
          
          .date-section strong {
            font-weight: 600;
          }
          
          .pay-date {
            text-align: center;
            font-size: 13px;
            margin-bottom: 25px;
          }
          
          .pay-date strong {
            font-weight: 600;
          }
          
          /* Employee Info */
          .employee-info {
            margin-bottom: 25px;
          }
          
          .employee-info div {
            display: flex;
            gap: 8px;
            font-size: 13px;
            margin-bottom: 6px;
          }
          
          .employee-info strong {
            font-weight: 600;
            min-width: 130px;
          }
          
          /* Tables */
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          
          th {
            background: #f0f0f0;
            padding: 10px 14px;
            text-align: left;
            font-weight: 600;
            font-size: 13px;
            color: #666;
            border: 1px solid #ddd;
          }
          
          td {
            padding: 10px 14px;
            border: 1px solid #ddd;
            font-size: 13px;
          }
          
          .amount {
            text-align: right;
          }
          
          tr.total-row {
            font-weight: 600;
          }
          
          tr.total-row td {
            background: #fafafa;
          }
          
          /* Net Pay Box */
          .net-pay-box {
            border: 2px solid #000;
            padding: 16px 20px;
            margin-top: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          
          .net-pay-box strong {
            font-size: 15px;
            font-weight: 600;
          }
          
          .net-pay-box .amount {
            font-size: 15px;
            font-weight: 600;
          }
          
          /* Signature Section */
          .signature-section {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
          }
          
          .signature-box {
            display: flex;
            justify-content: flex-end;
            margin-top: 15px;
          }
          
          .signature-box div {
            width: 250px;
          }
          
          .signature-line {
            border-top: 1px solid #000;
            margin-bottom: 5px;
            padding-top: 40px;
          }
          
          .signature-label {
            font-size: 12px;
            color: #666;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="payslip-container">
          <!-- Header -->
          <div class="header">
            <div class="logo">${(company.companyName || "C").charAt(0).toUpperCase()}</div>
            <div class="header-text">
              <h1>${company.companyName || "COMPANY NAME"}</h1>
              <h2>PAYSLIP</h2>
              <p>${company.companyEmail || "contact@company.com"}${company.companyAddress ? ` | ${company.companyAddress}` : ""}</p>
            </div>
          </div>
          
          <!-- Title -->
          <div class="title-section">
            <h3>Payslip for ${employee.position || "Employee"}</h3>
          </div>
          
          <!-- Dates -->
          <div class="date-section">
            <div>
              <strong>Start Date:</strong>
              <span>${formatDateLong(payrollData.periodStart)}</span>
            </div>
            <div>
              <strong>End Date:</strong>
              <span>${formatDateLong(payrollData.periodEnd)}</span>
            </div>
          </div>
          
          <div class="pay-date">
            <strong>Pay Date:</strong> ${formatDateLong(payrollData.finalizedAt || new Date())}
          </div>
          
          <!-- Employee Info -->
          <div class="employee-info">
            <div>
              <strong>Employee Name:</strong>
              <span>${employee.name}</span>
            </div>
            <div>
              <strong>Employee ID:</strong>
              <span>${generateEmployeeId(employee)}</span>
            </div>
          </div>
          
          <!-- Earnings Table -->
          <table>
            <thead>
              <tr>
                <th>Earnings</th>
                <th class="amount">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Base Salary</td>
                <td class="amount">${formatCurrency(payrollData.baseSalary)} GMD</td>
              </tr>
              ${
                payrollData.bonuses && payrollData.bonuses > 0
                  ? `
              <tr>
                <td>Bonuses</td>
                <td class="amount">${formatCurrency(payrollData.bonuses)} GMD</td>
              </tr>
              `
                  : ""
              }
              ${
                payrollData.benefitsCost && payrollData.benefitsCost > 0
                  ? `
              <tr>
                <td>Benefits</td>
                <td class="amount">${formatCurrency(payrollData.benefitsCost)} GMD</td>
              </tr>
              `
                  : ""
              }
              ${
                payrollData.hoursWorked
                  ? `
              <tr>
                <td>Hours Worked</td>
                <td class="amount">${payrollData.hoursWorked} hrs</td>
              </tr>
              `
                  : ""
              }
              <tr class="total-row">
                <td>Gross Salary</td>
                <td class="amount">${formatCurrency(payrollData.grossPay)} GMD</td>
              </tr>
            </tbody>
          </table>
          
          <!-- Deductions Table -->
          <table>
            <thead>
              <tr>
                <th>Deductions</th>
                <th class="amount">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${
                payrollData.incomeTax && payrollData.incomeTax > 0
                  ? `
              <tr>
                <td>Taxes</td>
                <td class="amount">${formatCurrency(payrollData.incomeTax)} GMD</td>
              </tr>
              `
                  : `
              <tr>
                <td>Taxes</td>
                <td class="amount">0.00 GMD</td>
              </tr>
              `
              }
              ${
                payrollData.attendancePenalties &&
                payrollData.attendancePenalties > 0
                  ? `
              <tr>
                <td>Late Penalties</td>
                <td class="amount">${formatCurrency(payrollData.attendancePenalties)} GMD</td>
              </tr>
              `
                  : `
              <tr>
                <td>Late Penalties</td>
                <td class="amount">0.00 GMD</td>
              </tr>
              `
              }
              ${
                payrollData.socialSecurity && payrollData.socialSecurity > 0
                  ? `
              <tr>
                <td>Social Security</td>
                <td class="amount">${formatCurrency(payrollData.socialSecurity)} GMD</td>
              </tr>
              `
                  : `
              <tr>
                <td>Insurances</td>
                <td class="amount">0.00 GMD</td>
              </tr>
              `
              }
              <tr class="total-row">
                <td>Total Deductions</td>
                <td class="amount">${formatCurrency(payrollData.totalDeductions)} GMD</td>
              </tr>
            </tbody>
          </table>
          
          <!-- Net Pay -->
          <div class="net-pay-box">
            <strong>Net Pay</strong>
            <span class="amount">${formatCurrency(payrollData.netPay)} GMD</span>
          </div>
          
          <!-- Signature Section -->
          <div class="signature-section">
            <div class="signature-box">
              <div>
                <div class="signature-line"></div>
                <div class="signature-label">Employee Signature</div>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};

/**
 * Generate PDF payslip using Puppeteer
 * @param {Object} payrollData - Payroll record data
 * @param {Object} employee - Employee data
 * @param {Object} company - Company data
 * @returns {Promise<Buffer>} PDF buffer
 */
export const generatePayslipPDF = async (payrollData, employee, company) => {
  let browser = null;

  try {
    // Generate HTML content
    const htmlContent = generatePayslipHTML(payrollData, employee, company);

    // Launch browser with appropriate settings
    const launchOptions = {
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
      ],
      headless: true,
    };

    // Use executable path from env if available
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    // Set content and wait for it to load
    await page.setContent(htmlContent, {
      waitUntil: "networkidle0",
    });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "0px",
        right: "0px",
        bottom: "0px",
        left: "0px",
      },
    });

    await browser.close();

    return pdfBuffer;
  } catch (error) {
    console.error("❌ Error generating payslip PDF:", error);

    // Clean up browser if it was opened
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error("Error closing browser:", closeError);
      }
    }

    throw new Error(`Failed to generate payslip PDF: ${error.message}`);
  }
};
