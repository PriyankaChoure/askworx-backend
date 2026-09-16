// utils/sendEmail.js
// Only needed if you don't already have an email-sending utility.
// Requires: npm install nodemailer
// Env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

module.exports = async function sendEmail({ to, subject, html }) {
  console.log(`Sending email to: ${to}, subject: ${subject}`);
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    html
  });
  console.log('Email sent successfully:', info.messageId);
};
