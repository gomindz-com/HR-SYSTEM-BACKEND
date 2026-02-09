/**
 * Shared email layout matching the reference design (table-based, 580px, gray text, red CTA).
 * Use renderEmailLayout() to build full HTML; omit optional sections by not passing them.
 */

const FONT_STACK =
  '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif';
const TEXT_COLOR = "rgb(72,72,72)";
const HIGHLIGHT_BG = "rgb(242,243,243)";
const CTA_BG = "rgb(255,90,95)";
const CTA_COLOR = "rgb(255,255,255)";
const LINK_COLOR = "rgb(255,90,95)";
const HR_COLOR = "rgb(204,204,204)";
const FOOTER_COLOR = "rgb(156,162,153)";

function escapePreheader(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {Object} options
 * @param {string} [options.preheaderText]
 * @param {string} [options.logoUrl]
 * @param {string} [options.logoAlt]
 * @param {string} [options.avatarUrl]
 * @param {string} [options.avatarAlt]
 * @param {string} options.mainHeading
 * @param {string} [options.highlightBlock]
 * @param {string[]} [options.bodyParagraphs]
 * @param {{ text: string, href: string }} [options.cta]
 * @param {{ label: string, href: string }[]} [options.footerLinks]
 * @param {string} [options.footerAddress]
 * @param {{ label: string, href: string }} [options.footerLink]
 * @returns {string} Full HTML document
 */
export function renderEmailLayout(options) {
  const {
    preheaderText = "",
    logoUrl = process.env.EMAIL_LOGO_URL || process.env.APP_LOGO_URL || "",
    logoAlt = "Logo",
    avatarUrl = "",
    avatarAlt = "",
    mainHeading = "",
    highlightBlock = "",
    bodyParagraphs = [],
    cta = null,
    footerLinks = [],
    footerAddress = "",
    footerLink = null,
  } = options;

  const preheaderSafe = escapePreheader(preheaderText);
  const hasLogo = Boolean(logoUrl && logoUrl.trim());
  const hasAvatar = Boolean(avatarUrl && avatarUrl.trim());
  const hasCta = cta && cta.href && cta.text;
  const hasFooterLinks = Array.isArray(footerLinks) && footerLinks.length > 0;
  const hasFooterAddress = Boolean(footerAddress && footerAddress.trim());
  const hasFooterLink = footerLink && footerLink.href && footerLink.label;

  const preloads = [];
  if (hasLogo) preloads.push(`<link rel="preload" as="image" href="${logoUrl}" />`);
  if (hasAvatar) preloads.push(`<link rel="preload" as="image" href="${avatarUrl}" />`);

  const paragraphsHtml = bodyParagraphs
    .map(
      (p) =>
        `<p style="font-size:18px;line-height:1.4;color:${TEXT_COLOR};margin-top:16px;margin-bottom:16px">${p}</p>`
    )
    .join("");

  const footerLinksHtml =
    hasFooterLinks &&
    footerLinks
      .map(
        (item) =>
          `<p style="font-size:14px;line-height:24px;margin-top:16px;margin-bottom:16px"><a href="${item.href}" style="color:${LINK_COLOR};text-decoration-line:none;font-size:18px;line-height:1.4;display:block" target="_blank">${item.label}</a></p>`
      )
      .join("");

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="en">
  <head>
    ${preloads.join("\n    ")}
    <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
    <meta name="x-apple-disable-message-reformatting" />
  </head>
  <body style="background-color:rgb(255,255,255)">
    <table border="0" width="100%" cellpadding="0" cellspacing="0" role="presentation" align="center">
      <tbody>
        <tr>
          <td style="background-color:rgb(255,255,255);font-family:${FONT_STACK}">
            <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0" data-skip-in-text="true">
              ${preheaderSafe}
              <div>&#x200C;&#x200B;&#x200C;&#x200B;&#x200C;&#x200B;</div>
            </div>
            <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="max-width:100%;margin-right:auto;margin-left:auto;padding-bottom:48px;padding-top:20px;width:580px">
              <tbody>
                <tr style="width:100%">
                  <td>
                    ${hasLogo ? `<table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tbody><tr><td><img alt="${escapePreheader(logoAlt)}" height="30" src="${logoUrl}" style="display:block;outline:none;border:none;text-decoration:none" width="96" /></td></tr></tbody></table>` : ""}
                    ${hasAvatar ? `<table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tbody><tr><td><img alt="${escapePreheader(avatarAlt)}" height="96" src="${avatarUrl}" style="display:block;outline:none;border:none;text-decoration:none;margin-right:auto;margin-left:auto;margin-bottom:16px;border-radius:9999px" width="96" /></td></tr></tbody></table>` : ""}
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="padding-bottom:20px">
                      <tbody>
                        <tr>
                          <td>
                            <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                              <tbody style="width:100%">
                                <tr style="width:100%">
                                  <p style="font-size:32px;line-height:1.3;font-weight:700;color:${TEXT_COLOR};margin-top:16px;margin-bottom:16px">${mainHeading}</p>
                                  ${highlightBlock ? `<p style="font-size:18px;line-height:1.4;color:${TEXT_COLOR};padding:24px;background-color:${HIGHLIGHT_BG};border-radius:0.25rem;margin-top:16px;margin-bottom:16px">${highlightBlock}</p>` : ""}
                                  ${paragraphsHtml}
                                  ${hasCta ? `<a href="${cta.href}" style="line-height:100%;text-decoration:none;display:block;max-width:100%;mso-padding-alt:0px;background-color:${CTA_BG};border-radius:0.25rem;color:${CTA_COLOR};font-size:18px;padding-bottom:19px;padding-top:19px;padding-right:30px;padding-left:30px;text-decoration-line:none;text-align:center" target="_blank"><span style="max-width:100%;display:inline-block;line-height:120%;mso-padding-alt:0px;mso-text-raise:14.25px">${cta.text}</span></a>` : ""}
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <hr style="width:100%;border:none;border-top:1px solid #eaeaea;border-color:${HR_COLOR};margin-bottom:20px;margin-top:20px" />
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                      <tbody>
                        <tr>
                          <td>
                            <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                              <tbody style="width:100%">
                                <tr style="width:100%">
                                  ${hasFooterLinks ? `<p style="font-size:18px;line-height:1.4;color:${TEXT_COLOR};font-weight:700;margin-top:16px;margin-bottom:16px">Common questions</p>${footerLinksHtml}` : ""}
                                  ${hasFooterLinks && (hasFooterAddress || hasFooterLink) ? `<hr style="width:100%;border:none;border-top:1px solid #eaeaea;border-color:${HR_COLOR};margin-bottom:20px;margin-top:20px" />` : ""}
                                  ${hasFooterAddress ? `<p style="font-size:14px;line-height:24px;color:${FOOTER_COLOR};margin-bottom:10px;margin-top:16px">${footerAddress}</p>` : ""}
                                  ${hasFooterLink ? `<a href="${footerLink.href}" style="color:${FOOTER_COLOR};text-decoration-line:underline;font-size:14px" target="_blank">${footerLink.label}</a>` : ""}
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  </body>
</html>`;
}
