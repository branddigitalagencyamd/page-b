import { Hono } from "hono";
import { requireAuth } from "../lib/middleware/require-auth";
import { getDB } from "../db/client";
import { website, user } from '../db/schema'
import { eq } from "drizzle-orm";

const websiteApi = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string; CF_PROJECT_NAME: string; CF_ACCOUNT_ID: string; CF_API_TOKEN: string; UPLOADTHING_SECRET: string; VERCEL_TOKEN: string; } }>();

websiteApi.get('/get-all', requireAuth, async (c) => {
  try {
    const authUser = c.get("user");
    const db = getDB(c.env.DB);
    const userData = await db
      .select({
        id: user.id
      })
      .from(user)
      .where(eq(user.email, authUser.email))
      .get();

    if (!userData) return c.json({ error: "Unauthorized" });

    const websites = await db.select({
      id: website.id,
      slug: website.slug,
      details: website.details
    })
      .from(website)
      .where(eq(website.owner, userData.id));

    return c.json({ websites }, 201)

  } catch (error) {
    console.error(error);
    c.json({ error: "Internal server error" }, { status: 500 });
  }
});


websiteApi.post('/create-one', requireAuth, async (c) => {
  try {
    const authUser = c.get("user");
    const db = getDB(c.env.DB);

    const userData = await db
      .select({
        id: user.id
      })
      .from(user)
      .where(eq(user.email, authUser.email))
      .get();

    if (!userData) return c.json({ error: "Unauthorized" });

    const { details, slug } = await c.req.json();

    const existingwebsite = await db
      .select({
        slug: website.slug
      })
      .from(website)
      .where(eq(website.slug, slug));

    let newSlug = "";

    if (existingwebsite.length > 0) {
      const randomDigits = Math.floor(100 + Math.random() * 900);
      newSlug = `${slug}-${randomDigits}`;
    } else {
      newSlug = slug;
    }



    const expiryDate = Date.now() + 1 * 24 * 60 * 60 * 1000;

    const [newwebsite] = await db
      .insert(website)
      .values({
        slug: newSlug,
        details: details,
        owner: userData.id,
        expiryDate: expiryDate, // timestamp in ms
        membershipType: "trial",
      })
      .returning({ id: website.id });

    if (!newwebsite) {
      return c.json({ error: "Failed to create website" }, 500);
    } else {
      return c.json(201);
    }

  } catch (error) {
    console.error(error);
    return c.json({ error: "Internal server error" }, 500);
  }
});




