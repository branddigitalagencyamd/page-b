import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("users", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").unique().notNull(),
    password: text("password").notNull(),
    otp: text("otp"),
    createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now') * 1000)`),
});



export const website = sqliteTable("website", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    owner: integer("owner").notNull().references(() => user.id),

    slug: text("slug").notNull().unique(),
    // details
    details: text("details", { mode: "json" }),
    // settings
    settings: text("settings", { mode: "json" }),

    // membership
    membershipType: text("membership_type", { enum: ["trial", "basic", "pro", "lifetime"] }).default("trial"),
    expiryDate: integer("expiry_date"),
    createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now') * 1000)`),
});






export const platformData = sqliteTable("platform_data", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    paymentType: text("payment_type", { enum: ["whatsapp", "razorpay"] }).default("whatsapp"),
    whatsapp: text("whatsapp"),
    adminEmail: text("admin_email"),
    razorpayKeyId: text("razorpay_key_id"),
    razorpayKeySecret: text("razorpay_key_secret"),
});


export const plans = sqliteTable("plans", {
    id: integer("id").primaryKey({ autoIncrement: true }),

    name: text("name").notNull(),
    description: text("description").notNull(),

    price: integer("price").notNull().default(0),
    originalPrice: integer("original_price").default(0),

    type: text("type", {
        enum: ["monthly", "yearly", "lifetime"],
    }).notNull().default("monthly"),

    features: text("features"), // store as JSON stringified array
    cta: text("cta").default("Get Plan"),

    popular: integer("popular", { mode: "boolean" })
        .notNull()
        .default(false),

    createdAt: integer("created_at")
        .notNull()
        .default(sql`(strftime('%s','now') * 1000)`),
});  