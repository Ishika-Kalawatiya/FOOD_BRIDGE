import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { app } from "../src/server.js";

describe("FoodBridge Hardened API Test Suite", () => {
  let donorToken = "";
  let volunteerToken = "";
  let ngoToken = "";
  let testListingId = null;

  before(async () => {
    // Authenticate demo roles to obtain JWT tokens
    const donorRes = await request(app)
      .post("/api/users/login")
      .send({ demoRole: "donor" });
    assert.equal(donorRes.status, 200, "Donor demo login failed");
    donorToken = donorRes.body.token;

    const volunteerRes = await request(app)
      .post("/api/users/login")
      .send({ demoRole: "volunteer" });
    assert.equal(volunteerRes.status, 200, "Volunteer demo login failed");
    volunteerToken = volunteerRes.body.token;

    const ngoRes = await request(app)
      .post("/api/users/login")
      .send({ demoRole: "ngo" });
    assert.equal(ngoRes.status, 200, "NGO demo login failed");
    ngoToken = ngoRes.body.token;
  });

  test("1. System Health Check: GET /api/health", async () => {
    const res = await request(app).get("/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.status, "healthy");
    assert.ok(res.body.timestamp);
  });

  test("2. User Signup & Duplicate Email Guard: POST /api/users/signup", async () => {
    const testEmail = `newuser_${Date.now()}@foodbridge.org`;

    // Successful registration
    const signupRes = await request(app)
      .post("/api/users/signup")
      .send({
        name: "Test Partner Chef",
        email: testEmail,
        password: "securePassword123",
        role: "donor",
        org: "City Bakery",
      });
    assert.equal(signupRes.status, 201);
    assert.ok(signupRes.body.token, "Expected token in signup response");
    assert.equal(signupRes.body.user.email, testEmail);
    assert.equal(signupRes.body.user.password_hash, undefined, "password_hash must never leak");

    // Duplicate email returns 409
    const dupRes = await request(app)
      .post("/api/users/signup")
      .send({
        name: "Duplicate User",
        email: testEmail,
        password: "securePassword123",
        role: "donor",
      });
    assert.equal(dupRes.status, 409);
    assert.equal(dupRes.body.error.code, "EMAIL_EXISTS");
  });

  test("3. User Login & Password Verification: POST /api/users/login", async () => {
    // Valid login
    const validLogin = await request(app)
      .post("/api/users/login")
      .send({
        email: "donor@foodbridge.org",
        password: "password123",
      });
    assert.equal(validLogin.status, 200);
    assert.ok(validLogin.body.token);
    assert.equal(validLogin.body.user.role, "donor");

    // Invalid password returns 401
    const invalidLogin = await request(app)
      .post("/api/users/login")
      .send({
        email: "donor@foodbridge.org",
        password: "wrongPassword!",
      });
    assert.equal(invalidLogin.status, 401);
    assert.equal(invalidLogin.body.error.code, "INVALID_CREDENTIALS");
  });

  test("4. Auth Guard & Role Verification: GET /api/users/me & Safe Partners", async () => {
    // Without token returns 401
    const noToken = await request(app).get("/api/users/me");
    assert.equal(noToken.status, 401);
    assert.equal(noToken.body.error.code, "UNAUTHENTICATED");

    // With valid token returns profile
    const withToken = await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${donorToken}`);
    assert.equal(withToken.status, 200);
    assert.equal(withToken.body.user.role, "donor");

    // Safe partners endpoint returns public info only (no emails or passwords)
    const partners = await request(app).get("/api/users/partners");
    assert.equal(partners.status, 200);
    assert.ok(Array.isArray(partners.body.data));
    if (partners.body.data.length > 0) {
      assert.equal(partners.body.data[0].email, undefined);
      assert.equal(partners.body.data[0].password_hash, undefined);
    }
  });

  test("5. Role Enforcement: Volunteers cannot create listings", async () => {
    const res = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${volunteerToken}`)
      .send({
        title: "Unauthorized Food Listing",
        meals: 20,
        pickupAddress: "Main Gate",
        expiresInMinutes: 60,
      });
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, "UNAUTHORIZED");
  });

  test("6. Listing Creation & Owner Cancellation", async () => {
    // Donor creates listing
    const createRes = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${donorToken}`)
      .send({
        title: "30 Servings Fresh Salad & Bread",
        meals: 30,
        pickupAddress: "Dining Hall B Loading Bay",
        notes: "Kept chilled, ready now.",
        expiresInMinutes: 120,
      });
    assert.equal(createRes.status, 201);
    const listing = createRes.body;
    assert.equal(listing.status, "available");
    assert.equal(listing.meals, 30);

    // Volunteer tries to cancel -> 403
    const badCancel = await request(app)
      .post(`/api/listings/${listing.id}/cancel`)
      .set("Authorization", `Bearer ${volunteerToken}`);
    assert.equal(badCancel.status, 403);

    // Donor cancels own listing -> 200
    const cancelRes = await request(app)
      .post(`/api/listings/${listing.id}/cancel`)
      .set("Authorization", `Bearer ${donorToken}`);
    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.body.status, "cancelled");
  });

  test("7. Concurrency & Race Condition Guard: 10 concurrent claim requests", async () => {
    // Step 1: Donor creates a fresh listing for race test
    const createRes = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${donorToken}`)
      .send({
        title: "Hot Soup & Rice for 45 people",
        meals: 45,
        pickupAddress: "Campus Center East",
        dropoffAddress: "Hope Shelter, North Campus",
        pickupLatitude: 12.9716,
        pickupLongitude: 77.5946,
        dropoffLatitude: 12.9816,
        dropoffLongitude: 77.6046,
        ngoId: 3,
        expiresInMinutes: 90,
      });
    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.donor.phone, "+91 98765 43210");
    assert.equal(createRes.body.ngo.phone, "+91 98765 43212");
    assert.equal(createRes.body.volunteer, null);
    testListingId = createRes.body.id;

    // Step 2: Fire 10 concurrent claim requests simultaneously
    const claimPromises = Array.from({ length: 10 }, () =>
      request(app)
        .post(`/api/listings/${testListingId}/claim`)
        .set("Authorization", `Bearer ${volunteerToken}`)
    );

    const responses = await Promise.all(claimPromises);

    // Step 3: Verify atomic locking guarantees exactly 1 winner (200) and 9 conflicts (409)
    const successCount = responses.filter((r) => r.status === 200).length;
    const conflictCount = responses.filter((r) => r.status === 409).length;

    assert.equal(successCount, 1, `Expected exactly 1 claim success, got ${successCount}`);
    assert.equal(conflictCount, 9, `Expected exactly 9 claim conflicts (409), got ${conflictCount}`);
    const claimedByVolunteer = responses.find((response) => response.status === 200);
    assert.equal(claimedByVolunteer.body.volunteer.phone, "+91 98765 43211");

    const anonymousListings = await request(app).get("/api/listings");
    const publicListing = anonymousListings.body.data.find((item) => item.id === testListingId);
    assert.equal(publicListing.donor.phone, null);
    assert.equal(publicListing.ngo.phone, null);
  });

  test("8. Full Food Rescue Pipeline: Accept -> Pickup -> Delivery -> Distribute", async () => {
    // Current status is 'accepted' from the race test winner
    // Attempting to distribute before collection fails with 409
    const earlyDistribute = await request(app)
      .post(`/api/listings/${testListingId}/distribute`)
      .set("Authorization", `Bearer ${ngoToken}`);
    assert.equal(earlyDistribute.status, 409);

    // GPS arrival geofence advances the order to Arrived at Pickup.
    const arrivalRes = await request(app)
      .post(`/api/listings/${testListingId}/location`)
      .set("Authorization", `Bearer ${volunteerToken}`)
      .send({ latitude: 12.9716, longitude: 77.5946 });
    assert.equal(arrivalRes.status, 200);
    assert.equal(arrivalRes.body.status, "arrived_at_pickup");

    // Volunteer confirms pickup, then starts the delivery leg.
    const collectRes = await request(app)
      .post(`/api/listings/${testListingId}/collect`)
      .set("Authorization", `Bearer ${volunteerToken}`);
    assert.equal(collectRes.status, 200);
    assert.equal(collectRes.body.status, "picked_up");

    const startRes = await request(app)
      .post(`/api/listings/${testListingId}/start-delivery`)
      .set("Authorization", `Bearer ${volunteerToken}`);
    assert.equal(startRes.status, 200);
    assert.equal(startRes.body.status, "out_for_delivery");

    const locationRes = await request(app)
      .post(`/api/listings/${testListingId}/location`)
      .set("Authorization", `Bearer ${volunteerToken}`)
      .send({ latitude: 12.9816, longitude: 77.6046 });
    assert.equal(locationRes.status, 200);
    assert.equal(locationRes.body.status, "arrived_at_dropoff");

    const trackingRes = await request(app)
      .get("/api/tracking")
      .set("Authorization", `Bearer ${donorToken}`);
    assert.equal(trackingRes.status, 200);
    assert.ok(trackingRes.body.data.some((delivery) => delivery.id === testListingId && delivery.status === "arrived_at_dropoff"));

    const deliveredRes = await request(app)
      .post(`/api/listings/${testListingId}/deliver`)
      .set("Authorization", `Bearer ${volunteerToken}`);
    assert.equal(deliveredRes.status, 200);
    assert.equal(deliveredRes.body.status, "delivered");

    const unauthenticatedTracking = await request(app).get("/api/tracking");
    assert.equal(unauthenticatedTracking.status, 401);

    // NGO distributes food
    const distributeRes = await request(app)
      .post(`/api/listings/${testListingId}/distribute`)
      .set("Authorization", `Bearer ${ngoToken}`);
    assert.equal(distributeRes.status, 200);
    assert.equal(distributeRes.body.status, "distributed");
  });

  test("9. Lantern certificates require completed service and can be verified", async () => {
    const unauthenticated = await request(app)
      .post("/api/certificates")
      .send({ name: "Campus Canteen Manager", lanternId: "hope" });
    assert.equal(unauthenticated.status, 401);

    const mismatchedName = await request(app)
      .post("/api/certificates")
      .set("Authorization", `Bearer ${donorToken}`)
      .send({ name: "Another Person", lanternId: "hope" });
    assert.equal(mismatchedName.status, 422);

    const issue = (token, name, lanternId) =>
      request(app)
        .post("/api/certificates")
        .set("Authorization", `Bearer ${token}`)
        .send({ name, lanternId });

    const donorCertificate = await issue(donorToken, "Campus Canteen Manager", "hope");
    assert.equal(donorCertificate.status, 201);
    assert.equal(donorCertificate.body.verified, true);
    assert.equal(donorCertificate.body.certificate.role, "donor");
    assert.equal(donorCertificate.body.certificate.meals, 45);

    const repeatedIssue = await issue(donorToken, "Campus Canteen Manager", "hope");
    assert.equal(repeatedIssue.body.certificate.id, donorCertificate.body.certificate.id);

    const verification = await request(app).get(`/api/certificates/${donorCertificate.body.certificate.id}`);
    assert.equal(verification.status, 200);
    assert.equal(verification.body.verified, true);
    assert.equal(verification.body.certificate.name, "Campus Canteen Manager");

    const volunteerCertificate = await issue(volunteerToken, "Courier Alex", "kindness");
    assert.equal(volunteerCertificate.status, 201);
    assert.equal(volunteerCertificate.body.certificate.role, "volunteer");

    const ngoCertificate = await issue(ngoToken, "Hope Shelter Staff", "community");
    assert.equal(ngoCertificate.status, 201);
    assert.equal(ngoCertificate.body.certificate.role, "ngo");
  });

  test("10. Delivery partner can confirm delivery manually", async () => {
    const createRes = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${donorToken}`)
      .send({
        title: "Manual delivery confirmation batch",
        meals: 8,
        pickupAddress: "North campus kitchen",
        dropoffAddress: "Community shelter entrance",
        expiresInMinutes: 90,
      });
    assert.equal(createRes.status, 201);

    const claimRes = await request(app)
      .post(`/api/listings/${createRes.body.id}/claim`)
      .set("Authorization", `Bearer ${volunteerToken}`);
    assert.equal(claimRes.status, 200);

    const arrivalRes = await request(app)
      .post(`/api/listings/${createRes.body.id}/arrive`)
      .set("Authorization", `Bearer ${volunteerToken}`);
    assert.equal(arrivalRes.status, 200);

    const collectRes = await request(app)
      .post(`/api/listings/${createRes.body.id}/collect`)
      .set("Authorization", `Bearer ${volunteerToken}`);
    assert.equal(collectRes.status, 200);

    const startRes = await request(app)
      .post(`/api/listings/${createRes.body.id}/start-delivery`)
      .set("Authorization", `Bearer ${volunteerToken}`);
    assert.equal(startRes.status, 200);

    const deliveredRes = await request(app)
      .post(`/api/listings/${createRes.body.id}/deliver`)
      .set("Authorization", `Bearer ${volunteerToken}`);
    assert.equal(deliveredRes.status, 200);
    assert.equal(deliveredRes.body.status, "delivered");
  });

  test("11. GPS geofences require the 40-meter arrival radius", async () => {
    const createRes = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${donorToken}`)
      .send({
        title: "GPS geofence test batch",
        meals: 4,
        pickupAddress: "North campus kitchen",
        dropoffAddress: "Community shelter entrance",
        pickupLatitude: 12.9716,
        pickupLongitude: 77.5946,
        dropoffLatitude: 12.9816,
        dropoffLongitude: 77.6046,
        expiresInMinutes: 90,
      });
    const id = createRes.body.id;
    await request(app).post(`/api/listings/${id}/claim`).set("Authorization", `Bearer ${volunteerToken}`);

    const outsidePickupFence = await request(app)
      .post(`/api/listings/${id}/location`)
      .set("Authorization", `Bearer ${volunteerToken}`)
      .send({ latitude: 12.972, longitude: 77.5946 });
    assert.equal(outsidePickupFence.body.status, "accepted");

    const atPickup = await request(app)
      .post(`/api/listings/${id}/location`)
      .set("Authorization", `Bearer ${volunteerToken}`)
      .send({ latitude: 12.9716, longitude: 77.5946 });
    assert.equal(atPickup.body.status, "arrived_at_pickup");

    await request(app).post(`/api/listings/${id}/collect`).set("Authorization", `Bearer ${volunteerToken}`);
    await request(app).post(`/api/listings/${id}/start-delivery`).set("Authorization", `Bearer ${volunteerToken}`);

    const outsideDropoffFence = await request(app)
      .post(`/api/listings/${id}/location`)
      .set("Authorization", `Bearer ${volunteerToken}`)
      .send({ latitude: 12.982, longitude: 77.6046 });
    assert.equal(outsideDropoffFence.body.status, "out_for_delivery");

    const atDropoff = await request(app)
      .post(`/api/listings/${id}/location`)
      .set("Authorization", `Bearer ${volunteerToken}`)
      .send({ latitude: 12.9816, longitude: 77.6046 });
    assert.equal(atDropoff.body.status, "arrived_at_dropoff");

    const delivered = await request(app)
      .post(`/api/listings/${id}/deliver`)
      .set("Authorization", `Bearer ${volunteerToken}`);
    assert.equal(delivered.body.status, "delivered");
  });

  test("12. Map routing defaults to OSRM and requires public-coordinate consent", async () => {
    const previousUrl = process.env.OSRM_BASE_URL;
    const previousFetch = global.fetch;
    delete process.env.OSRM_BASE_URL;
    let requestedUrl = null;
    global.fetch = async (input) => {
      requestedUrl = new URL(input);
      return {
        ok: true,
        json: async () => ({
          routes: [{
            geometry: { coordinates: [[77.59, 12.97], [77.6, 12.98]] },
            distance: 1500,
            duration: 420,
            legs: [{
              distance: 1500,
              duration: 420,
              steps: [{ name: "Main Road", distance: 1500, duration: 420, maneuver: { type: "depart" } }],
            }],
          }],
        }),
      };
    };
    try {
      const payload = { coordinates: [{ latitude: 12.97, longitude: 77.59 }, { latitude: 12.98, longitude: 77.6 }] };
      const blocked = await request(app)
        .post("/api/map/route")
        .set("Authorization", `Bearer ${volunteerToken}`)
        .send(payload);
      assert.equal(blocked.status, 428);
      assert.equal(blocked.body.error.code, "ROUTING_CONSENT_REQUIRED");
      assert.equal(requestedUrl, null, "must not send coordinates without consent");

      const response = await request(app)
        .post("/api/map/route")
        .set("Authorization", `Bearer ${volunteerToken}`)
        .set("X-Location-Routing-Consent", "public-osrm-v1")
        .send(payload);
      assert.equal(response.status, 200);
      assert.equal(requestedUrl.hostname, "router.project-osrm.org");
      assert.equal(response.body.route.distance, 1500);
      assert.equal(response.body.route.duration, 420);
      assert.equal(response.body.route.steps[0].name, "Main Road");
    } finally {
      if (previousUrl === undefined) delete process.env.OSRM_BASE_URL;
      else process.env.OSRM_BASE_URL = previousUrl;
      global.fetch = previousFetch;
    }
  });

  test("13. Impact Metrics & Canonical Formula Verification", async () => {
    const summary = await request(app).get("/api/impact/summary");
    assert.equal(summary.status, 200);
    assert.ok(typeof summary.body.mealsDiverted === "number");
    assert.ok(typeof summary.body.wasteKg === "number");
    assert.ok(typeof summary.body.co2eKg === "number");

    // Environmental math verification (0.4 kg/meal and 2.5 kg CO2e/kg waste)
    const expectedWaste = Math.round(summary.body.mealsDiverted * 0.4 * 10) / 10;
    const expectedCo2e = Math.round(expectedWaste * 2.5 * 10) / 10;
    assert.equal(summary.body.wasteKg, expectedWaste);
    assert.equal(summary.body.co2eKg, expectedCo2e);
  });

  test("14. Community Physical Audit: Bulk Sync & Duplicate Handling", async () => {
    const sampleRows = [
      {
        audit_date: "2026-11-20",
        location: "Green Valley Dining Hall",
        volunteer: "Courier Alex",
        food_type: "Prepared Meals",
        weight_kg: 18.5,
        meals_served: 45,
        notes: "Direct handover verified",
      },
      {
        audit_date: "2026-11-21",
        location: "Faculty Club West",
        volunteer: "Courier Alex",
        food_type: "Sandwiches",
        weight_kg: 12.0,
        meals_served: 30,
        notes: "All sealed and fresh",
      },
    ];

    // Unauthorized without key
    const noKey = await request(app).post("/api/audits/bulk").send({ rows: sampleRows });
    assert.equal(noKey.status, 401);

    // Initial bulk insert with valid key
    const firstSync = await request(app)
      .post("/api/audits/bulk")
      .set("x-api-key", "foodbridge-secret-key-2026")
      .send({ rows: sampleRows });
    assert.equal(firstSync.status, 200);
    assert.equal(firstSync.body.inserted, 2);

    // Resyncing identical rows gracefully skips duplicates (ON CONFLICT DO NOTHING)
    const secondSync = await request(app)
      .post("/api/audits/bulk")
      .set("x-api-key", "foodbridge-secret-key-2026")
      .send({ rows: sampleRows });
    assert.equal(secondSync.status, 200);
    assert.equal(secondSync.body.inserted, 0, "Duplicate rows should be skipped");
    assert.equal(secondSync.body.totalProcessed, 2);
  });

  test("15. Side Game Scores: Isolation from real meal totals", async () => {
    // Record initial platform meals
    const beforeImpact = await request(app).get("/api/impact/summary");
    const platformMealsBefore = beforeImpact.body.mealsDiverted;

    // Submit a game score
    const gameRes = await request(app)
      .post("/api/scores")
      .send({
        playerName: "SpeedyPlayer",
        points: 450,
        itemsSaved: 20,
        itemsWasted: 2,
      });
    assert.equal(gameRes.status, 201);
    assert.ok(gameRes.body.estimatedMeals > 0);

    // Query game impact endpoint
    const gameImpact = await request(app).get("/api/scores/impact");
    assert.equal(gameImpact.status, 200);
    assert.ok(gameImpact.body.gamesPlayed >= 1);

    // Confirm real platform meal total was NOT affected by game scores
    const afterImpact = await request(app).get("/api/impact/summary");
    assert.equal(afterImpact.body.mealsDiverted, platformMealsBefore, "Game score must NOT count towards platform meals");
  });
});
