import { Hono } from "hono";
import authApi from "./auth-route";
import websiteApi from "./website-route";
import adminApi from "./admin-route";

const allRoutes = new Hono();


allRoutes.route("/auth", authApi);
allRoutes.route("/website", websiteApi);
// allRoutes.route("/images", imagesApi);
allRoutes.route("/admin", adminApi);

export default allRoutes