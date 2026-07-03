import { request } from "../client.js";
import { UsersActivitySchema, type UsersActivity } from "../schemas.js";

/** Site-wide user activity (any signed-in user). */
export function getActivityAll(): Promise<UsersActivity> {
  return request({
    method: "GET",
    path: "/dashboard/users/activity/",
    schema: UsersActivitySchema,
    auth: true
  });
}

/** Current user's activity. */
export function getActivityCurrent(): Promise<UsersActivity> {
  return request({
    method: "GET",
    path: "/dashboard/users/activity/current/",
    schema: UsersActivitySchema,
    auth: true
  });
}