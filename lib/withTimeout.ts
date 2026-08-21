/**
 * A deadline for a promise you did not write.
 *
 * Engineering Rulebook §3.11: every remote call gets a timeout. Several of this
 * app's outbound calls go through vendor SDKs (Gemini, Groq, Resend) that take
 * no timeout option and expose no AbortSignal, so there is nothing to configure
 * — the call either returns or it does not. `AbortSignal.timeout` covers the
 * routes that use `fetch` directly (`/api/run`, Weather); this covers the rest.
 *
 * What it does and does not do: it bounds how long the *caller* waits. The
 * request the SDK started keeps running, because nothing here can cancel it.
 * That is still the part that matters — a handler which returns an error can
 * fall back, report, and free the invocation, while one that waits forever
 * gives the user a spinner and the platform a killed function (§3.12).
 *
 * This lives in lib/ rather than beside its first caller on purpose. The moment
 * the second route needed it, a local copy would have been §1.13 waiting to
 * happen: two deadlines, one of them eventually tuned and the other forgotten.
 */

/** Rejects with `<label> timed out after <ms>ms` if `work` has not settled. */
export async function withTimeout<T>(
  work: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    // Always clear it. An un-cleared timer holds a serverless invocation open
    // after the response has gone out — one owner, one cleanup path (§3.13).
    clearTimeout(timer!);
  }
}