websiteApi.get('/check-slug/:slug', async (c) => {
  try {
    const { slug } = c.req.param();
    const db = getDB(c.env.DB);

    // Fetch website by slug
    const existingwebsite = await db
      .select({
        id: website.id,
        slug: website.slug,
        owner: website.owner,
        settings: website.settings,
        details: website.details,
        membershipType: website.membershipType,
        expiryDate: website.expiryDate
      })
      .from(website)
      .where(eq(website.slug, slug));

    if (existingwebsite.length === 0) {
      return c.json({ exists: false }, 200);
    }

    const websiteData = existingwebsite[0];


    return c.json({ exists: true, website: websiteData }, 200);
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});


// // PUT /api/website/update-any/:slug
websiteApi.put('/update-any/:slug', requireAuth, async (c) => {
  try {
    const { slug } = c.req.param();
    const db = getDB(c.env.DB);

    // Check if website exists
    const existingwebsite = await db
      .select({
        slug: website.slug
      })
      .from(website)
      .where(eq(website.slug, slug));

    if (existingwebsite.length === 0) {
      return c.json({ error: "website not found" }, 404);
    }

    // Request body contains fields to update
    const body = await c.req.json();
    const websiteData = body.website ?? body;

    // Update website (only fields provided in websiteData)
    await db
      .update(website)
      .set(websiteData)
      .where(eq(website.slug, slug));

    return c.json({
      message: "website updated successfully",
      slug
    });

  } catch (error) {
    console.error(error);
    return c.json({ error: "Internal server error" }, 500);
  }
});


websiteApi.get('/get-public-data/:slug', async (c) => {
  try {
    const { slug } = c.req.param();
    const db = getDB(c.env.DB);

    // Fetch website by slug
    const existingwebsite = await db
      .select({
        id: website.id,
        slug: website.slug,
        details: website.details,
        settings: website.settings,
        membershipType: website.membershipType,
        expiryDate: website.expiryDate
      })
      .from(website)
      .where(eq(website.slug, slug));

    if (existingwebsite.length === 0) {
      return c.json({ exists: false }, 200);
    }

    const websiteData = existingwebsite[0];


    // Build response matching websiteType
    const response = {
      id: websiteData.id,
      slug: websiteData.slug,
      details: websiteData.details ?? undefined,
      settings: websiteData.settings ?? undefined,
      membershipType: websiteData.membershipType,
      expiryDate: websiteData.expiryDate
    };

    return c.json({ exists: true, website: response }, 200);
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// websiteApi.get('/get-all-data/:slug', requireAuth, async (c) => {
//   try {
//     const { slug } = c.req.param();
//     const db = getDB(c.env.DB);

//     // Fetch website by slug
//     const existingwebsite = await db
//       .select()
//       .from(website)
//       .where(eq(website.slug, slug));

//     if (existingwebsite.length === 0) {
//       return c.json({ exists: false }, 200);
//     }

//     const websiteData = existingwebsite[0];


//     // Build response matching websiteType
//     const response = {
//       id: websiteData.id,
//       name: websiteData.name,
//       slug: websiteData.slug,
//       theme: websiteData.theme,
//       owner: websiteData.owner ?? undefined,
//       details: websiteData.details ?? undefined,
//       settings: websiteData.settings ?? undefined,
//     };

//     return c.json({ exists: true, website: response }, 200);
//   } catch (error) {
//     console.error(error);
//     return c.json({ error: 'Internal server error' }, 500);
//   }
// });





// websiteApi.get('/get-public-data/:slug', async (c) => {
//   try {
//     const { slug } = c.req.param();
//     const db = getDB(c.env.DB);

//     // Fetch website by slug
//     const existingwebsite = await db
//       .select({
//         id: website.id,
//         name: website.name,
//         slug: website.slug,
//         theme: website.theme,
//         owner: website.owner,
//         details: website.details,
//         settings: website.settings
//       })
//       .from(website)
//       .where(eq(website.slug, slug));

//     if (existingwebsite.length === 0) {
//       return c.json({ exists: false }, 200);
//     }

//     const websiteData = existingwebsite[0];


//     // Build response matching websiteType
//     const response = {
//       id: websiteData.id,
//       name: websiteData.name,
//       slug: websiteData.slug,
//       theme: websiteData.theme,
//       owner: websiteData.owner ?? undefined,
//       details: websiteData.details ?? undefined,
//       settings: websiteData.settings ?? undefined,
//     };

//     return c.json({ exists: true, website: response }, 200);
//   } catch (error) {
//     console.error(error);
//     return c.json({ error: 'Internal server error' }, 500);
//   }
// });



// websiteApi.post("/order/create-one", async (c) => {
//   try {
//     const db = getDB(c.env.DB);
//     const {
//       planId
//     } = await c.req.json();

//     const platform = await db.select().from(platformData).get();
//     const selectedPlan = await db.select().from(plans).where(eq(plans.id, planId)).get();

//     if (!selectedPlan) {
//       return c.json({ success: false, error: "Plan not found" }, { status: 404 });
//     }

//     const finalAmount = selectedPlan.price;


//     // 🟢 Razorpay enabled?
//     if (platform?.paymentType === "razorpay" && platform.razorpayKeyId && platform.razorpayKeySecret) {
//       const razorPayOrder = await createRazorpayOrder({
//         keyId: platform.razorpayKeyId,
//         keySecret: platform.razorpayKeySecret,
//         amount: finalAmount * 100,
//         receipt: `${finalAmount}-${Date.now()}`,
//       });

//       return c.json({
//         success: true,
//         razorpay: {
//           keyId: platform.razorpayKeyId,
//           razorPayOrderId: razorPayOrder.id,
//           amount: razorPayOrder.amount,
//           currency: razorPayOrder.currency,
//         },
//       });
//     }


//   } catch (error) {
//     console.error(error);
//     return c.json({ success: false, error: "Internal server error" }, { status: 500 });
//   }
// });



// websiteApi.post("/order/verify", async (c) => {
//   try {
//     const db = getDB(c.env.DB);
//     const {
//       razorpay_order_id,
//       razorpay_payment_id,
//       razorpay_signature,
//       planId,
//       userId,
//       websiteId,
//     } = await c.req.json();

//     const platform = await db.select().from(platformData).get();

//     const expected = await generateHmacSHA256(
//       platform?.razorpayKeySecret ?? "",
//       razorpay_order_id + "|" + razorpay_payment_id
//     );

//     if (expected !== razorpay_signature) {
//       return c.json({ success: false, error: "Invalid signature" }, { status: 400 });
//     }

//     // ✅ Valid payment → activate or update membership
//     const plan = await db.select().from(plans).where(eq(plans.id, planId)).get();
//     if (!plan) {
//       return c.json({ success: false, error: "Plan not found" }, { status: 404 });
//     }

//     const now = Date.now();
//     let expiry: number | null = null;

//     if (plan.type === "monthly") expiry = now + 30 * 24 * 60 * 60 * 1000;
//     else if (plan.type === "yearly") expiry = now + 365 * 24 * 60 * 60 * 1000;
//     else if (plan.type === "lifetime") expiry = now + 365 * 24 * 60 * 60 * 1000;

//     const existingMembership = await db
//       .select()
//       .from(membership)
//       .where(and(eq(membership.websiteId, websiteId), eq(membership.owner, userId)))
//       .get();

//     if (existingMembership) {
//       // 🟢 Update existing membership
//       await db
//         .update(membership)
//         .set({
//           type: plan.type === "lifetime" ? "platinum" : "basic",
//           expiryDate: expiry,
//         })
//         .where(and(eq(membership.websiteId, websiteId), eq(membership.owner, userId)));
//     } else {
//       // 🟢 Create new membership
//       await db.insert(membership).values({
//         type: plan.type === "lifetime" ? "platinum" : "basic",
//         createdAt: now,
//         expiryDate: expiry,
//         websiteId,
//         owner: userId,
//       });
//     }

//     return c.json({ success: true, message: "Membership activated or updated" });
//   } catch (err) {
//     console.error(err);
//     return c.json({ success: false, error: "Failed to verify payment" }, { status: 500 });
//   }
// });



export default websiteApi;