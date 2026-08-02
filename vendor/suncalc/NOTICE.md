# SunCalc — vendored

`suncalc.js` is the **unmodified** source of SunCalc by Volodymyr Agafonkin
(mourner), copied verbatim from:

- Repo: <https://github.com/mourner/suncalc>

BSD-2-Clause licensed (see `LICENSE`).

Used for exactly one thing: `getMoonIllumination(date)`, which needs no
location - it returns the moon's currently illuminated fraction, phase
(0=new, 0.5=full), and whether it's waxing or waning, computed from pure
astronomical formulas (Meeus). No network request, no API key, runs entirely
client-side. See `widgets/constellation.js` for how the fraction/waxing pair
gets turned into a light direction for the 3D moon.
