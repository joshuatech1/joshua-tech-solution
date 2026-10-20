# JOSHUA TECH SOLUTION

Modern IT business website for JOSHUA TECH SOLUTION with responsive UI, secure admin dashboard, backend services, and payment verification flow.

## Features
- Premium dark/blue cyber-themed design
- Services, contact, and payment pages
- Secure admin login with hashed password and session auth
- SQLite-backed data store for services, orders, and payments
- Payment verification endpoint designed to work with a real provider via environment variables
- Responsive layout for mobile, tablet, and desktop

## Run locally
1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

3. Update the admin credentials and payment settings inside `.env`.

4. Start the app:
   ```bash
   npm start
   ```

5. Open `http://localhost:3000`

## Admin login
- Email: value from `ADMIN_EMAIL`
- Password: value from `ADMIN_PASSWORD`

The application stores only the hashed password in SQLite, not the plain text version.

## Security notes
- Never place API keys or secret credentials in frontend JavaScript or public source files.
- Keep `.env` file private and do not commit real secrets.
- Payment verification must happen on the server before marking a payment as successful.

## Payment provider
The app includes a secure server-side verification flow. If `PAYMENT_PROVIDER=simulated`, it validates transaction references locally for demo/testing purposes. For production, configure a real provider using `PAYMENT_API_KEY`, `PAYMENT_SECRET_KEY`, and `PAYMENT_BASE_URL` and update the verification logic in `server.js`.

## Deployment (Render)
This repository includes a `render.yaml` file for easy deployment on Render.

1. Push this repo to GitHub.
2. Go to Render and click "New +" → "Web Service".
3. Connect the GitHub repo.
4. Render will read `render.yaml` automatically.
5. Set the required environment variables in the Render dashboard if needed:
   - `SESSION_SECRET`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `PAYMENT_PROVIDER`
   - `PAYMENT_API_KEY`
   - `PAYMENT_SECRET_KEY`
   - `PAYMENT_BASE_URL`
6. Deploy the service.

Render will use the `npm install` and `npm start` commands from the config.

## Notes for live hosting
- The SQLite database is created under `data/joshua-tech.db`.
- For a production deployment, make sure your hosting provider preserves that data directory or migrate to a managed database.
- If you want real live payments, replace the simulated verification flow with the actual provider API.
