# YOWLMAFFIA Web

Deze map is klaar om als webversie te gebruiken.

## Installeren

```bash
npm install
```

## Lokaal testen

```bash
npm run dev
```

## Productiebouw

```bash
npm run build
```

De web-output komt in:

```text
dist
```

## Cloudflare Pages

Gebruik deze waarden:

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`

## Belangrijk

- Voeg je web-URL later ook toe in Supabase Auth redirect URLs.
- De desktop-app blijft apart bestaan; deze map is puur voor web.
- Desktop-only dingen zoals `.yowl` import/export blijven bewust desktop-only.
