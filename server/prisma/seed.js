const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const settings = [
    { label: "multi_user_mode", value: "true" },
    { label: "limit_user_messages", value: "false" },
    { label: "message_limit", value: "25" },
    { label: "logo_filename", value: "doclegis-logo.png" },
    { label: "custom_app_name", value: "DocLegis" },
    { label: "support_email", value: "info@axistech.it" },
    { label: "meta_page_title", value: "DocLegis" }

  ];

  for (let setting of settings) {
    const existing = await prisma.system_settings.findUnique({
      where: { label: setting.label },
    });

    // Only create the setting if it doesn't already exist
    if (!existing) {
      await prisma.system_settings.create({
        data: setting,
      });
    }
  }

  // Seeding admin user
  const adminUser = await prisma.users.findUnique({
    where: { username: "admin" },
  });

  if (!adminUser) {
    await prisma.users.create({
      data: {
        id: 1,
        username: "admin",
        password: "$2b$10$6RRuamd/bC3N3z9A8VhGbe7WCLlt3OHvdRcZIZf3kkxA/PjVe1pEm", // Hashed password (admin123)
        role: "admin",
        seen_recovery_codes: true,
        createdAt: new Date("2024-10-21 08:40:18.711"),
        lastUpdatedAt: new Date("2024-10-21 08:40:18.711"),
      },
    });
  } else {
    console.log("Admin user already exists, skipping creation.");
  }

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
