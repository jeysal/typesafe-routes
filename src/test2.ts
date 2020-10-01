import { booleanParser, InferPathParams, intParser, route, stringParser } from "./index2";

// test InferParam:
const p: InferPathParams<"test/one/:two/:three?&:ttt?&:abc?"> = null as any;

// test route fn:
const userRoute = route("user/:userId&:filter?&:limit?", {
  userId: stringParser, filter: booleanParser, limit: intParser,
}, {});
const accountRoute = route("account", {}, {});
const settingsRoute = route("settings/:settingsId", { settingsId: stringParser }, { accountRoute })
const groupRoute = route("group/:groupId&:filter&:limit&:skip", { 
  groupId: stringParser,
  filter: intParser,
  limit: intParser,
  skip: booleanParser,
}, {
  userRoute,
  settingsRoute,
});


console.log("user route:", userRoute({userId: "123", filter: true, limit: 10}).$);
console.log(
  "groupRoute:",
  groupRoute({filter: 10, limit: 10, groupId: "groupId", skip: true}).$
);
console.log(
  "groupRoute:",
  groupRoute({filter: 10, limit: 10, groupId: "groupId", skip: true})
  .settingsRoute({settingsId: "settingsId"})
  .accountRoute({})
  .$self({})
  .$self({})
  .$self({})
  .$
);
