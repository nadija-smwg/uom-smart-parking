import postgres from "postgres";

const { MIGRATION_DATABASE_URL: url, BOOTSTRAP_ADMIN_EMAIL: email } = process.env;
if (!url || !email) throw new Error("Set MIGRATION_DATABASE_URL and BOOTSTRAP_ADMIN_EMAIL.");
const db = postgres(url, { max: 1, prepare: false });
try {
  await db.begin(async (tx) => {
    const [user] = await tx`select id from auth.users where lower(email)=lower(${email}) and email_confirmed_at is not null`;
    if (!user) throw new Error("Create and confirm the administrator identity in Supabase Auth first.");
    await tx`insert into app.profiles(id,name,registration,role,verified)
      values (${user.id}, 'Parking administrator', 'campus', 'admin', true)
      on conflict (id) do update set role='admin', verified=true, suspended=false`;
    await tx`insert into app.activity(actor,action,target,reason)
      values (${user.id},'account.bootstrap',${user.id},'Deployment operator bootstrap')`;
  });
  console.log("Administrator account configured.");
} finally {
  await db.end();
}
