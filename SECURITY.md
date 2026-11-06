# Security

Rex Autistikōn Labs (`rexautistikonlabs.org`) is a static site. Astro builds HTML, CSS, and JavaScript into `dist/`. Azure Static Web Apps serves those files. There is no server-side PHP, no application server in this repository, and no directory listing.

Strict-Transport-Security is set by Azure. This repository does not override it.

## Response headers

`staticwebapp.config.json` sends these headers on every response:

| Header | Value |
| --- | --- |
| Content-Security-Policy | `default-src 'self'`, with the exceptions below |
| X-Content-Type-Options | `nosniff` |
| X-Frame-Options | `DENY` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | camera, microphone, geolocation, payment, and related sensors disabled |

CSP exceptions that the current pages actually use:

- `script-src` allows `'self'`, `'unsafe-inline'`, and `https://www.googletagmanager.com`. Inline scripts already ship in the layout and in the contact-adjacent, collaborator, intake, results, and admin pages. Google tag loading is optional and happens only when `PUBLIC_GA4_MEASUREMENT_ID` is set at build time. No other third-party scripts are allowed.
- `style-src` allows `'self'`, `'unsafe-inline'`, and `https://fonts.googleapis.com`. Inline `style` attributes and the existing Inter stylesheet need that.
- `font-src` allows `'self'` and `https://fonts.gstatic.com`.
- `connect-src` allows `'self'`, `https://formsubmit.co` (the contact form), the existing Azure Functions host used by collaborator and authenticated tools, and Google Analytics endpoints used by the optional tag.
- `form-action` allows `'self'` and `https://formsubmit.co` (the contact form only).
- `frame-src` and `object-src` are `'none'`. `frame-ancestors` is `'none'`.
- Zeffy, SunFrog, Zenodo, and Microsoft sign-in are ordinary links or the Azure `/.auth` redirect. They are not framed and are not script sources. Authenticated routes (`/admin/*`, `/intake`, `/results`) stay role-gated.

Production builds set Vite `sourcemap: false`. Unknown URLs are not rewritten to the homepage.

## Forms

- `/contact` posts only to FormSubmit at `https://formsubmit.co/ajax/info@rexautistikonlabs.org` (the form `action` remains `https://formsubmit.co/info@rexautistikonlabs.org`). On a successful reply the page goes to `https://rexautistikonlabs.org/contact/received`. The received page does not print the submission. The first delivery requires the mailbox owner to open FormSubmit’s email and click Activate Form. Until that is done, or while FormSubmit is unavailable, the form stays on the page and shows an error.
- `/collaborate` posts JSON only to the existing collaborator-request Azure Function and then sends the browser to `/collaborate/received`. Errors are written with `textContent`. There is no open redirect.

Report a vulnerability by email to info@rexautistikonlabs.org.
