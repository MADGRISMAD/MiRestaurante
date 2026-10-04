const nodemailer = require('nodemailer');

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendInviteEmail({ to, inviteUrl, role, businessName }) {
  const subject = `Invitación a MiRestaurante${businessName ? ` — ${businessName}` : ''}`;
  const html = `
    <div style="font-family:sans-serif;line-height:1.5;color:#1c1f1d">
      <h2>Te invitaron a MiRestaurante</h2>
      <p>Te invitaron a unirte${businessName ? ` a <strong>${businessName}</strong>` : ''} con el rol <strong>${role}</strong>.</p>
      <p><a href="${inviteUrl}" style="display:inline-block;padding:10px 16px;background:#1F4D3A;color:#fff;text-decoration:none;border-radius:8px">Aceptar invitación</a></p>
      <p style="font-size:12px;color:#66706a">O copia este enlace:<br>${inviteUrl}</p>
    </div>
  `;

  if (!hasSmtpConfig()) {
    console.log('[mail:dev-fallback] Invite email not sent (SMTP missing). Link:', inviteUrl);
    return { sent: false, fallback: true, inviteUrl };
  }

  const transport = createTransport();
  await transport.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  });
  return { sent: true, fallback: false, inviteUrl };
}

async function sendPasswordResetEmail({ to, resetUrl }) {
  const subject = 'Restablecer contraseña — MiRestaurante';
  const html = `
    <div style="font-family:sans-serif;line-height:1.5;color:#1c1f1d">
      <h2>Restablecer contraseña</h2>
      <p>Recibimos una solicitud para cambiar tu contraseña.</p>
      <p><a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#1F4D3A;color:#fff;text-decoration:none;border-radius:8px">Elegir nueva contraseña</a></p>
      <p style="font-size:12px;color:#66706a">El enlace expira en 1 hora.<br>${resetUrl}</p>
    </div>
  `;

  if (!hasSmtpConfig()) {
    console.log('[mail:dev-fallback] Reset email not sent (SMTP missing). Link:', resetUrl);
    return { sent: false, fallback: true, resetUrl };
  }

  const transport = createTransport();
  await transport.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  });
  return { sent: true, fallback: false, resetUrl };
}

module.exports = { sendInviteEmail, sendPasswordResetEmail, hasSmtpConfig };
