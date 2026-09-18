import "dotenv/config";
import type { RequestedPriority, Role, TicketStatus } from "@prisma/client";
import { getPrisma } from "../src/prisma.js";
import { hashPassword } from "../src/services/password.js";
import { generateTicketNumber } from "../src/services/ticketNumber.js";

// Issue 3 (Lab 1) - the four supported IT request categories.
// upsert() keeps the seed idempotent: running it twice creates no duplicates.
const CATEGORY_NAMES = ["Account and Access", "Hardware", "Software", "Network"];

// Lab 2 - Related Systems: the specific service, application, device, or
// platform a Ticket can be about.
const RELATED_SYSTEM_NAMES = [
  "Email",
  "Campus Wi-Fi",
  "VPN",
  "LEB2 App",
  "Grade Submission App",
  "Printer",
  "Corporate Laptop",
];

/**
 * Lab 3 - the single development password for every seeded account.
 *
 * This is a local development value only. It is written here, in the README and
 * in nothing else, it is not a password used anywhere real, and no production
 * deployment would ever run this seed (specification.md section 7).
 */
const DEV_PASSWORD = "TokTick!2026";

interface SeedUser {
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  mustChangePassword?: boolean;
}

// Handout section 5.3: at least four active Requesters and one inactive, at
// least three active IT Staff and one inactive, at least one Administrator.
// The six Lab 2 Requesters are kept as-is so the migrated rows keep their ids.
const USERS: SeedUser[] = [
  { name: "Jennifer Anderson", email: "jennifer.anderson@toktickit.dev", role: "REQUESTER", isActive: true },
  { name: "Sarah Johnson", email: "sarah.johnson@toktickit.dev", role: "REQUESTER", isActive: true },
  { name: "David Lee", email: "david.lee@toktickit.dev", role: "REQUESTER", isActive: true },
  { name: "Somchai Charoensuk", email: "somchai.charoensuk@toktickit.dev", role: "REQUESTER", isActive: true },
  { name: "Nutcha Srisuwan", email: "nutcha.srisuwan@toktickit.dev", role: "REQUESTER", isActive: true },
  // Priya Nair is reserved for the My Tickets empty-state evidence: no test or
  // demo should ever create a Ticket for this Requester.
  { name: "Priya Nair", email: "priya.nair@toktickit.dev", role: "REQUESTER", isActive: true },
  { name: "Alex Turner", email: "alex.turner@toktickit.dev", role: "REQUESTER", isActive: false },
  // Reserved for demonstrating the mandatory first-login password change. The
  // seed resets the flag on every run so the demo always works (FR-04).
  { name: "Nina Sato", email: "nina.sato@toktickit.dev", role: "REQUESTER", isActive: true, mustChangePassword: true },

  { name: "Michael Brown", email: "michael.brown@toktickit.dev", role: "IT_STAFF", isActive: true },
  { name: "Emily Davis", email: "emily.davis@toktickit.dev", role: "IT_STAFF", isActive: true },
  { name: "Kwan Thongchai", email: "kwan.thongchai@toktickit.dev", role: "IT_STAFF", isActive: true },
  { name: "Robert Wilson", email: "robert.wilson@toktickit.dev", role: "IT_STAFF", isActive: false },

  // Two active Administrators: BR-35 refuses removing the last one, so a second
  // account is needed for that rule to be testable against a real refusal
  // rather than against an empty table.
  { name: "John Smith", email: "john.smith@toktickit.dev", role: "ADMINISTRATOR", isActive: true },
  { name: "Lisa Martinez", email: "lisa.martinez@toktickit.dev", role: "ADMINISTRATOR", isActive: true },
];

interface SeedTicket {
  requesterEmail: string;
  ownerEmail: string | null;
  categoryName: string;
  relatedSystemName: string;
  summary: string;
  description: string;
  requestedPriority: RequestedPriority;
  itPriority: RequestedPriority;
  currentStatus: TicketStatus;
  comments?: { authorEmail: string; body: string }[];
  notes?: { authorEmail: string; body: string }[];
}

