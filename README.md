# Product animation site

This is a static website for GitHub Pages. Supabase provides the shared database and image storage, so products added on one device appear when the site is opened on another.

## One-time setup

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. In the Supabase dashboard, open **SQL Editor**, paste in `supabase-schema.sql`, and run it.
3. In **Project Settings → API**, copy the **Project URL** and the public **publishable/anon key**.
4. Open `supabase-config.js` in Notepad++ and replace both placeholder values. Never use a `service_role` or secret key in this file.
5. Upload the site files to a GitHub repository, then enable **Settings → Pages** for that repository.

The supplied policies intentionally let any visitor view, add, edit, and delete products and images. That is required for public editing, but anyone with the website link can change the shared library.

The site will show a setup error until a Supabase project is configured and the SQL has been run.
