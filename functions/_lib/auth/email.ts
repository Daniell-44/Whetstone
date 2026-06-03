export type FetchFn = typeof globalThis.fetch;

export type EmailSender = (to: string, magicLink: string) => Promise<void>;
export type WorkspaceInvitationSender = (to: string, workspaceName: string, inviterEmail: string, acceptUrl: string) => Promise<void>;

export function makeEmailSender(resendApiKey: string, fetchFn: FetchFn = fetch): EmailSender {
  return async (to, magicLink) => {
    const res = await fetchFn('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        // Using Resend's sandbox sender — works without domain verification.
        // Caveat: this only delivers to the email address on your Resend account.
        // Replace with 'noreply@<your-verified-domain>' once you own and verify a domain in Resend.
        from:    'onboarding@resend.dev',
        to,
        subject: 'Sign in to The Whetstone',
        html: [
          '<p>Click the link below to sign in to The Whetstone.</p>',
          '<p>The link expires in 15 minutes and can only be used once.</p>',
          `<p><a href="${magicLink}">Sign in</a></p>`,
          '<p style="color:#888;font-size:13px">If you didn\'t request this, you can safely ignore it.</p>',
        ].join(''),
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend API error: ${res.status}`);
    }
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
        from:    'onboarding@resend.dev',
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
