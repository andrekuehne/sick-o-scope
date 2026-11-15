# Sign-in by links shared within the Family, not email or Cloudflare Access

A device signs in by opening a one-time Sign-in link that an existing User creates in the app and shares directly (for example by WhatsApp). The device then gets a session whose one-year expiry renews with use, so it only signs out after a year of not being used. The very first link comes from a setup command, which is also the fallback when nobody can sign in.

We rejected Cloudflare Access, which `lauf-register` uses. Its login hops through `*.cloudflareaccess.com`, which installed PWAs handle badly, and it asks you to sign in again about once a month. We also rejected email codes for v1. Sending to arbitrary addresses needs the Workers Paid plan plus a domain on Cloudflare DNS (the account has none), or a third-party mail API, all for a handful of sign-ins a year. Passkeys are tied to the hostname, so a later move from `workers.dev` to a custom domain would make everyone register again.

All identity checks go through one `currentUser(request)` boundary, so email codes or passkeys can be added later as further sign-in methods. Tests don't fake identity; they sign in through a real Sign-in link.
