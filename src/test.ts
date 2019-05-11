import * as test from "tape";
import { routeFactory } from ".";

export interface IRoute {
  "": {},
  dashboard: {
    settings: {}
    apps: {
      [appId: string]: {
        users: {
          [userId: string] : {
            settings: {}
          }
        }
      }
    }
  }
}

const baseUrl = "https://localhost:8080";
const appId = 5;
const userId = "5ab8f42e618b623ca0f25533";

test("#routeFactory should build empty route", (t) => {
  t.plan(3);

  t.equal(routeFactory<IRoute>()("").str(), "/");
  
  t.equal(routeFactory<IRoute>("#")("").str(), "#/");

  t.equal(routeFactory<IRoute>(baseUrl)("").str(), "https://localhost:8080/");
});

test("#routeBuilder should build absolute routes", (t) => {
  t.plan(2);

  const route = routeFactory<IRoute>(baseUrl);
  const appRoute = route("dashboard")("apps")(appId);
  const appPath: string = appRoute.str();

  t.equal(
    appPath,
    "https://localhost:8080/dashboard/apps/5",
    "should render app route",
  );

  const userSettingsPath: string = appRoute("users")(userId)("settings").str();

  t.equal(
    userSettingsPath,
    "https://localhost:8080/dashboard/apps/5/users/5ab8f42e618b623ca0f25533/settings",
    "should render userSettingsRoute",
  );
});

test("#routeBuilder should build relative routes", (t) => {
  t.plan(1);
  type IAppsRoute = IRoute["dashboard"]["apps"][""];
  const appsRoute = routeFactory<IAppsRoute>();
  const relativeRoute = appsRoute("users")(userId)("settings");
  const relativePath: string = relativeRoute.str();

  t.equal(
    relativePath,
    "/users/5ab8f42e618b623ca0f25533/settings",
    "should render relative route",
  );
});
