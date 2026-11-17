# Physics Lab

A small interactive 3D physics project built with React, TypeScript, Vite, and Three.js.

## Labs

1. **Pendulum** — change length, gravity, and starting angle; drag the bob to choose an angle and run the motion.
2. **Inclined plane** — change ramp angle and friction, then release the ball down the ramp.
3. **Torque balance** — change the two masses and arm distance to see the beam respond to net torque.
4. **Elastic collision** — launch one ball into a stationary ball and adjust the coefficient of restitution.

The simulations use simple numerical updates and the displayed equations are calculated from the current parameter values. No external physics service or API key is required.

## Requirements

- Node.js 18 or newer
- npm

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

## Production build

```bash
npm run build
npm run preview
```

## Project structure

```text
physics-lab/
├── index.html
├── package.json
├── src/
│   ├── App.tsx
│   ├── ThreeScene.tsx
│   ├── main.tsx
│   ├── physics.ts
│   └── styles.css
├── tsconfig.json
├── tsconfig.app.json
└── vite.config.ts
```
