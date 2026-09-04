/**
 * The From address for every outbound mail.
 *
 * Resend's shared `onboarding@resend.dev` sender is a sandbox: it only ever
 * delivers to the address that owns the Resend account, it is rate-limited, and
 * Gmail treats it as a stranger. It was fine while this was one reader, and it
 * is the wrong thing to hard-code in three call sites.
 *
 * `RESEND_FROM` holds the sending identity — either a bare address
 * (`tyun@example.com`) or a full `Name <addr>` string. It must be on a domain
 * verified in the Resend dashboard, otherwise Resend rejects the send. Unset,
 * this falls back to the sandbox sender so nothing breaks before the domain is
 * verified.
 */

const SANDBOX = "onboarding@resend.dev";

/** `from` for a Resend send, labelled with `displayName`. */
export function mailFrom(displayName: string): string {
  const configured = process.env.RESEND_FROM?.trim();
  // A configured value that already carries its own display name wins as-is —
  // the operator picked that label on purpose.
  if (configured?.includes("<")) return configured;
  return `${displayName} <${configured || SANDBOX}>`;
}

/** True while still on the sandbox sender — logged once per send batch so a
 *  silent "only reaches the account owner" failure is visible in the logs. */
export function isSandboxSender(): boolean {
  return !process.env.RESEND_FROM?.trim();
}
