# Bo Wu — Portfolio & Engineering Showcase

[![Live Site](https://img.shields.io/badge/Live-brob.uk-ea580c?style=flat&logo=cloudflare)](https://brob.uk)
[![Astro](https://img.shields.io/badge/Astro-5.10-bc52ee?logo=astro)](https://astro.build)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-f38020?logo=cloudflare)](https://developers.cloudflare.com/pages/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-000000?logo=three.js)](https://threejs.org/)

Personal portfolio for **Bo Wu**, Computer Engineer specializing in silicon testing, Automated Test Equipment (ATE), and embedded Linux.

**Live site:** [https://brob.uk](https://brob.uk)

---

## Features

- **3D Models:** Interactive WebGL CAD viewer rendering authentic B-Rep geometry tessellated directly from CAD STEP models using Open CASCADE.
- **Playkeys for Plex Web:** Zero-dependency Manifest V3 browser extension for global OS media key control.
- **Network Test:** Direct Anycast network latency, jitter, packet loss, and multi-stream wire-speed throughput benchmark with zero host bandwidth consumption.
- **Mouse Test:** Real-time polling rate oscilloscope, reflex reaction benchmark, and switch chatter detector.
- **Keyboard Test:** Full 104-key switch matrix, N-key rollover (NKRO), dispatch latency, and leaf-spring chatter detector.
- **Debug:** Client-side telemetry dashboard displaying local GPU, CPU, RAM, display scaling, and Cloudflare edge data with a 100% privacy guarantee.

---

## Tech Stack

- **Framework:** [Astro 5](https://astro.build) (SSG on Cloudflare Pages)
- **3D Graphics:** [Three.js](https://threejs.org) with OrbitControls
- **CAD Kernel:** [Open CASCADE Technology](https://dev.opencascade.org/) (`occt-import-js`)
- **Theme:** Modern engineering dark/light palette with pure CSS variables

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


---

## 🤖 AI Agent & Developer Guidelines

Operational rulebooks, architectural constraints, and sensitive project specifications for AI pair programmers (e.g. Antigravity) are maintained in the private vault:
👉 **[`bowuu/agent-rules`](https://github.com/bowuu/agent-rules)** (`repos/portfolio/AGENTS.md`)

To sync local guidelines across devices, clone the private vault alongside this project and run:
```powershell
cd agent-rules
.\sync.ps1 -Action deploy
```

---

## 📜 License

- **Website Source Code:** Licensed under the [MIT License](LICENSE).
- **Personal Content & 3D CAD Models:** All rights reserved. Personal likeness, resume data, and 3D CAD models in `/public/models/` may not be reproduced or used to misrepresent personal identity.
