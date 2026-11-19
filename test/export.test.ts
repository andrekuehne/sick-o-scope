import { expect, it } from "vitest";
import { api, json, signedIn } from "./helpers.ts";

async function addMember(familyId: string, cookie: string, name: string) {
  return json<{ id: string }>(
    api(`/api/families/${familyId}/members`, { method: "POST", body: { name, emoji: "🦊", colour: "#ff7a59" }, cookie }),
  );
}

async function checkIn(familyId: string, cookie: string, memberId: string, date: string, state: object) {
  const res = await api(`/api/families/${familyId}/check-ins/${date}/${memberId}`, { method: "PUT", body: state, cookie });
  expect(res.status).toBe(200);
}

it("exports exactly the Family's Check-ins as a CSV that spreadsheet apps read correctly", async () => {
  const a = await signedIn({ familyName: "Familie Kühne", userName: "André" });
  const b = await signedIn({ familyName: "Familie Bauer", userName: "Bert" });
  const luna = await addMember(a.familyId, a.cookie, "Luna");
  const joerg = await addMember(a.familyId, a.cookie, "Jörg");
  const ben = await addMember(b.familyId, b.cookie, "Ben");
  await checkIn(a.familyId, a.cookie, luna.id, "2026-11-14", {
    status: "sick",
    severity: 3,
    symptoms: ["fever", "cough"],
    medications: ["ibuprofen", "paracetamol"],
    note: 'Fieber 39,2; nachts "schlimm"\nmorgens besser',
  });
  await checkIn(a.familyId, a.cookie, joerg.id, "2026-11-14", { status: "healthy", note: "- schon wieder fit" });
  await checkIn(a.familyId, a.cookie, luna.id, "2026-11-13", { status: "healthy" });
  // Last Season's Bug, still going on 1 Sep, keeps last Season's number; then two new ones.
  await checkIn(a.familyId, a.cookie, joerg.id, "2026-08-31", { status: "sick", severity: 2 });
  await checkIn(a.familyId, a.cookie, joerg.id, "2026-09-01", { status: "sick", severity: 1 });
  await checkIn(a.familyId, a.cookie, joerg.id, "2026-09-03", { status: "sick", severity: 4, newBug: true });
  await checkIn(a.familyId, a.cookie, joerg.id, "2026-09-04", { status: "healthy" });
  await checkIn(a.familyId, a.cookie, joerg.id, "2026-10-20", { status: "sick", severity: 0, symptoms: ["runny-nose"], medications: ["nasal-spray"] });
  await checkIn(b.familyId, b.cookie, ben.id, "2026-11-14", { status: "sick", severity: 5 });

  const res = await api(`/api/families/${a.familyId}/export.csv`, { cookie: a.cookie });
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
  expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="sick-o-scope-\d{4}-\d{2}-\d{2}\.csv"$/);

  const bytes = new Uint8Array(await res.arrayBuffer());
  // The byte order mark, so Excel reads the file as UTF-8 (umlauts and emoji).
  expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const csv = new TextDecoder().decode(bytes.slice(3));
  const at = "\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}";
  expect(csv).toMatch(
    new RegExp(
      [
        "^Datum;Familienmitglied;Status;Schweregrad;Symptome;Medikamente;Infekt;Notiz;Geändert von;Geändert am \\(UTC\\)",
        // Each Sick day names its Bug: its Season and number there.
        `2026-08-31;Jörg;Krank;2;;;2025/26 #1;;André;${at}`,
        `2026-09-01;Jörg;Krank;1;;;2025/26 #1;;André;${at}`,
        `2026-09-03;Jörg;Krank;4;;;2026/27 #1;;André;${at}`,
        `2026-09-04;Jörg;Fit;;;;;;André;${at}`,
        `2026-10-20;Jörg;Krank;0;Schnupfen;Nasenspray;2026/27 #2;;André;${at}`,
        `2026-11-13;Luna;Fit;;;;;;André;${at}`,
        // Semicolons, commas (for apps that split on them), quotes and line breaks stay inside one quoted field.
        `2026-11-14;Luna;Krank;3;"Husten, Fieber";"Paracetamol, Ibuprofen";2026/27 #1;"Fieber 39,2; nachts ""schlimm""\nmorgens besser";André;${at}`,
        // A note starting like a formula stays text.
        `2026-11-14;Jörg;Fit;;;;;'- schon wieder fit;André;${at}`,
        "$",
      ].join("\r\n"),
    ),
  );

  // Another Family's export is out of reach.
  expect((await api(`/api/families/${a.familyId}/export.csv`, { cookie: b.cookie })).status).toBe(404);
});
