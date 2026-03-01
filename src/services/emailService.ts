import nodemailer from 'nodemailer';

// ── Helper: send one email ─────────────────────────────────────────────────
// ⚠️  Transporter is created INSIDE this function (not at module level).
//     Reason: emailService.ts is imported before dotenv.config() runs in
//     index.ts, so process.env.EMAIL_USER would be undefined at module load
//     time → "Missing credentials for PLAIN" error.
//     Creating it lazily here guarantees env vars are already loaded.
async function sendMail(subject: string, html: string): Promise<void> {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.ADMIN_EMAIL) {
    console.warn('[EmailService] Email env vars not set — skipping notification.');
    return;
  }

  // Fresh transporter each call — reads current env values ✅
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  try {
    await transporter.sendMail({
      from:    `"StreamPlay Alerts 🎵" <${process.env.EMAIL_USER}>`,
      to:      process.env.ADMIN_EMAIL,
      subject,
      html
    });
    console.log(`[EmailService] ✅ Sent: ${subject}`);
  } catch (err: any) {
    // Non-blocking — log but never crash the API because of email failure
    console.error('[EmailService] ❌ Failed to send email:', err.message);
  }
}


// ── Shared CSS for all emails ──────────────────────────────────────────────
function baseTemplate(title: string, badge: string, badgeColor: string, rows: { label: string; value: string }[]): string {
  const rowsHtml = rows.map(r => `
    <tr>
      <td style="padding:6px 12px;color:#888;font-size:13px;width:120px;">${r.label}</td>
      <td style="padding:6px 12px;color:#e0e0e0;font-size:13px;font-weight:500;">${r.value}</td>
    </tr>`).join('');

  return `
  <!DOCTYPE html>
  <html>
  <body style="margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',Arial,sans-serif;">
    <div style="max-width:520px;margin:32px auto;background:#12121e;border-radius:16px;overflow:hidden;border:1px solid #1e1e2e;">

      <!-- Header -->
      <div style="padding:24px 28px;background:linear-gradient(135deg,#ff4e7e,#ff8c42);">
        <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px;">🎵 StreamPlay</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px;">Admin Activity Alert</div>
      </div>

      <!-- Body -->
      <div style="padding:24px 28px;">
        <!-- Badge -->
        <span style="display:inline-block;padding:4px 14px;border-radius:20px;
              background:${badgeColor}22;border:1px solid ${badgeColor}55;
              color:${badgeColor};font-size:12px;font-weight:700;letter-spacing:0.5px;
              text-transform:uppercase;margin-bottom:14px;">${badge}</span>

        <h2 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#fff;">${title}</h2>

        <!-- Details table -->
        <table style="width:100%;border-collapse:collapse;background:#0f0f1a;border-radius:10px;overflow:hidden;">
          ${rowsHtml}
        </table>

        <!-- Footer note -->
        <p style="margin:20px 0 0;font-size:12px;color:#444;text-align:center;">
          This is an automated alert from StreamPlay. Do not reply to this email.
        </p>
      </div>

    </div>
  </body>
  </html>`;
}

// ── Public notification functions ──────────────────────────────────────────

/** Called after a new user signs up */
export async function notifyAdminSignup(user: { name: string; email: string; role: string }): Promise<void> {
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const html = baseTemplate(
    'New User Registered',
    '🆕 Signup',
    '#5de095',
    [
      { label: 'Name',       value: user.name },
      { label: 'Email',      value: user.email },
      { label: 'Role',       value: user.role },
      { label: 'Chat Access',value: 'false (default)' },
      { label: 'Time (IST)', value: now }
    ]
  );
  await sendMail(`🆕 New Signup: ${user.name} (${user.email})`, html);
}

/** Called after a user logs in successfully */
export async function notifyAdminLogin(user: { name: string; email: string; role: string; chatAccess: boolean }): Promise<void> {
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const html = baseTemplate(
    'User Logged In',
    '🔐 Login',
    '#7ab8ff',
    [
      { label: 'Name',        value: user.name },
      { label: 'Email',       value: user.email },
      { label: 'Role',        value: user.role },
      { label: 'Chat Access', value: user.chatAccess ? '✅ Yes' : '❌ No' },
      { label: 'Time (IST)',  value: now }
    ]
  );
  await sendMail(`🔐 Login: ${user.name} (${user.email})`, html);
}

/** Called after a user logs out */
export async function notifyAdminLogout(user: { name: string; email: string; role: string }): Promise<void> {
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const html = baseTemplate(
    'User Logged Out',
    '👋 Logout',
    '#ff8c42',
    [
      { label: 'Name',       value: user.name },
      { label: 'Email',      value: user.email },
      { label: 'Role',       value: user.role },
      { label: 'Time (IST)', value: now }
  ]
  );
  await sendMail(`👋 Logout: ${user.name} (${user.email})`, html);
}
