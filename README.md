# FORK OF Bytewatch Stremio Addon
##Big thanks for original creator

##Za lokalno korišćenje

-pokrenite start.cmd
-idite na stremio - addon - U polju za pretragu addona kopirajte http://127.0.0.1:7000/manifest.json
-instalirajte addon
-crtace mozete naci u sekciji "otkri"
-U tabu otkri umesto kategorije npr. "popularno" skrolujte i izaberite kategoriju "gledaj crtace"
-U podkategoriji umesto "TOP" mozete, ali i ne morate izabrati Filmovi/Serije

Ako zelite da hostujete mozete koristiti "Vercel" ili nešto slično, uputstva imate ispod na engleskom

##VAZNO

-addon je fajb kodovan, tkd ako nešto ne radi JBG :/
-Nisam siguran da svi crtaci rade posebno oni stariji, tako da ponekad moze da bude hit or miss

A Node.js-powered Stremio addon that scrapes https://gledajcrtace.org using Puppeteer. It integrates it into the Stremio ecosystem through a single stream handler.

---

## Features

- Scrapes multiple providers from a single file
- Real browser scraping via `puppeteer-real-browser`
- Stremio addon-compatible manifest & stream handler
- Caching using `node-cache`

---

## Project Structure

```
bytewatch-stremio-addon/
│
├── index.js                # Entry point: defines manifest and stream handler
├── unified-extractor.js   # Centralized scraper logic for multiple providers
├── logger.js              # Logger setup using Winston
├── package.json           # Metadata and dependencies
└── README.md              # Documentation
```

---

## Requirements

### To Run Locally

- Node.js v18+ recommended
- npm (Node package manager)
- At least 1GB RAM (Puppeteer launches a browser)

### To Run Remotly 
 - A free Github account
 - A free render account OR a free vercel account

---

## Installation (Local Development)

-Na ovom forku možete samo da pokrenete start.cmd kada klonirate respository I sve ostalo ce se srediti samo,
-posle toga samo kopirate adresu u sremio addon

1. **Clone the repository**
   ```bash
   git clone https://github.com/93bx/bytewatch-stremio-addon.git
   cd bytewatch-stremio-addon
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the addon**
   ```bash
   node index.js
   ```

4. **Test locally**
   Open your browser: (najverivatnije ne radi preko browsera)
   ```
   http://localhost:7000/manifest.json
   ```

5. **Add it to Stremio**
   - Open Stremio desktop app
   - Go to: **Add-ons > Paste the URL in the search bar**
   

There are currently two such clients that you can test with:
    Stremio v4.4.10+
    Stremio Web Version
Note: if you want to load an addon by URL in Stremio, the URL must either be accessed on 127.0.0.1 or support HTTPS.

## Installation (Remote)

## 🚀 Deploy Your Own Instance (One-Click)

### Manual Deployment Options

#### Deploy to Render Manually
1. Sign up at [render.com](https://render.com)
2. Click "New Web Service"
3. Click "Public Git Repository" and paste the Github link > (https://github.com/Stefma4Git/Gledaj-crtace-addon) 
4. Set environment variable: `PORT = 10000`
5. Deploy!

#### Deploy to Vercel Manually
1. Fork this repository
2. Sign up at [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your forked repository
5. The environment variables will be set automatically from vercel.json
6. Deploy!

After deploying the app, paste the deployment URL in Stremio's searchbar to add it.

---

## Notes

- the scraper is defined in `unified-extractor.js`.
- Logs will print to console using Winston (with timestamp and levels).
- Caching is in-memory using `node-cache` to improve performance and avoid repeat scraping.
- Puppeteer requires a headless-compatible environment — avoid deploying on memory-constrained VMs without swap.

---

## License

ISC License. Use freely and modify as needed.
-Ja nisam dodao/stavio licencu
