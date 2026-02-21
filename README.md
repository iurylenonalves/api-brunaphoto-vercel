# Bruna Alves Photography API

This is the backend API developed for Bruna Alves' photography website. It serves as the core for blog content management and contact form processing, designed to be consumed by a modern frontend.

The API was built using **Node.js** with **TypeScript** and **Express**, and is optimized for deployment on **Vercel** (Serverless Functions).

## 🚀 Technologies

- **Language:** TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL (via Prisma ORM)
- **Hosting:** Vercel (Serverless Functions)
- **File Storage:** Vercel Blob
- **Image Processing:** Sharp
- **Authentication:** Google OAuth2 + JWT
- **Payments:** Stripe Checkout + Webhooks
- **E-mail:** Nodemailer

## 🏗️ Architecture

The application follows a layered architecture (simplified Controller-Service-Repository pattern), separating responsibilities to facilitate maintenance and scalability.

### Frontend Integration
This API acts as the backend service for the **[Bruna Alves Photography Frontend](https://github.com/iurylenonalves/brunaalvesphoto-frontend)**.
Although built as a REST API, specific data structures (like the JSON Blocks for blog posts) are optimized to be consumed by the Next.js frontend components.

- **CORS Policy:** By default, it is configured to accept requests from the frontend domain (or localhost during development).

### Blog Flow
The blog system is the central component of the API.

1.  **Post Creation:**
    - The administrator (authenticated) sends post data via POST `/api/posts`.
    - Data includes: title, subtitle, locale (language), `relatedSlug` (to link translations), and content in JSON blocks (`blocks`).
    - The block structure allows for total flexibility in frontend rendering (e.g., paragraphs, interlaced images, videos).

2.  **Image Processing:**
    - When uploading an image (either via upload endpoint or during post creation, depending on implementation), the API uses the `sharp` library to process it.
    - **Optimization:** The main image is resized (max 1920px width) and converted to **WebP** format for maximum web performance.
    - **Thumbnail:** A thumbnail (max 500px width) is automatically generated (`-thumb.webp`).
    - Both versions are sent to **Vercel Blob Storage**, ensuring fast and secure delivery.

3.  **Persistence:**
    - Post metadata, slugs, and image links are persisted in PostgreSQL.
    - The `slug` field combined with `locale` ensures unique URLs for each language.

### Contact Flow
1.  The frontend contact form sends a `POST` request to `/api/contact`.
2.  The request body contains `name`, `email`, and `message`.
3.  The API validates the data and uses `Nodemailer` (configured via SMTP) to format and send an HTML email directly to the photographer's inbox.

### Payment & Booking Flow
1.  The admin manages photography packages via protected package endpoints.
2.  The frontend/admin calls `POST /api/checkout/session` to generate Stripe Checkout sessions for `FULL`, `DEPOSIT`, or `BALANCE` payments.
3.  For offline/bank transfer cases, `POST /api/checkout/manual` creates a manual booking flow.
4.  Stripe sends payment events to `POST /api/webhooks/stripe`.
5.  The API validates webhook signatures and updates booking/payment state in PostgreSQL.

### KPI Dashboard Flow
1.  Authenticated admin clients call `GET /api/dashboard/stats`.
2.  The API aggregates business metrics (revenue, payment mix, bookings, package performance).
3.  The frontend dashboard renders these KPIs for operational monitoring.

### Authentication
1.  Administrative access is restricted and performed via **Google Login**.
2.  The admin logs in on the frontend with their Google account.
3.  The frontend sends the `credential` (Google token) to `/api/auth/google`.
4.  The API verifies the token's validity and if the email belongs to the `ALLOWED_ADMINS` list.
5.  If authorized, a **JWT** (JSON Web Token) is generated and returned.
6.  Protected routes (such as creating/editing posts) require this token in the `Authorization` header.

## 📂 Project Structure

```
api-brunaphoto-vercel/
├── api/                # Entry point for Vercel Serverless Functions
├── prisma/             # Database schema and migration files
├── src/
│   ├── app.ts          # Main Express configuration and general Middlewares
│   ├── controllers/    # Control logic (receives request, calls service, returns response)
│   ├── database/       # Instantiated Prisma Client
│   ├── errors/         # Custom error classes (HttpError)
│   ├── middlewares/    # Middlewares (Auth, Upload, Validation, Error)
│   ├── routes/         # Endpoint definitions and routing (posts, auth, checkout, webhooks, packages, bookings, dashboard)
│   ├── services/       # Business logic (PostService, EmailService, StripeService, PackageService)
│   ├── utils/          # Utility functions (JWT, Vercel Blob helpers)
│   └── types.ts        # Global TypeScript type definitions
├── vercel.json         # Vercel routing and rewrites configuration
└── package.json
```

## 🛠️ Configuration and Installation

### Prerequisites
- Node.js (v18+)
- PostgreSQL (Local or remote, e.g., Neon/Supabase)

### Environment Variables (.env)
Create a `.env` file in the project root with the following keys:

```env
# Database (Prisma)
DATABASE_URL="postgresql://user:pass@host:port/db?schema=public"
DIRECT_URL="postgresql://user:pass@host:port/db?schema=public"

# Google Auth & JWT
GOOGLE_CLIENT_ID="your-google-client-id"
ALLOWED_ADMINS="admin1@email.com,admin2@email.com"
JWT_SECRET="your-super-secure-jwt-secret"

# Email Configuration (SMTP - Nodemailer)
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="user@example.com"
SMTP_PASS="password"

# Vercel Blob (Image Storage)
BLOB_READ_WRITE_TOKEN="your-vercel-blob-token"

# Stripe
STRIPE_SECRET_KEY="sk_live_or_test_xxx"
STRIPE_WEBHOOK_SECRET="whsec_xxx"
```

### Installation

1.  Clone the repository and install dependencies:
    ```bash
    npm install
    ```

2.  Generate Prisma artifacts:
    ```bash
    npx prisma generate
    ```

3.  Run migrations to create database tables:
    ```bash
    npx prisma migrate dev
    ```

4.  Start development server:
    ```bash
    npm run dev
    ```

## 📡 Main Endpoints

### Auth
- `POST /api/auth/google`: Login with Google account (validates admin and returns JWT).

### Blog (Posts)
- `GET /api/posts`: List posts (with pagination and language filters).
- `GET /api/posts/:slug`: Details of a specific post.
- `POST /api/posts`: Create post (Auth Required).
- `PUT /api/posts/:id`: Update post (Auth Required).
- `DELETE /api/posts/:id`: Delete post (Auth Required).

### Contact
- `POST /api/contact`: Send contact form.

### Packages
- `GET /api/packages`: Public package listing.
- `GET /api/packages/:id`: Public package details.
- `GET /api/packages/admin/all`: Admin package listing (Auth Required).
- `POST /api/packages`: Create package (Auth Required).
- `PUT /api/packages/:id`: Update package (Auth Required).
- `DELETE /api/packages/:id`: Delete package (Auth Required).

### Checkout & Payments
- `POST /api/checkout/session`: Create Stripe Checkout session.
- `POST /api/checkout/manual`: Create manual/bank-transfer booking.
- `POST /api/webhooks/stripe`: Stripe webhook receiver.

### Bookings (Admin)
- `GET /api/bookings`: List bookings (Auth Required).
- `POST /api/bookings/:id/confirm`: Confirm booking payment (Auth Required).
- `DELETE /api/bookings/:id`: Delete booking (Auth Required).

### Dashboard (Admin)
- `GET /api/dashboard/stats`: KPI and business metrics (Auth Required).

### Uploads
- `POST /api/uploads/image`: Single image upload (Auth Required).
- `POST /api/uploads/sign`: Signature for client-side upload (if implemented).

## 🚀 Deploy

The project is configured for continuous deployment on **Vercel**.
The `vercel.json` file ensures that all API requests are correctly directed to the serverless function.

1.  Connect the repository to Vercel.
2.  Add environment variables in the Vercel dashboard.
3.  Deploy will happen automatically on push to the `main` branch.

---
**Developed for Bruna Alves Photography**
