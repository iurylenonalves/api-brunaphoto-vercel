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
- **E-mail:** Nodemailer

## 🏗️ Architecture

The application follows a layered architecture (simplified Controller-Service-Repository pattern), separating responsibilities to facilitate maintenance and scalability.

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
│   ├── routes/         # Endpoint definitions and routing
│   ├── services/       # Business logic (PostService, EmailService)
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
