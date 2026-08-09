import "dotenv/config";
import { db } from "./lib/db";

async function check() {
  const users = await db.user.findMany();
  console.log("USERS IN DB:", JSON.stringify(users, null, 2));

  const devices = await db.deviceCode.findMany();
  console.log("DEVICES IN DB:", JSON.stringify(devices, null, 2));

  process.exit(0);
}

check().catch((e) => {
  console.error(e);
  process.exit(1);
});
