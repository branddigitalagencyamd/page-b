// app/api/admin/cards/route.ts
import { Hono } from 'hono'
import { eq, desc, count, gt, lt, and, sql, or, ilike } from 'drizzle-orm'
import { getDB } from '../db/client';
import { user, platformData, plans, website } from '../db/schema';

const adminApi = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string } }>();

adminApi.get('/all-websites', async (c) => {
  try {
    const db = getDB(c.env.DB)

    // Query params
    const page = Number(c.req.query('page') ?? 1)
    const limit = Number(c.req.query('limit') ?? 5) // Changed to 5 as per frontend
    const offset = (page - 1) * limit

    /* ---------------- COUNT QUERY ---------------- */
    const totalCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(website)

    const totalItems = totalCountResult[0]?.count ?? 0
    const totalPages = Math.ceil(totalItems / limit)

    /* ---------------- MAIN QUERY ---------------- */
    const websites = await db
      .select({
        id: website.id,
        owner: website.owner,
        slug: website.slug,
        createdAt: website.createdAt,
        user: {
          id: user.id,
          email: user.email
        },
        membershipType: website.membershipType,
        expiryDate: website.expiryDate
      })
      .from(website)
      .leftJoin(user, eq(website.owner, user.id))
      .orderBy(desc(website.createdAt))
      .limit(limit)
      .offset(offset)

    return c.json(
      {
        websites,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          limit
        }
      },
      200
    )
  } catch (error) {
    console.error('Error fetching cards:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})


// PUT /api/admin/cards/:cardId/membership - Update membership for a card
adminApi.put('/websites/:websiteId/membership', async (c) => {
  try {
    const websiteId = parseInt(c.req.param('websiteId'))
    const { membershipType, expiryDate } = await c.req.json()

    if (!websiteId ||!membershipType || !expiryDate) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    const db = getDB(c.env.DB)

       await db
        .update(website)
        .set({
          membershipType: membershipType,
          expiryDate: expiryDate,
        })
        .where(eq(website.id, websiteId))

   

    return c.json({ success: true, message: 'Membership updated successfully' }, 200)
  } catch (error) {
    console.error('Error updating membership:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})


adminApi.get('/platform-data', async (c) => {
  try {
    const db = getDB(c.env.DB)

    const data = await db
      .select()
      .from(platformData)
      .limit(1)

    // If no data exists, return default structure
    if (data.length === 0) {
      const defaultData = {
        id: 0,
        paymentType: "whatsapp" as const,
        whatsapp: "",
        adminEmail: "",
        razorpayKeyId: "",
        razorpayKeySecret: "",
      }
      return c.json(defaultData, 200)
    }

    return c.json(data[0], 200)
  } catch (error) {
    console.error('Error fetching platform data:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// PUT /api/admin/platform-data - Update platform data
adminApi.put('/platform-data', async (c) => {
  try {
    const updateData = await c.req.json()

    const db = getDB(c.env.DB)

    // Check if data exists
    const existingData = await db
      .select()
      .from(platformData)
      .limit(1)

    let result;

    if (existingData.length > 0) {
      // Update existing data
      result = await db
        .update(platformData)
        .set({
          paymentType: updateData.paymentType,
          whatsapp: updateData.whatsapp,
          adminEmail: updateData.adminEmail,
          razorpayKeyId: updateData.razorpayKeyId,
          razorpayKeySecret: updateData.razorpayKeySecret,
        })
        .where(eq(platformData.id, existingData[0].id))
    } else {
      // Insert new data
      result = await db.insert(platformData).values({
        paymentType: updateData.paymentType,
        whatsapp: updateData.whatsapp,
        adminEmail: updateData.adminEmail,
        razorpayKeyId: updateData.razorpayKeyId,
        razorpayKeySecret: updateData.razorpayKeySecret,
      })
    }

    return c.json({ success: true, message: 'Platform data updated successfully' }, 200)
  } catch (error) {
    console.error('Error updating platform data:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})


// GET /api/admin/plans - Get all plans
adminApi.get('/plans', async (c) => {
  try {
    const db = getDB(c.env.DB)

    const allPlans = await db
      .select()
      .from(plans)
      .orderBy(desc(plans.createdAt))

    // Parse features from JSON string to array
    const plansWithParsedFeatures = allPlans.map(plan => ({
      ...plan,
      features: plan.features ? JSON.parse(plan.features) : []
    }))

    return c.json(plansWithParsedFeatures, 200)
  } catch (error) {
    console.error('Error fetching plans:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// POST /api/admin/plans - Create new plan
adminApi.post('/plans', async (c) => {
  try {
    const { name, description, price, originalPrice, type, features, cta, popular } = await c.req.json()

    if (!name || !description || price === undefined) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    const db = getDB(c.env.DB)

 await db.insert(plans).values({
      name,
      description,
      price,
      originalPrice: originalPrice || 0,
      type: type || 'monthly',
      features: JSON.stringify(features || []),
      cta: cta || 'Get Plan',
      popular: popular || false,
    })

    return c.json({ success: true, message: 'Plan created successfully' }, 201)
  } catch (error) {
    console.error('Error creating plan:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// PUT /api/admin/plans/:id - Update plan
adminApi.put('/plans/:id', async (c) => {
  try {
    const planId = parseInt(c.req.param('id'))
    const { name, description, price, originalPrice, type, features, cta, popular } = await c.req.json()

    if (!planId) {
      return c.json({ error: 'Plan ID is required' }, 400)
    }

    const db = getDB(c.env.DB)

    // Check if plan exists
    const existingPlan = await db
      .select()
      .from(plans)
      .where(eq(plans.id, planId))
      .limit(1)

    if (existingPlan.length === 0) {
      return c.json({ error: 'Plan not found' }, 404)
    }

    await db
      .update(plans)
      .set({
        name,
        description,
        price,
        originalPrice: originalPrice || price,
        type: type || 'monthly',
        features: JSON.stringify(features || []),
        cta: cta || 'Get Plan',
        popular: popular || false,
      })
      .where(eq(plans.id, planId))

    return c.json({ success: true, message: 'Plan updated successfully' }, 200)
  } catch (error) {
    console.error('Error updating plan:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// DELETE /api/admin/plans/:id - Delete plan
adminApi.delete('/plans/:id', async (c) => {
  try {
    const planId = parseInt(c.req.param('id'))

    if (!planId) {
      return c.json({ error: 'Plan ID is required' }, 400)
    }

    const db = getDB(c.env.DB)

    // Check if plan exists
    const existingPlan = await db
      .select()
      .from(plans)
      .where(eq(plans.id, planId))
      .limit(1)

    if (existingPlan.length === 0) {
      return c.json({ error: 'Plan not found' }, 404)
    }

    await db
      .delete(plans)
      .where(eq(plans.id, planId))

    return c.json({ success: true, message: 'Plan deleted successfully' }, 200)
  } catch (error) {
    console.error('Error deleting plan:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})


adminApi.get('/stats', async (c) => {
  try {
    const db = getDB(c.env.DB)

    // Get total users count
    const totalUsersResult = await db
      .select({ count: count() })
      .from(user)

    const totalUsers = totalUsersResult[0]?.count || 0

    // Get total cards count
    const totalWebsiteResult = await db
      .select({ count: count() })
      .from(website)

    const totalWebsites = totalWebsiteResult[0]?.count || 0




    const stats = {
      totalUsers,
      totalWebsites
    }

    return c.json(stats, 200)
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
});



adminApi.delete('/websites/:id', async (c) => {
  try {
    const websiteId = parseInt(c.req.param('id'))

    if (!websiteId) {
      return c.json({ error: 'Website ID must be a valid number' }, 400)
    }

    const db = getDB(c.env.DB)

    // Check if website exists
    const existingWebsite = await db
      .select()
      .from(website)
      .where(eq(website.id, websiteId))
      .limit(1)

    if (existingWebsite.length === 0) {
      return c.json({ error: 'Website not found' }, 404)
    }

    // Delete the website
    await db
      .delete(website)
      .where(eq(website.id, websiteId))

    return c.json({ success: true, message: 'Website deleted successfully' }, 200)
  } catch (error) {
    console.error('Error deleting website:', error) 
    return c.json({ error: 'Internal server error' }, 500)
  }
})
export default adminApi