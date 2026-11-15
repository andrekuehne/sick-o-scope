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
    note: 'Fieber 39,2; nachts "schlimm"\nmorgens besser',
  });
  await checkIn(a.familyId, a.cookie, joerg.id, "2026-11-14", { status: "healthy", note: "- schon wieder fit" });
  await checkIn(a.familyId, a.cookie, luna.id, "2026-11-13", { status: "healthy" });
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
        "^Datum;Familienmitglied;Status;Schweregrad;Symptome;Notiz;Geändert von;Geändert am \\(UTC\\)",
        `2026-11-13;Luna;Fit;;;;André;${at}`,
        // Semicolons, commas (for apps that split on them), quotes and line breaks stay inside one quoted field.
        `2026-11-14;Luna;Krank;3;"Husten, Fieber";"Fieber 39,2; nachts ""schlimm""\nmorgens besser";André;${at}`,
        // A note starting like a formula stays text.
        `2026-11-14;Jörg;Fit;;;'- schon wieder fit;André;${at}`,
        "$",
      ].join("\r\n"),
    ),
  );

  // Another Family's export is out of reach.
  expect((await api(`/api/families/${a.familyId}/export.csv`, { cookie: b.cookie })).status).toBe(404);
});
