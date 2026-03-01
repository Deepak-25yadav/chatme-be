// ── EmailService — powered by Brevo (ex-Sendinblue) HTTP API ───────────────
//
// WHY NOT SMTP / NODEMAILER?
//   Render free tier firewalls ALL outbound SMTP TCP ports: 25, 465, 587.
//   Connection timeout / ENETUNREACH on every attempt — hard Render limit.
//
// WHY BREVO?
//   • HTTP API on port 443 (HTTPS) — never blocked by any cloud provider.
//   • FREE tier: 300 emails / day, unlimited contacts — no credit card.
//   • Only requires verifying ONE sender email (click a confirmation link).
//   • No domain DNS setup needed unlike Resend / SendGrid for custom senders.
//   • Node 20 built-in fetch — zero new npm packages needed.
//
// ONE-TIME SETUP (~3 minutes):
//   1. Sign up FREE at https://app.brevo.com
//   2. Go to  My Account → SMTP & API → API Keys → Generate a New API Key
//   3. Go to  Senders & Domains → Senders → Add Sender
//      Enter any email you own (e.g. your Gmail) → click the verification link
//   4. In Render → Environment, add:
//         BREVO_API_KEY   = <your key from step 2>
//         SENDER_EMAIL    = <the verified email from step 3>  e.g. you@gmail.com
//         ADMIN_EMAIL     = <where alerts should go>          e.g. admin@gmail.com

async function sendMail(subject: string, html: string): Promise<void> {
  const apiKey      = process.env.BREVO_API_KEY;
  const senderEmail = process.env.SENDER_EMAIL;
  const adminEmail  = process.env.ADMIN_EMAIL;

  if (!apiKey || !senderEmail || !adminEmail) {
    console.warn(
      '[EmailService] Missing env vars (BREVO_API_KEY / SENDER_EMAIL / ADMIN_EMAIL) — skipping.'
    );
    return;
  }

  const payload = {
    sender:      { name: 'StreamPlay Alerts 🎵', email: senderEmail },
    to:          [{ email: adminEmail }],
    subject,
    htmlContent: html,          // ← Brevo uses `htmlContent`, not `html`
  };

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method:  'POST',
      headers: {
        'api-key':      apiKey,         // ← Brevo uses `api-key` header (not Bearer)
        'Content-Type': 'application/json',
        'Accept':       'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const result = await response.json() as { messageId?: string };
      console.log(`[EmailService] ✅ Sent via Brevo: ${subject} (id: ${result.messageId ?? '—'})`);
    } else {
      const errBody = await response.text();
      console.error(`[EmailService] ❌ Brevo API ${response.status}:`, errBody);
    }
  } catch (err: any) {
    // Non-blocking — never crash the API due to email failure
    console.error('[EmailService] ❌ Failed to reach Brevo API:', err.message);
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

// ── Activity tracking ──────────────────────────────────────────────────────
// Called by POST /api/activity/track for any frontend user action.

type ActivityUser = { name: string; email: string; role: string } | null;

const ACTION_META: Record<string, { emoji: string; badge: string; color: string; title: string }> = {
  home_visit: { emoji: '🏠', badge: '🏠 Home Visit',  color: '#7ab8ff', title: 'User Visited Home Page' },
  play:       { emoji: '▶️', badge: '▶️ Track Played', color: '#5de095', title: 'User Played a Track'     },
  add:        { emoji: '➕', badge: '➕ Track Added',   color: '#ff4e7e', title: 'New Track Added'          },
  edit:       { emoji: '✏️', badge: '✏️ Track Edited',  color: '#ffc832', title: 'Track Edited'            },
  delete:     { emoji: '🗑️', badge: '🗑️ Track Deleted', color: '#ff8080', title: 'Track Deleted'          },
};

/** Universal activity-to-email dispatcher */
export async function sendActivityEmail(
  action: string,
  data: Record<string, any>,
  user: ActivityUser
): Promise<void> {
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const meta = ACTION_META[action] ?? {
    emoji: '📌', badge: `📌 ${action.toUpperCase()}`, color: '#aaa', title: `Activity: ${action}`
  };

  // ── User rows ─────────────────────────────────────────────────────────────
  const userRows = user
    ? [
        { label: 'User',  value: user.name  },
        { label: 'Email', value: user.email },
        { label: 'Role',  value: user.role  },
      ]
    : [{ label: 'User', value: 'Guest (not logged in)' }];

  // ── Action-specific data rows ─────────────────────────────────────────────
  let dataRows: { label: string; value: string }[] = [];

  switch (action) {
    case 'home_visit':
      dataRows = [
        { label: 'Page',      value: '/music (Home)' },
        { label: 'User Agent', value: String(data.userAgent || 'unknown').slice(0, 80) },
      ];
      break;

    case 'play':
      dataRows = [
        { label: 'Track',    value: data.title    || '-' },
        { label: 'Artist',   value: data.artist   || '-' },
        { label: 'Category', value: data.category || '-' },
        { label: 'Views',    value: String(data.views ?? '-') },
        { label: 'URL',      value: (data.url || '-').slice(0, 80) },
      ];
      break;

    case 'add':
      dataRows = [
        { label: 'Track',    value: data.title    || '-' },
        { label: 'Artist',   value: data.artist   || '-' },
        { label: 'Category', value: data.category || '-' },
        { label: 'URL',      value: (data.url || '-').slice(0, 80) },
      ];
      break;

    case 'edit':
      dataRows = [
        { label: 'Track ID', value: data.id      || '-' },
        { label: 'Title',    value: data.title   || '-' },
        { label: 'Artist',   value: data.artist  || '-' },
        { label: 'Category', value: data.category || '-' },
      ];
      break;

    case 'delete':
      dataRows = [
        { label: 'Track ID', value: data.id    || '-' },
        { label: 'Title',    value: data.title || '-' },
        { label: 'Artist',   value: data.artist || '-' },
      ];
      break;

    default:
      dataRows = Object.entries(data).map(([k, v]) => ({
        label: k, value: String(v).slice(0, 100)
      }));
  }

  const allRows = [
    ...userRows,
    { label: '─────────', value: '──────────────────────────────────' },
    ...dataRows,
    { label: 'Time (IST)', value: now },
  ];

  const html = baseTemplate(meta.title, meta.badge, meta.color, allRows);
  const subject = `${meta.emoji} ${meta.title}${data.title ? ': ' + data.title : ''}`;
  await sendMail(subject, html);
}
