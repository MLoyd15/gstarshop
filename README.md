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

Password reset codes are six digits, expire after 10 minutes, and are limited to five guesses. To send them through Gmail, enable 2-Step Verification on the sending Google account and create an App Password. Add `MAIL_USER` and `MAIL_APP_PASSWORD` to `.env` and restart the server. Do not use your normal Google password. Gmail App Passwords require 2-Step Verification; for a production deployment, use a transactional email provider if Gmail SMTP is unavailable or unsuitable.
