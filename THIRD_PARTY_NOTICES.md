# Third-party notices

## Code and fonts

Runtime dependencies retain their respective licenses (see package-lock.json and installed package licenses): React (MIT), Vite (MIT, build tool), lucide-react (ISC), libsodium / libsodium-wrappers (ISC), qrcode (MIT), Express (MIT), helmet (MIT), express-rate-limit (MIT), cookie-parser (MIT).

DM Sans and Manrope are distributed via Fontsource under the SIL Open Font License. Font files are bundled locally; no Google Fonts API request is made at runtime.

## Emoji

The 16 locally bundled SVGs in `web/public/emojis/` are from `@twemoji/svg` 15.0.0 / Twemoji, copyright Twitter and contributors. Artwork is licensed CC-BY 4.0. The package's notices are included as `web/public/emojis/LICENSE.txt`. Project: https://github.com/twitter/twemoji . The SVGs were not modified. They are displayed at small inline sizes.

## Demo photography

Fictional profile names are not claims about the people depicted in stock photos. Locally cached demo imagery was retrieved through image search; original source links:

- Alpine lake: Pexels photo 31755654, https://images.pexels.com/photos/31755654/pexels-photo-31755654.jpeg (Pexels stock photography license).
- Alpine meadow: https://hippopx.com/en/search?q=dolomites (CC0-style stock photography listing; thumbnail file name `mountains-summit-meadow-dolomites-landscape-hiking-nature-park-alpine-thumbnail.jpg`).
- Lakeside: https://veggiewayfarer.com/most-beautiful-lakes-in-the-dolomites/ (demo-only reference photo; replace or obtain the applicable rights before public distribution).
- Sofia demo portrait: Pexels photo 3791554, https://www.pexels.com/photo/3791554/ (Pexels stock photography license).
- Mia demo portrait: Pexels photo 1844659, https://www.pexels.com/photo/1844659/ (Pexels stock photography license).

No user image is uploaded to these sources. The APK and browser use the locally bundled copies. Confirm all media licensing before a public release; sample images can be replaced without changing application functionality.

## Android build tools

Gradle wrapper from Gradle 8.9 (Apache 2.0). Android SDK APIs, OpenJDK, D8/R8, Apktool and APK signing tools are build-time dependencies, not application runtime libraries. The supplied APK's build report records its local build path; debug signing is not release signing.
