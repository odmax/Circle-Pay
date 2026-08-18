import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
})

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<void> {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@circlepay.app"

  await transporter.sendMail({
    from,
    to,
    subject: "Reset your Circle Pay password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2>Password Reset</h2>
        <p>You requested a password reset for your Circle Pay account.</p>
        <p>Click the button below to set a new password. This link expires in 30 minutes.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0">Reset Password</a>
        <p style="font-size:13px;color:#666">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
    text: `Reset your Circle Pay password. Open this link to set a new password (expires in 30 minutes): ${resetUrl}`,
  })
}
