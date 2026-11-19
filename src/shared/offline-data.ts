// What the client keeps of the last loaded data, for opening the app offline
// (src/client/offline-data.ts), and the version of its shape. A copy kept under another
// version is thrown away instead of misread: one from before a field existed would crash
// whatever reads that field. test/offline-data.test.ts fails when these schemas change
// without a new version.

import { Me } from "./auth.ts";
import { CheckIn } from "./check-ins.ts";
import { ThisDeviceReminder } from "./reminders.ts";
import { FamilyUsers } from "./users.ts";

/** Bump whenever the shape of the kept data changes. */
export const OFFLINE_DATA_VERSION = "2";

/** The answers the client keeps, by what it asks for. Add any newly kept one here. */
export const OFFLINE_DATA_SCHEMAS = {
  me: Me,
  checkIns: CheckIn,
  users: FamilyUsers,
  reminder: ThisDeviceReminder,
};
