export type FetchFn = typeof globalThis.fetch;

export type EmailSender = (to: string, magicLink: string, code: string) => Promise<void>;
export type WorkspaceInvitationSender = (to: string, workspaceName: string, inviterEmail: string, acceptUrl: string) => Promise<void>;

export function makeEmailSender(resendApiKey: string, fetchFn: FetchFn = fetch): EmailSender {
  return async (to, magicLink, code) => {
    const res = await fetchFn('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        // .review verified in Resend 2026-08-04 (send-subdomain SPF/MX + DKIM
        // confirmed in public DNS) — sender flipped from the .net deploy guard.
        from:    'noreply@thewhetstone.review',
        to,
        subject: `Your sign-in code: ${code}`,
        html: [
          '<p>To sign in to The Whetstone, choose either method below.</p>',
          '<p style="margin: 20px 0;"><strong>Option 1: click the link</strong> (works on the device you requested it from):</p>',
          `<p style="margin: 10px 0;"><a href="${magicLink}" style="background: #4f46e5; color: white; padding: 10px 18px; border-radius: 6px; text-decoration: none; display: inline-block;">Sign in to The Whetstone</a></p>`,
          '<p style="margin: 20px 0;"><strong>Option 2: type this 6-digit code</strong> on the device where you started signing in:</p>',
          `<p style="font-family: monospace; font-size: 28px; letter-spacing: 6px; background: #f3f4f6; padding: 16px 24px; border-radius: 8px; display: inline-block; font-weight: bold; color: #111827;">${code}</p>`,
          '<p style="color:#666;font-size:13px;margin-top:24px;">The link and code expire in 15 minutes and can only be used once.</p>',
          '<p style="color:#888;font-size:13px">If you did not request this, you can safely ignore it.</p>',
        ].join(''),
      }),
    });
    if (!res.ok) {
      // Pull the response body so the Resend failure is actually visible in
      // wrangler tail rather than being silently swallowed upstream.
      let detail = '';
      try { detail = await res.text(); } catch { /* ignore */ }
      console.error(`[resend] sign-in email send failed status=${res.status} to=${to} body=${detail.slice(0, 500)}`);
      throw new Error(`Resend API error: ${res.status}`);
    }
    console.log(`[resend] sign-in email sent ok to=${to}`);
  };
}

export function makeWorkspaceInvitationSender(resendApiKey: string, fetchFn: FetchFn = fetch): WorkspaceInvitationSender {
  return async (to, workspaceName, inviterEmail, acceptUrl) => {
    const res = await fetchFn('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        // Was 'onboarding@resend.dev' — Resend's shared sandbox, which 403s to
        // every recipient except the account owner, so EVERY external workspace
        // invite silently failed. Send from the verified .review domain (same
        // DNS step as the sign-in sender above).
        from:    'noreply@thewhetstone.review',
        to,
        subject: `You've been invited to join ${workspaceName} on The Whetstone`,
        html: [
          `<p>${inviterEmail} has invited you to join the <strong>${workspaceName}</strong> workspace on The Whetstone.</p>`,
          '<p>Click the link below to accept the invitation. The link expires in 7 days.</p>',
          `<p><a href="${acceptUrl}">Accept invitation</a></p>`,
          '<p style="color:#888;font-size:13px">If you weren\'t expecting this invitation, you can safely ignore it.</p>',
        ].join(''),
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend API error: ${res.status}`);
    }
  };
}
