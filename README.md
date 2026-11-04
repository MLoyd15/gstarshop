# G4 Sticker

A responsive product and business dashboard for G4 Sticker, built with React, Node.js, Express, and MongoDB.

## Requirements

- Node.js 18 or newer
- MongoDB running locally, or a MongoDB connection string

## Getting started

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set `MONGODB_URI` to your MongoDB connection string.
3. Start MongoDB, then run `npm run dev`.
4. Open the Vite URL shown in the terminal (usually `http://localhost:5173`).

The Express API runs on port 4000 by default. To build the frontend, run `npm run build`; `npm start` starts the API server.

## Data

Supplier, product, inventory, price, purchase, booking, scheduler, income, expense, profit, shareholder, Excel sheet, money tracker, and notepad entries are stored in the `businessrecords` MongoDB collection. Records can be added, edited, searched, and deleted from their workspace pages. Product categories include Sticker, Cap, Mug, and Tarpaulin. The Inventory page shows the stock quantity for every product; update a product's quantity from Products. Items with five or fewer units are marked low stock, and zero units are marked out of stock.

## Sign in

Set `SESSION_SECRET` in `.env` to a unique random value of at least 32 characters. Set `COOKIE_SECURE=true` when serving the app over HTTPS. Create an account using **Create an account** on the sign-in page; passwords must be at least 12 characters. New accounts can access the shared workspace. To create or reset an administrator account from the command line, run `npm run reset-password -- admin@example.com "a-long-password" "Admin Name"`.

### Google sign-in

In Google Cloud Console, configure the OAuth consent screen/branding and create an OAuth client with application type **Web application**. Add `http://localhost`, `http://localhost:5173`, and your deployed site origin under **Authorized JavaScript origins**. This sign-in button uses Google's identity token; it does not need Gmail API access, a client secret, or an OAuth redirect URI. Copy the client ID into both `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID` in `.env`, then restart the server and Vite. The backend verifies Google's token before creating the app session. Google accounts must have a verified Gmail or Google Workspace email.

### Password reset email

Password reset codes are six digits, expire after 10 minutes, and are limited to five guesses. Password-reset emails are sent using the Brevo HTTPS API. Create a Brevo account, verify the sender email address, and set `BREVO_API_KEY` and `BREVO_SENDER_EMAIL` in the server environment.

## Deploying

The application can be deployed as a single unified service where the Express backend serves both API endpoints (`/api/*`) and the built React frontend (`dist/`).

### Commands

- **Build command**: `npm install && npm run build`
- **Start command**: `npm start`

### Required Environment Variables

Configure these variables in your hosting provider's dashboard (e.g. Render, Railway, Heroku, VPS):

| Variable | Type | Purpose | Example |
| :--- | :--- | :--- | :--- |
| `PORT` | Runtime | Port the server listens on (cloud hosts like Render provide this automatically) | `4000` |
| `MONGODB_URI` | Runtime | MongoDB Atlas connection string | `mongodb+srv://<user>:<password>@cluster.mongodb.net/gstarshop?retryWrites=true&w=majority` |
| `SESSION_SECRET` | Runtime | Secret key for signing sessions and reset tokens (min. 32 random characters) | `a-very-long-random-string-at-least-32-chars` |
| `COOKIE_SECURE` | Runtime | Set to `true` when serving over HTTPS so the session cookie carries the `Secure` flag | `true` |
| `CLIENT_URL` | Runtime | Allowed CORS origin (set to your public production URL, e.g. `https://your-domain.com`) | `https://your-domain.com` |
| `GOOGLE_CLIENT_ID` | Runtime | Google OAuth 2.0 Web Client ID for backend token verification | `123456...apps.googleusercontent.com` |
| `VITE_GOOGLE_CLIENT_ID` | Build-time | Google OAuth 2.0 Web Client ID embedded into frontend at build time (must match `GOOGLE_CLIENT_ID`) | `123456...apps.googleusercontent.com` |
| `BREVO_API_KEY` | Runtime | Brevo API key for password-reset email delivery over HTTPS | `xkeysib-...` |
| `BREVO_SENDER_EMAIL` | Runtime | Sender email address verified in Brevo | `no-reply@example.com` |

> **Note on Build-time Variables**: `VITE_GOOGLE_CLIENT_ID` is baked into client assets during `npm run build`. Ensure it is present during your hosting platform's build phase.

### Render backend with Vercel frontend

The repository includes a Render Blueprint in `render.yaml` for the Express API. In Render, create a new Blueprint from this repository and branch. Enter `MONGODB_URI` using the `gstarshop_app` database user and the `gstarshop` database. `CLIENT_URL` is set to the public Vercel frontend origin; Render generates `SESSION_SECRET`, and `COOKIE_SECURE` is enabled for HTTPS.

The Blueprint uses Render's free web-service plan, which may spin down while idle. After the Render service is created, update the `/api/(.*)` rewrite in `vercel.json` to proxy to the service's `https://<service-name>.onrender.com/api/$1` URL. Keep that API rewrite before the SPA catch-all rewrite, then redeploy Vercel. Do not commit credentials or put secrets in `render.yaml`.

Optional runtime settings such as `GOOGLE_CLIENT_ID`, `BREVO_API_KEY`, and `BREVO_SENDER_EMAIL` can be added in Render if those features are needed. `VITE_GOOGLE_CLIENT_ID` belongs in Vercel's build environment because Vercel builds the frontend.

### MongoDB Atlas Network Access

1. Log in to [MongoDB Atlas](https://cloud.mongodb.com/).
2. Navigate to **Security > Network Access**.
3. Click **Add IP Address**.
4. If deploying to cloud platforms with dynamic IP ranges (e.g., Render, Railway, Heroku), select **Allow Access from Anywhere** (`0.0.0.0/0`) or configure your platform's static egress IP addresses if available.
5. Under **Database Access**, verify that your database user has read and write privileges for the target database.

### Google OAuth Configuration

1. In the [Google Cloud Console](https://console.cloud.google.com/), navigate to **APIs & Services > Credentials**.
2. Open your OAuth 2.0 Web Client ID.
3. Under **Authorized JavaScript origins**, add your deployed production URL without trailing slashes (e.g., `https://your-domain.com`), alongside `http://localhost` and `http://localhost:5173`.
4. Save the changes (updates may take a few minutes to propagate on Google's servers).
