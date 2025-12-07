# newtens

Minimal web playground for fast UI and logic testing without engines.

## Neon Sweep (Hotline-like prototype)

Open `index.html` in any modern browser (no build tools or servers needed) to try a tiny top-down action slice inspired by Hotline Miami.

## Running locally

If you want a quick local server with proper module hosting and CORS headers, use the built-in Node script:

```bash
npm install
npm start
```

The server defaults to [http://localhost:8080](http://localhost:8080). Override with `PORT=3000 npm start` or any other free port.

**Controls**
- WASD to move the player
- Mouse to aim, **Left click** to shoot (limited ammo), **Right click** to melee/stun
- **Shift** to dash, **R** to restart, **1/2/3** to switch masks (Tiger speed, Owl ammo, Rhino heavy dash)
- Scoring: each kill adds to your combo; keep chaining eliminations before the timer drops to multiply points
- Survive multiple escalating waves; clearing a wave bumps difficulty and keeps your score rolling
- Press **Enter** or the **Start** button on the overlay to drop into a run

**Goals & behaviors**
- Enemies patrol until they see you, then chase and take you out on touch. One hit kills you.
- Enemies have forward vision cones and will also investigate nearby shots or melee noise.
- Your bullets down enemies instantly; melee stuns to buy time (Rhino has longer reach).
- Clear all enemies in a wave to roll into the next one; overlay shows the next wave label and lets you continue or restart.
