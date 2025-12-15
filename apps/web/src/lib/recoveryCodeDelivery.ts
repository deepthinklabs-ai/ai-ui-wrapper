/**
 * Recovery Code Delivery Utilities
 *
 * Provides functions to deliver recovery codes to users:
 * - PDF download
 * - Print
 * - Copy to clipboard
 * - Email (enterprise feature - placeholder)
 */

/**
 * Generate and download a PDF with recovery codes
 */
export async function generateRecoveryCodesPDF(
  codes: string[],
  userEmail?: string
): Promise<void> {
  // Create a printable HTML document
  const html = generateRecoveryCodesHTML(codes, userEmail);

  // Create a blob and download
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  // Create a hidden iframe to generate the PDF
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';

  document.body.appendChild(iframe);

  iframe.contentDocument?.write(html);
  iframe.contentDocument?.close();

  // Wait for content to load
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Trigger print to PDF (user can choose to save as PDF)
  iframe.contentWindow?.print();

  // Clean up
  setTimeout(() => {
    document.body.removeChild(iframe);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Print recovery codes directly
 */
export async function printRecoveryCodes(
  codes: string[],
  userEmail?: string
): Promise<void> {
  const html = generateRecoveryCodesHTML(codes, userEmail);

  // Open print in new window
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Could not open print window. Please check your popup blocker.');
  }

  printWindow.document.write(html);
  printWindow.document.close();

  // Wait for content to load
  await new Promise((resolve) => setTimeout(resolve, 500));

  printWindow.print();

  // Close the window after printing
  printWindow.onafterprint = () => {
    printWindow.close();
  };
}

/**
 * Generate HTML for recovery codes document
 */
function generateRecoveryCodesHTML(codes: string[], userEmail?: string): string {
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Recovery Codes - Chatbot</title>
  <style>
    @page {
      size: letter;
      margin: 1in;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }

    .header {
      text-align: center;
      border-bottom: 2px solid #e5e5e5;
      padding-bottom: 24px;
      margin-bottom: 32px;
    }

    .logo {
      font-size: 24px;
      font-weight: 700;
      color: #059669;
      margin-bottom: 8px;
    }

    .title {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .subtitle {
      color: #666;
      font-size: 14px;
    }

    .warning-box {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }

    .warning-title {
      font-weight: 600;
      color: #92400e;
      margin-bottom: 8px;
    }

    .warning-text {
      font-size: 14px;
      color: #78350f;
    }

    .codes-section {
      margin-bottom: 32px;
    }

    .codes-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
    }

    .codes-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }

    .code-item {
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 12px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      text-align: center;
    }

    .code-number {
      color: #6b7280;
      font-size: 12px;
      margin-right: 8px;
    }

    .instructions {
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }

    .instructions-title {
      font-weight: 600;
      color: #166534;
      margin-bottom: 12px;
    }

    .instructions-list {
      list-style: none;
      font-size: 14px;
    }

    .instructions-list li {
      padding: 4px 0;
      padding-left: 24px;
      position: relative;
    }

    .instructions-list li::before {
      content: "\\2713";
      position: absolute;
      left: 0;
      color: #22c55e;
      font-weight: bold;
    }

    .footer {
      border-top: 1px solid #e5e5e5;
      padding-top: 24px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
    }

    .meta {
      margin-bottom: 8px;
    }

    @media print {
      body {
        padding: 0;
      }

      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Chatbot</div>
    <h1 class="title">Recovery Codes</h1>
    <p class="subtitle">Keep this document in a safe place</p>
  </div>

  <div class="warning-box">
    <div class="warning-title">Important Security Information</div>
    <p class="warning-text">
      These recovery codes are the ONLY way to recover access to your encrypted messages if you forget your encryption password.
      Each code can only be used once. Store this document securely - treat it like a password.
    </p>
  </div>

  <div class="codes-section">
    <h2 class="codes-title">Your Recovery Codes</h2>
    <div class="codes-grid">
      ${codes.map((code, index) => `
        <div class="code-item">
          <span class="code-number">${index + 1}.</span>${code}
        </div>
      `).join('')}
    </div>
  </div>

  <div class="instructions">
    <div class="instructions-title">How to use these codes:</div>
    <ul class="instructions-list">
      <li>Use a recovery code when you forget your encryption password</li>
      <li>Each code can only be used once - cross it off after use</li>
      <li>When you're down to 2-3 codes, generate new ones from settings</li>
      <li>Store this document in a safe, locked location</li>
      <li>Consider keeping a digital copy in a password manager</li>
    </ul>
  </div>

  <div class="footer">
    <p class="meta">Generated: ${date}${userEmail ? ` | Account: ${userEmail}` : ''}</p>
    <p>
      <strong>Zero-Knowledge Encryption:</strong> These codes are the only way to recover your messages.
      The service provider cannot access your encrypted content.
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Copy recovery codes to clipboard (formatted)
 */
export async function copyRecoveryCodesToClipboard(codes: string[]): Promise<void> {
  const formatted = codes.map((code, i) => `${i + 1}. ${code}`).join('\n');
  const text = `Chatbot - Recovery Codes
Generated: ${new Date().toLocaleDateString()}

${formatted}

IMPORTANT: Keep these codes safe. Each can only be used once.
`;

  await navigator.clipboard.writeText(text);
}

/**
 * Send recovery codes via email (enterprise feature - placeholder)
 */
export async function emailRecoveryCodes(
  codes: string[],
  toEmail: string,
  adminEmail?: string
): Promise<void> {
  // This would call an API endpoint to send the email
  // For now, this is a placeholder for the enterprise feature
  throw new Error('Email delivery is an enterprise feature. Coming soon!');
}
