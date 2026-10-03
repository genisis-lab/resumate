// Self-hosted template fonts (the CSP only allows same-origin fonts). Browsers
// download a font file only when a rendered template actually uses it.
//
// These are deliberately STATIC font files. Chromium embeds variable fonts in
// PDFs as Type 3 fonts, which many ATS parsers read without word spaces
// ("Seniorproductdesigner"). Static TrueType files embed as CID TrueType and
// keep the exported text layer clean.
import "@fontsource/manrope/400.css"
import "@fontsource/manrope/500.css"
import "@fontsource/manrope/600.css"
import "@fontsource/manrope/700.css"
import "@fontsource/manrope/800.css"
import "@fontsource/inter/400.css"
import "@fontsource/inter/400-italic.css"
import "@fontsource/inter/500.css"
import "@fontsource/inter/600.css"
import "@fontsource/inter/700.css"
import "@fontsource/inter/800.css"
import "@fontsource/eb-garamond/400.css"
import "@fontsource/eb-garamond/400-italic.css"
import "@fontsource/eb-garamond/500.css"
import "@fontsource/eb-garamond/600.css"
import "@fontsource/playfair-display/600.css"
import "@fontsource/space-grotesk/500.css"
import "@fontsource/space-grotesk/600.css"
import "@fontsource/space-grotesk/700.css"
import "@fontsource/ibm-plex-sans/400.css"
import "@fontsource/ibm-plex-sans/400-italic.css"
import "@fontsource/ibm-plex-sans/500.css"
import "@fontsource/ibm-plex-sans/600.css"
import "@fontsource/ibm-plex-mono/400.css"
import "@fontsource/ibm-plex-mono/600.css"
