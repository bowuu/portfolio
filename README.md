# Bo Wu — Portfolio & Engineering Showcase

[![Live Site](https://img.shields.io/badge/Live-brob.uk-ea580c?style=flat&logo=cloudflare)](https://brob.uk)
[![Astro](https://img.shields.io/badge/Astro-5.10-bc52ee?logo=astro)](https://astro.build)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-f38020?logo=cloudflare)](https://developers.cloudflare.com/pages/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-000000?logo=three.js)](https://threejs.org/)

Personal portfolio for **Bo Wu**, Computer Engineer specializing in silicon testing, Automated Test Equipment (ATE), and embedded Linux.

**Live site:** [https://brob.uk](https://brob.uk)

---

## Features

- **3D Models Viewer:** Interactive WebGL viewer rendering authentic B-Rep geometry tessellated directly from Autodesk Inventor STEP models using Open CASCADE.
- **Playkeys for Plex Web:** Zero-dependency Manifest V3 browser extension for global OS media key control.
- **System Inspector:** Client-side telemetry dashboard displaying local GPU, CPU, RAM, display scaling, and Cloudflare edge data with a 100% privacy guarantee.
- **Edge Network Benchmark:** Direct Anycast network latency, jitter, download, and upload throughput benchmark with zero host bandwidth consumption.

---

## Tech Stack

- **Framework:** [Astro 5](https://astro.build) (SSG on Cloudflare Pages)
- **3D Graphics:** [Three.js](https://threejs.org) with OrbitControls
- **CAD Kernel:** [Open CASCADE Technology](https://dev.opencascade.org/) (`occt-import-js`)
- **Theme:** Bambu Lab dark/light palette with pure CSS variables

---

## Development

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Build production bundle
npm run build
```
