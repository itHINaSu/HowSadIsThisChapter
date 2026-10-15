// Long-running loop for the Docker "updater" service: rebuild the data
// now, then every UPDATE_INTERVAL_HOURS. A failed run retries after an hour.
import { buildData } from "./build-data.mjs";

const HOURS = Number(process.env.UPDATE_INTERVAL_HOURS ?? 24);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (;;) {
  let wait = HOURS;
  try {
    await buildData();
  } catch (err) {
    console.error(`Update failed: ${err.message}`);
    wait = Math.min(1, HOURS);
  }
  console.log(`Next update in ${wait}h`);
  await sleep(wait * 3600_000);
}
