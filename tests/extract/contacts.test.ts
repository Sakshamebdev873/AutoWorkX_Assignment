import { describe, expect, it } from "vitest";
import { extractContacts } from "../../src/extract/contacts.js";
import { fakeSnapshot } from "../helpers/snapshot.js";

describe("extractContacts", () => {
  it("extracts emails and phones from mailto/tel links and plain text", () => {
    const html = `
      <html><body>
        <a href="mailto:hello@acme.com">Email us</a>
        <a href="tel:+1-415-555-0132">Call</a>
        <p>Reach sales at sales@acme.com or (415) 555-0199.</p>
        <form><input type="email" /><textarea></textarea></form>
      </body></html>`;
    const contacts = extractContacts([fakeSnapshot({ html, category: "contact", url: "https://acme.com/contact" })]);
    expect(contacts.emails).toContain("hello@acme.com");
    expect(contacts.emails).toContain("sales@acme.com");
    expect(contacts.phones.length).toBeGreaterThan(0);
    expect(contacts.contactForms).toContain("https://acme.com/contact");
    expect(contacts.departmentContacts.find((d) => d.department === "sales")?.email).toBe("sales@acme.com");
  });

  it("ignores obviously fake/placeholder emails", () => {
    const html = `<html><body><p>test@example.com</p></body></html>`;
    const contacts = extractContacts([fakeSnapshot({ html })]);
    expect(contacts.emails).toHaveLength(0);
  });

  it("does not glue text from adjacent block elements into a bogus email", () => {
    // Regression: cheerio's .text() concatenates sibling block elements with no separator, which used to
    // merge "email" + "jane.diaz@stripe.com" + "damian.michelfelder" into one bogus compound match.
    const html = `<html><body><div>email</div><div>jane.diaz@stripe.com</div><div>damian.michelfelder</div></body></html>`;
    const contacts = extractContacts([fakeSnapshot({ html })]);
    expect(contacts.emails).toEqual(["jane.diaz@stripe.com"]);
  });
});
