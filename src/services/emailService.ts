// ── EmailService — powered by Resend HTTP API ──────────────────────────────
//
// WHY NOT SMTP / NODEMAILER?
//   Render free tier firewalls ALL outbound SMTP TCP ports: 25, 465, 587.
//   Every port we tried gave: ENETUNREACH (IPv6) or Connection timeout (IPv4).
//   There is no SMTP config that can bypass this — it is a hard Render limit.
//
// WHY RESEND?
//   Resend sends email via its HTTP API (port 443 / HTTPS).
//   Port 443 is NEVER blocked on any cloud provider.
//   Free tier: 3,000 emails/month, 100/day — plenty for admin alerts.
//   No nodemailer, no SMTP, no DNS issues, no IPv6 issues.
//   Node 20 has built-in fetch — zero new npm packages needed.
//
// SETUP (one-time, ~2 minutes):
//   1. Sign up FREE at https://resend.com
//   2. Dashboard → API Keys → Create Key → copy it
//   3. Add  RESEND_API_KEY=re_xxxxxxxxxxxx  in Render → Environment tab
//   4. (Optional) Add your domain in Resend to send FROM a custom address.
//      Until then, the free sender  onboarding@resend.dev  is used.

async function sendMail(subject: string, html: string): Promise<void> {
  const apiKey     = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!apiKey || !adminEmail) {
    console.warn('[EmailService] RESEND_API_KEY or ADMIN_EMAIL not set — skipping.');
    return;
  }

  // Sender: use verified domain address if provided, else Resend's free sender.
  // To send FROM your own Gmail you must verify a domain in the Resend dashboard.
  // For now, onboarding@resend.dev works perfectly for internal admin alerts.
  const from = process.env.EMAIL_FROM ?? 'StreamPlay Alerts <onboarding@resend.dev>';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ from, to: [adminEmail], subject, html }),
    });

    if (response.ok) {
      console.log(`[EmailService] ✅ Sent via Resend: ${subject}`);
    } else {
      const body = await response.text();
      console.error(`[EmailService] ❌ Resend API error ${response.status}:`, body);
    }
  } catch (err: any) {
    // Non-blocking — never crash the API because of email failure
    console.error('[EmailService] ❌ Failed to reach Resend API:', err.message);
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