// Spread across requesters, statuses, priorities and assigned/unassigned
// ownership so the IT Staff queue has realistic work in it on a fresh database.
const TICKETS: SeedTicket[] = [
  {
    requesterEmail: "jennifer.anderson@toktickit.dev",
    ownerEmail: "michael.brown@toktickit.dev",
    categoryName: "Hardware",
    relatedSystemName: "Corporate Laptop",
    summary: "Laptop battery drains quickly",
    description:
      "My laptop battery is draining much faster than usual even when the system is idle. This started happening after last week Windows update.",
    requestedPriority: "MEDIUM",
    itPriority: "MEDIUM",
    currentStatus: "IN_PROGRESS",
    comments: [
      { authorEmail: "michael.brown@toktickit.dev", body: "We are investigating the issue on your device. We will update you shortly." },
      { authorEmail: "jennifer.anderson@toktickit.dev", body: "Thank you for the update. Please let me know if you need any additional information." },
    ],
    notes: [
      { authorEmail: "michael.brown@toktickit.dev", body: "Battery health report shows 62 percent capacity. Ordering a replacement battery from stock." },
    ],
  },
  {
    requesterEmail: "sarah.johnson@toktickit.dev",
    ownerEmail: "emily.davis@toktickit.dev",
    categoryName: "Network",
    relatedSystemName: "VPN",
    summary: "Cannot connect to VPN from home",
    description:
      "The VPN client fails with a timeout error when I try to connect from my home network. It works normally when I am on the campus Wi-Fi.",
    requestedPriority: "HIGH",
    itPriority: "HIGH",
    currentStatus: "WAITING_FOR_REQUESTER",
    comments: [
      { authorEmail: "emily.davis@toktickit.dev", body: "Could you please tell us which internet provider you are using at home, and whether the error appears immediately or after a delay?" },
    ],
    notes: [
      { authorEmail: "emily.davis@toktickit.dev", body: "Suspect MTU mismatch on the provider router. Waiting for the requester before escalating to the network team." },
    ],
  },
  {
    requesterEmail: "david.lee@toktickit.dev",
    ownerEmail: null,
    categoryName: "Software",
    relatedSystemName: "Email",
    summary: "Email not syncing on mobile device",
    description:
      "Email stopped syncing on my phone three days ago. The desktop client still receives messages normally, so the account itself seems fine.",
    requestedPriority: "MEDIUM",
    itPriority: "MEDIUM",
    currentStatus: "NEW",
  },
  {
    requesterEmail: "somchai.charoensuk@toktickit.dev",
    ownerEmail: null,
    categoryName: "Account and Access",
    relatedSystemName: "LEB2 App",
    summary: "New employee setup request",
    description:
      "A new team member starts on Monday and needs an account created with access to the LEB2 application and the shared department folder.",
    requestedPriority: "LOW",
    itPriority: "LOW",
    currentStatus: "NEW",
  },
  {
    requesterEmail: "nutcha.srisuwan@toktickit.dev",
    ownerEmail: "kwan.thongchai@toktickit.dev",
    categoryName: "Hardware",
    relatedSystemName: "Printer",
    summary: "Printer keeps showing offline",
    description:
      "The shared printer on the second floor shows as offline for everybody in the office, even after restarting it and reinstalling the driver.",
    requestedPriority: "MEDIUM",
    itPriority: "HIGH",
    currentStatus: "OPEN",
    notes: [
      { authorEmail: "kwan.thongchai@toktickit.dev", body: "Raised the IT priority above what was requested: this one printer blocks the whole floor, not one person." },
    ],
  },
  {
    requesterEmail: "jennifer.anderson@toktickit.dev",
    ownerEmail: "michael.brown@toktickit.dev",
    categoryName: "Software",
    relatedSystemName: "Grade Submission App",
    summary: "Grade submission page freezes on save",
    description:
      "The grade submission page freezes when I press save with more than about fifty students in the list. Smaller classes save without any problem.",
    requestedPriority: "HIGH",
    itPriority: "HIGH",
    currentStatus: "RESOLVED",
    comments: [
      { authorEmail: "michael.brown@toktickit.dev", body: "A fix has been deployed for the save timeout. Please try again and tell us if the problem is gone." },
    ],
  },
  {
    requesterEmail: "david.lee@toktickit.dev",
    ownerEmail: "emily.davis@toktickit.dev",
    categoryName: "Network",
    relatedSystemName: "Campus Wi-Fi",
    summary: "Wi-Fi drops in the library basement",
    description:
      "The campus Wi-Fi disconnects roughly every ten minutes in the library basement. Other floors are stable, so it looks like a coverage problem.",
    requestedPriority: "LOW",
    itPriority: "MEDIUM",
    currentStatus: "CLOSED",
  },
  {
    requesterEmail: "sarah.johnson@toktickit.dev",
    ownerEmail: null,
    categoryName: "Account and Access",
    relatedSystemName: "Email",
    summary: "Request access to the shared mailbox",
    description:
      "Please give me read and send access to the department shared mailbox. My manager has approved this request by email already.",
    requestedPriority: "LOW",
    itPriority: "LOW",
    currentStatus: "NEW",
  },
];

