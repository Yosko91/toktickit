import "dotenv/config";
import { getPrisma } from "../src/prisma.js";

// Issue 3 - the four supported IT request categories.
// upsert() keeps the seed idempotent: running it twice creates no duplicates.
const CATEGORY_NAMES = [
  "Account and Access",
  "Hardware",
  "Software",
  "Network",
];

async function main() {
  const prisma = getPrisma();

  for (const name of CATEGORY_NAMES) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const total = await prisma.category.count();
  console.log(`Seed complete - ${total} categories in database`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
