# Site-side tracking

This file is for the website only. It does not define Google Ads campaign structure.

## Environment variable

| Name | Purpose |
| --- | --- |
| `PUBLIC_GA4_MEASUREMENT_ID` | GA4 measurement ID (`G-…`). Read at **build** time by Astro. |

- If the variable is missing or empty, the site does not hard-code a GA4 measurement ID.
- Do not commit a real measurement ID.
- Copy `.env.example` to `.env` locally, or set the variable in the Azure Static Web Apps / CI build settings.

## What loads

The base layout loads Google Tag Manager container `GTM-TQPHCKCS` on every page. GA4 and other tags are configured in that container, not in the site source.

When `PUBLIC_GA4_MEASUREMENT_ID` is a `G-` ID, the layout also loads `gtag.js`. Leave that variable unset so Tag Manager is the only Google tag.

Named events below are implemented as DOM hooks. They reach GA4 when `gtag` is present.

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

The `/contact` form posts JSON to this site at `POST /api/contact`. Empty required fields are stopped in the browser. When the function returns `{ "success": true }`, the page goes to `/contact/received/`. Any other result stays on the form and shows an error.

`/api/contact` is the Azure Functions endpoint deployed with this Static Web App (`rex-lab-intake`). It forwards name, email, role, topic, and message to Logic App `logic-rex-contact` in resource group `rg-rex-lab-prod`. That Logic App emails info@rexautistikonlabs.org from the Foundation Office 365 connection. Its callback URL is the Static Web App application setting `CONTACT_LOGIC_URL`.

The collaborator form uses a separate Azure Function and is not this contact endpoint.

## Zeffy return URL

`/support/thank-you` exists on this domain as a possible post-donation return page.

Zeffy does **not** accept a return URL on the donate link itself. A custom redirect after checkout has to be requested from Zeffy (see Zeffy support: custom redirect after form submission).

Until that redirect is actually configured in Zeffy:

- Ads must land on `/support`, never on zeffy.com.
- Count `donate_click` only.
- **Do not** fire a completed-donation or purchase conversion from `/support/thank-you`. Visiting that page is not proof of payment.
