import nodemailer from 'nodemailer';
import { promises as dnsPromises } from 'dns';

// ── Helper: send one email ─────────────────────────────────────────────────
// ⚠️  Transporter is created INSIDE this function (not at module level).
//     Reason: emailService.ts is imported before dotenv.config() runs in
//     index.ts, so process.env.EMAIL_USER would be undefined at module load
//     time → "Missing credentials for PLAIN" error.
//     Creating it lazily here guarantees env vars are already loaded.
//
// 🔧 PRODUCTION FIX (Render free tier — definitive version):
//     Problem 1 → Port 465 (SSL) is BLOCKED by Render's firewall.
//                 Fix: use port 587 (STARTTLS).
//     Problem 2 → Render has NO IPv6 routing. Node resolves smtp.gmail.com
//                 to an AAAA (IPv6) address first → ENETUNREACH instantly.
//                 `family: 4` and `lookup` are NOT in @types/nodemailer v7
//                 so we cannot rely on nodemailer's own DNS path at all.
//                 Fix: pre-resolve the hostname ourselves with dns.promises,
//                 force family: 4, then pass the raw IPv4 IP as `host`.
//                 Nodemailer never does a DNS lookup → IPv6 impossible.
async function sendMail(subject: string, html: string): Promise<void> {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.ADMIN_EMAIL) {
    console.warn('[EmailService] Email env vars not set — skipping notification.');
    return;
  }

  // ── Step 1: Resolve smtp.gmail.com → IPv4 ourselves ──────────────────────
  // By passing the resolved IP as `host`, nodemailer never calls dns.lookup
  // internally, so it is impossible for it to pick an IPv6 address.
  let smtpHost = 'smtp.gmail.com'; // fallback (will still work if dns fails)
  try {
    const { address } = await dnsPromises.lookup('smtp.gmail.com', { family: 4 });
    smtpHost = address; // e.g. "142.250.xxx.xxx"
    console.log(`[EmailService] Resolved smtp.gmail.com → ${smtpHost} (IPv4)`);
  } catch (dnsErr: any) {
    console.warn('[EmailService] DNS pre-resolve failed, falling back to hostname:', dnsErr.message);
  }

  // ── Step 2: Create transporter with the IPv4 address ─────────────────────
  const transporter = nodemailer.createTransport({
    host:   smtpHost,           // IPv4 address — bypasses nodemailer DNS entirely
    port:   587,                // STARTTLS — Render allows this (port 465 is blocked)
    secure: false,              // STARTTLS, not SSL
    connectionTimeout: 15_000,  // 15 s — survives Render cold-start lag
    greetingTimeout:   10_000,
    socketTimeout:     15_000,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      // Must keep smtp.gmail.com as servername even though we connect by IP,
      // otherwise TLS certificate validation will fail.
      servername:         'smtp.gmail.com',
      rejectUnauthorized: true
    }
  } as any);  // `as any` only because @types/nodemailer v7 lags behind v8 runtime

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
