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
