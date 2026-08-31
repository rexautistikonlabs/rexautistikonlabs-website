# Site-side tracking

This file is for the website only. It does not define Google Ads campaign structure.

## Environment variable

| Name | Purpose |
| --- | --- |
| `PUBLIC_GA4_MEASUREMENT_ID` | GA4 measurement ID (`G-…`). Read at **build** time by Astro. |

- If the variable is missing or empty, **no Google tag is loaded**.
- Do not commit a real measurement ID.
- Copy `.env.example` to `.env` locally, or set the variable in the Azure Static Web Apps / CI build settings.

## What loads

When `PUBLIC_GA4_MEASUREMENT_ID` is a `G-` ID, the base layout loads `gtag.js` and fires `page_view` on each Astro page load.

Named events below are implemented as DOM hooks even when the ID is empty. They only reach GA4 when gtag is present.

## Named events

| Event | When it fires |
| --- | --- |
| `generate_lead` | Successful Foundation contact form → `/contact/received` |
| `collaborator_request` | Successful `/collaborate` form → `/collaborate/received` |
| `donate_click` | Outbound click from `/support` to Zeffy (`#cta-donate`) |
| `publication_click` | Outbound click from `/publications` to doi.org or zenodo.org |
| `contact_email_click` | Click on `mailto:info@rexautistikonlabs.org` |

CTA element IDs (for reporting and Ads click tracking, not automatic conversions):

- `#cta-research-framework` — primary link to `/research-framework`
- `#cta-collaborate` — primary collaborator Request Access CTA
- `#cta-donate` — primary donate CTA on `/support`

## Do not convert on

- Time on page
- Scroll depth
- Interactive model slider use

## Google Ads landing pages (this domain only)

Final URLs must stay on `rexautistikonlabs.org`. Do not use Substack, YouTube, or zeffy.com as the ad final URL.

| Campaign intent | Land on | Conversion URL / event |
| --- | --- | --- |
| Research / public discovery | `/research` | Assist: `#cta-research-framework`, `/how-to-collaborate` |
| Collaboration | `/how-to-collaborate` | `/collaborate/received` (`collaborator_request`) |
| Publications / specification | `/publications` | `publication_click` (outbound; optional) |
| Donors | `/support` | `donate_click` (outbound to Zeffy) |
| General / identity | `/about` | `/contact/received` (`generate_lead`) |
| Contact | `/contact` | `/contact/received` (`generate_lead`) |

Search Partners and Display stay **off**. That setting lives in Google Ads, not in this repository.

## Contact form backend

The `/contact` form posts to Formsubmit (`https://formsubmit.co/ajax/info@rexautistikonlabs.org`) and, on success, routes to `/contact/received`.

The first Formsubmit delivery to `info@rexautistikonlabs.org` requires confirming the mailbox. Until that confirmation is done, submissions may not arrive.

There is no Foundation-hosted contact API in this repo (the collaborator form uses a separate Azure Function).

## Zeffy return URL

`/support/thank-you` exists on this domain as a possible post-donation return page.

Zeffy does **not** accept a return URL on the donate link itself. A custom redirect after checkout has to be requested from Zeffy (see Zeffy support: custom redirect after form submission).

Until that redirect is actually configured in Zeffy:

- Ads must land on `/support`, never on zeffy.com.
- Count `donate_click` only.
- **Do not** fire a completed-donation or purchase conversion from `/support/thank-you`. Visiting that page is not proof of payment.
