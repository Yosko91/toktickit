import "dotenv/config";
import { getPrisma } from "../src/prisma.js";

// Issue 3 (Lab 1) - the four supported IT request categories.
// upsert() keeps the seed idempotent: running it twice creates no duplicates.
const CATEGORY_NAMES = [
  "Account and Access",
  "Hardware",
  "Software",
  "Network",
];

// Lab 2 - Related Systems: the specific service, application, device, or
// platform a Ticket can be about (handout section 5.3 example list).
const RELATED_SYSTEM_NAMES = [
  "Email",
  "Campus Wi-Fi",
  "VPN",
  "LEB2 App",
  "Grade Submission App",
  "Printer",
  "Corporate Laptop",
];

// Lab 2 - Development Requesters (BR-05): a temporary, non-authenticated
// testing identity. Five active + one inactive, so the "inactive requesters
// never appear in the selector" rule (BR-06/BR-30) has real seed data to
// prove it against. Priya Nair is reserved for the My Tickets empty-state
// evidence (docs/lab-02/ui-spec.md section 14) - no test or demo script
// should ever create a Ticket for this Requester.
const REQUESTERS: { name: string; email: string; isActive: boolean }[] = [
  { name: "Jennifer Anderson", email: "jennifer.anderson@toktickit.dev", isActive: true },
  { name: "Sarah Johnson", email: "sarah.johnson@toktickit.dev", isActive: true },
  { name: "David Lee", email: "david.lee@toktickit.dev", isActive: true },
  { name: "Somchai Charoensuk", email: "somchai.charoensuk@toktickit.dev", isActive: true },
  { name: "Nutcha Srisuwan", email: "nutcha.srisuwan@toktickit.dev", isActive: true },
  { name: "Priya Nair", email: "priya.nair@toktickit.dev", isActive: true },
  { name: "Alex Turner", email: "alex.turner@toktickit.dev", isActive: false },
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

  for (const name of RELATED_SYSTEM_NAMES) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  for (const requester of REQUESTERS) {
    await prisma.requesterUser.upsert({
      where: { email: requester.email },
      update: {},
      create: requester,
    });
  }

  const [categoryCount, relatedSystemCount, requesterCount, activeRequesterCount] =
    await Promise.all([
      prisma.category.count(),
      prisma.relatedSystem.count(),
      prisma.requesterUser.count(),
      prisma.requesterUser.count({ where: { isActive: true } }),
    ]);

  console.log(
    `Seed complete - ${categoryCount} categories, ${relatedSystemCount} related systems, ` +
      `${requesterCount} requesters (${activeRequesterCount} active) in database`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
