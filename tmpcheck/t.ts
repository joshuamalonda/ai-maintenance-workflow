import { resolveAgencySender } from "../src/lib/telnyx-sms.server";
console.log("Ovelo:", await resolveAgencySender("999c49b3-8833-458c-b31e-c7c038f0d370"));
console.log("B:", await resolveAgencySender("61acf813-f46f-4877-99fa-ab18e947203f"));
console.log("unknown:", await resolveAgencySender("00000000-0000-0000-0000-000000000000"));
