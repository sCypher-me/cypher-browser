# Cypher integration notes

The bundled Proton VPN browser extension is the upstream ProtonVPN project at version 1.3.6, licensed under GPL-3.0. Its upstream source and license are included beside this notice in the Cypher installation under `resources/licenses/proton-vpn/`.

Cypher modifications are in `source/` and in the build files included here. They adapt the upstream extension to Electron's Manifest V2 extension loader, route its proxy settings through a Cypher-only Electron session bridge, open Proton login pages as Cypher tabs, relay Proton account sign-in responses from the account page, and disable Proton split tunneling in this integration. The bridge accepts calls only from this extension's own `chrome-extension://` origin.

Upstream project: https://github.com/ProtonVPN/proton-vpn-browser-extension

To rebuild from source, use the included `package.json`, `package-lock.json`, `source/`, `config.js`, `webpack.config.js`, `webpack-cypher.config.js`, `webpack-directive-loader.js`, `.babelrc`, and `tsconfig.json`. The Cypher repository also includes `scripts/prepare-proton-vpn.cjs`.
