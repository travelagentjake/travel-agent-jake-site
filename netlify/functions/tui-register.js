// Netlify Function: receives the TUI Summer 2028 registration form submission,
// creates/updates the contact in Brevo with all the custom attributes and adds
// them to the general mailing list, then sends the "you're registered, book
// your priority appointment" confirmation email via the existing Brevo
// transactional template (id 10).
//
// Requires the BREVO_API_KEY environment variable to be set in Netlify's
// site configuration (Site settings -> Environment variables).

const BREVO_LIST_ID = 3; // "Travel Agent Jake - All"
const BREVO_TEMPLATE_ID = 10; // "TUI Summer 2028 - Priority Access Confirmation"

const REQUIRED_FIELDS = [
  "FIRSTNAME",
  "LASTNAME",
  "EMAIL",
  "MOBILE",
  "DOB",
  "ADDRESS",
  "DEPARTURE_AIRPORT",
  "DESTINATION_WANTED",
  "TRAVEL_DATES",
  "BUDGET",
  "DEPOSIT_READY",
];

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error("BREVO_API_KEY is not set in the environment");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server is not configured yet. Please try again later or contact Jake directly." }),
    };
  }

  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  for (const field of REQUIRED_FIELDS) {
    if (!data[field] || String(data[field]).trim() === "") {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing required field: " + field }) };
    }
  }
  if (!isValidEmail(data.EMAIL)) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid email address" }) };
  }

  const adults = parseInt(data.ADULTS, 10);
  const children = parseInt(data.CHILDREN, 10);

  const attributes = {
    FIRSTNAME: String(data.FIRSTNAME).trim(),
    LASTNAME: String(data.LASTNAME).trim(),
    DOB: String(data.DOB).trim(),
    MOBILE: String(data.MOBILE).trim(),
    ADDRESS: String(data.ADDRESS).trim(),
    ADULTS: Number.isFinite(adults) && adults > 0 ? adults : 1,
    CHILDREN: Number.isFinite(children) && children >= 0 ? children : 0,
    CHILD_AGES: data.CHILD_AGES ? String(data.CHILD_AGES).trim() : "",
    OTHER_TRAVELLERS: data.OTHER_TRAVELLERS ? String(data.OTHER_TRAVELLERS).trim() : "",
    ANYTHING_ELSE: data.ANYTHING_ELSE ? String(data.ANYTHING_ELSE).trim() : "",
    DEPARTURE_AIRPORT: String(data.DEPARTURE_AIRPORT).trim(),
    DESTINATION_WANTED: String(data.DESTINATION_WANTED).trim(),
    TRAVEL_DATES: String(data.TRAVEL_DATES).trim(),
    BUDGET: String(data.BUDGET).trim(),
    DEPOSIT_READY: String(data.DEPOSIT_READY).trim(),
    TUI_2028_INTEREST: true,
  };

  const email = String(data.EMAIL).trim().toLowerCase();

  try {
    const contactRes = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        email: email,
        attributes: attributes,
        listIds: [BREVO_LIST_ID],
        updateEnabled: true,
      }),
    });

    // Brevo returns 201 for a new contact, 204 for an updated existing one.
    if (!contactRes.ok && contactRes.status !== 204) {
      const errText = await contactRes.text();
      console.error("Brevo contact create/update failed:", contactRes.status, errText);
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "Could not save your registration. Please try again or message Jake on WhatsApp." }),
      };
    }
  } catch (err) {
    console.error("Error calling Brevo contacts API:", err);
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "Could not save your registration. Please try again or message Jake on WhatsApp." }),
    };
  }

  // Contact is saved - that's the critical part. Now try to send the
  // confirmation email, but don't fail the whole request if this part
  // has a problem; the registration itself has already succeeded.
  try {
    const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        templateId: BREVO_TEMPLATE_ID,
        to: [{ email: email, name: attributes.FIRSTNAME }],
      }),
    });
    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error("Brevo transactional email failed:", emailRes.status, errText);
    }
  } catch (err) {
    console.error("Error calling Brevo transactional email API:", err);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true }),
  };
};
