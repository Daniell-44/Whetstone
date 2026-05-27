export type FetchFn = typeof globalThis.fetch;

export type EmailSender = (to: string, magicLink: string) => Promise<void>;

export function makeEmailSender(resendApiKey: string, fetchFn: FetchFn = fetch): EmailSender {
  return async (to, magicLink) => {
    const res = await fetchFn('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from:    'noreply@whetstone.so',
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
