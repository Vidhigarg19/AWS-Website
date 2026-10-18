// ============================================================
// Create (or promote) an admin user.
//
//   node scripts/create-admin-user.mjs <email> [password]
//
// - New user + no password given  → a random password is generated and
//   printed ONCE. Store it in a password manager.
// - Existing user                 → password is left UNCHANGED unless you
//   pass one explicitly.
// - In every case the user is added to public.admin_users, which is what
//   actually grants admin access (not user_metadata).
// ============================================================
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
// The app uses SUPABASE_SECRET_KEY; the old script name is kept as a fallback.
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createAdmin() {
  const email = process.argv[2];
  const passwordArg = process.argv[3];

  if (!email) {
    console.error("Usage: node scripts/create-admin-user.mjs <email> [password]");
    process.exit(1);
  }

  console.log(`Creating / promoting admin user: ${email}...`);

  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    console.error("Error listing users:", listError.message);
    process.exit(1);
  }

  const existing = usersData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  let userId;
  let printedPassword = null;

  if (existing) {
    userId = existing.id;
    if (passwordArg) {
      const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
        password: passwordArg,
        email_confirm: true,
      });
      if (updateError) {
        console.error("Failed to update user:", updateError.message);
        process.exit(1);
      }
      console.log("Password updated to the value you supplied.");
    } else {
      console.log("User already exists. Password left unchanged.");
    }
  } else {
    const password = passwordArg || randomBytes(18).toString("base64url");
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // auto-confirm so no verification link is needed
    });
    if (error) {
      console.error("Failed to create user:", error.message);
      process.exit(1);
    }
    userId = data.user.id;
    if (!passwordArg) printedPassword = password;
  }

  // The row in admin_users is the source of truth for admin access.
  const { error: adminError } = await supabase
    .from("admin_users")
    .upsert({ id: userId, role: "super_admin" }, { onConflict: "id" });

  if (adminError) {
    console.error(
      "User exists in Auth but could not be added to admin_users:",
      adminError.message,
      "\nHave you applied supabase/migrations/20261017000001_admin_users.sql?"
    );
    process.exit(1);
  }

  console.log("Admin ready.");
  console.log("----------------------------------------");
  console.log(`Email: ${email}`);
  if (printedPassword) {
    console.log(`Generated password (shown once): ${printedPassword}`);
  }
  console.log("----------------------------------------");
}

createAdmin();
