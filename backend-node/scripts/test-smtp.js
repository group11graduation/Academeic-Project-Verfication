/**
 * CLI: prove Gmail SMTP works with the same env files the API uses.
 * Usage (from backend-node): node scripts/test-smtp.js [to@example.com]
 */
import '../src/config/loadRuntimeEnv.js';
import {
  resolveSmtpConfig,
  verifyEmailTransport,
  sendNotificationEmail,
  logEmailConfigStatus,
} from '../src/utils/notify.js';

const to = process.argv[2] || process.env.EMAIL_USER || process.env.SMTP_USER;

async function main() {
  logEmailConfigStatus();
  const cfg = resolveSmtpConfig();
  if (!cfg) {
    console.error('FAIL: SMTP not configured after loading env files.');
    process.exit(1);
  }

  console.log('Verifying SMTP login...');
  const v = await verifyEmailTransport();
  if (!v.ok) {
    console.error('FAIL verify:', v.error);
    process.exit(1);
  }
  console.log('SMTP verify OK');

  if (!to) {
    console.log('No recipient; skipping send. Pass an email: node scripts/test-smtp.js you@mail.com');
    process.exit(0);
  }

  console.log(`Sending test email to ${to}...`);
  const sent = await sendNotificationEmail({
    to,
    title: 'SMTP CLI test',
    message: `Sent at ${new Date().toISOString()} from ScholarVerify test-smtp.js`,
    senderName: 'ScholarVerify Test',
  });
  console.log(sent ? 'OK: email accepted by Gmail' : 'FAIL: send returned false (see logs above)');
  process.exit(sent ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
