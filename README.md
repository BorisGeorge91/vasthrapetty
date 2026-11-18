# Vasthrapetty

Vasthrapetty storefront and admin application.

## Stack

- Next.js App Router + TypeScript
- Supabase PostgreSQL, Auth and Storage
- Server-side data access with Supabase SSR

## Local setup

1. Install Node.js 20.9 or later.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and fill in the Supabase project URL and publishable key.
4. Run `npm run dev`.

## Database setup

Apply `supabase/migrations/0001_initial_schema.sql` to the Supabase project's SQL Editor or using the Supabase CLI. The migration creates categories, products, product_images, customers, enquiries, enquiry_items, enquiry_addons and activity_log, plus indexes and row-level security.

Create a private Storage bucket named `product-images` before enabling catalogue uploads. Storage policies and admin authorization will be added alongside the authenticated admin module.

## Security notes

- Never commit `.env.local`, a Supabase secret key, service-role key, database password, or customer data.
- Public database reads are limited to published catalogue products and their images.
- Enquiry submission and admin mutations must be implemented through server-side endpoints with input validation, rate limiting and an admin allowlist.
- The initial schema intentionally does not add a public policy to insert or read customer enquiries.

## Delivery status

This is the initial application foundation. The existing static HTML prototype has not yet been migrated in full. Enquiry submission, admin authentication, catalogue management UI, upload flow and deployment configuration are the next build phases.
