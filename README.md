# Vasthrapetty

Vasthrapetty storefront and authenticated admin workspace.

## Stack

- Next.js App Router + TypeScript
- Supabase PostgreSQL, Auth and Storage
- Server-side enquiry submission through a validated PostgreSQL function
- Supabase Row Level Security for catalogue and admin access

## Local setup

1. Install Node.js 20.9 or later.
2. Clone this repository and run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Run `npm run dev` and open `http://localhost:3000`.

The supplied URL and publishable key are public application credentials. Never add a Supabase secret/service-role key, database password, customer data or `.env.local` to Git.

## Supabase database setup

1. Open the Vasthrapetty Supabase project.
2. Open **SQL Editor**.
3. Run the complete migration at `supabase/migrations/0001_initial_schema.sql`.
4. The migration creates categories, products, product_images, customers, enquiries, enquiry_items, enquiry_addons, activity_log and admin_users.
5. It also creates the public `product-images` Storage bucket, upload policies, Row Level Security rules and the atomic `submit_enquiry(jsonb)` function.

The customer enquiry endpoint validates the submitted payload and calls `submit_enquiry`. That function creates the customer, enquiry, selected product snapshot, add-ons and activity record in a single database transaction. The UI only displays the success confirmation after the database returns a successful enquiry ID.

## Enable the first admin user

1. In Supabase, open **Authentication → Users** and create an admin user with an email and password.
2. Copy that user's UUID from the users list.
3. In **SQL Editor**, execute the following statement, replacing the UUID:

```sql
insert into public.admin_users (user_id)
values ('YOUR-AUTH-USER-UUID');
```

4. Open `/admin` on the website and sign in with that email and password.

Only UUIDs explicitly present in `public.admin_users` are authorised to use catalogue and enquiry management. Admin database and Storage mutations are protected by RLS.

## Catalogue management

From `/admin`, an authorised admin can add a product, set a description, category, INR price, upload multiple JPG/PNG/WebP images (maximum 5 MB per image), and publish or draft the product. Image bytes are stored in Supabase Storage; image metadata and paths are stored in PostgreSQL. Published products appear in the storefront catalogue automatically.

## Customer enquiries

The six-step enquiry journey preserves the requested order:
1. Preferred hamper budget (Question 2)
2. Delivery date and address/location
3. Occasion (Question 1)
4. Browse published hampers (Question 3)
5. Custom hamper additions (Question 4)
6. Customer contact details

All form questions remain optional. The enquiry record retains the original submitted payload as JSONB in addition to queryable fields and related selected products/add-ons. Delivery coordinates are stored when the customer chooses an address suggestion.

## Deployment

Deploy the repository to a Next.js host such as Vercel. Add these environment variables in the deployment project settings:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Do not configure a secret/service-role key for the current flows: the public enquiry function and admin RLS are designed to operate without exposing a privileged key.

## Production hardening still recommended

Before broad public launch, add an edge/WAF rate limit and bot protection to the public enquiry endpoint, configure Supabase Auth site URL and redirect URLs for the deployed domain, and verify database backups and retention settings. The address suggestion UI uses the public Nominatim service; review its usage policy and switch to a suitable hosted geocoding service if traffic grows.