async function main() {
  const prisma = getPrisma();

  for (const name of CATEGORY_NAMES) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }

  for (const name of RELATED_SYSTEM_NAMES) {
    await prisma.relatedSystem.upsert({ where: { name }, update: {}, create: { name } });
  }

  // BR-40: the migration gave existing accounts a placeholder hash that no
  // password can produce. The seed is what actually makes them usable, by
  // setting the documented development password on every seeded account.
  const passwordHash = await hashPassword(DEV_PASSWORD);

  for (const user of USERS) {
    const data = {
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      passwordHash,
      mustChangePassword: user.mustChangePassword ?? false,
    };
    await prisma.user.upsert({
      where: { email: user.email },
      update: data,
      create: { ...data, email: user.email },
    });
  }

  const userIdByEmail = new Map(
    (await prisma.user.findMany({ select: { id: true, email: true } })).map((u) => [u.email, u.id])
  );
  const categoryIdByName = new Map(
    (await prisma.category.findMany({ select: { id: true, name: true } })).map((c) => [c.name, c.id])
  );
  const systemIdByName = new Map(
    (await prisma.relatedSystem.findMany({ select: { id: true, name: true } })).map((s) => [s.name, s.id])
  );

  // Idempotency for tickets: the summary is the natural key here, because the
  // ticket number comes from a sequence and would differ on every run.
  for (const ticket of TICKETS) {
    const existing = await prisma.ticket.findFirst({ where: { summary: ticket.summary } });
    if (existing) continue;

    const created = await prisma.ticket.create({
      data: {
        ticketNumber: await generateTicketNumber(),
        requesterId: userIdByEmail.get(ticket.requesterEmail)!,
        ownerId: ticket.ownerEmail ? userIdByEmail.get(ticket.ownerEmail)! : null,
        categoryId: categoryIdByName.get(ticket.categoryName)!,
        relatedSystemId: systemIdByName.get(ticket.relatedSystemName)!,
        summary: ticket.summary,
        description: ticket.description,
        requestedPriority: ticket.requestedPriority,
        itPriority: ticket.itPriority,
        currentStatus: ticket.currentStatus,
      },
    });

    for (const comment of ticket.comments ?? []) {
      await prisma.publicComment.create({
        data: {
          ticketId: created.id,
          authorId: userIdByEmail.get(comment.authorEmail)!,
          body: comment.body,
        },
      });
    }
    for (const note of ticket.notes ?? []) {
      await prisma.internalNote.create({
        data: {
          ticketId: created.id,
          authorId: userIdByEmail.get(note.authorEmail)!,
          body: note.body,
        },
      });
    }
  }

  const [users, requesters, staff, admins, tickets, comments, notes] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "REQUESTER" } }),
    prisma.user.count({ where: { role: "IT_STAFF" } }),
    prisma.user.count({ where: { role: "ADMINISTRATOR" } }),
    prisma.ticket.count(),
    prisma.publicComment.count(),
    prisma.internalNote.count(),
  ]);

  console.log(
    `Seed complete - ${users} users (${requesters} requesters, ${staff} IT staff, ${admins} administrators), ` +
      `${tickets} tickets, ${comments} public comments, ${notes} internal notes. ` +
      `Development password for every seeded account: ${DEV_PASSWORD}`
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
