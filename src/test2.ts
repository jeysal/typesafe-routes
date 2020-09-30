import { booleanParser, InferPathParams, intParser, route, stringParser } from "./index2";

 
// test InferParam:
const p: InferPathParams<"test/one/:two/:three?&:ttt?&:abc?"> = null as any;

// test route fn:
const userRoute = route("user/:userId", { userId: stringParser });
const accountRoute = route("account", {});
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

// const params = groupRoute.parseParams({filter: "", groupId: "", limit: "", skip: ""});
// params.filter.toFixed(2);
// params.groupId.toUpperCase();
// params.limit.toExponential(2);
// params.skip === true;

console.log(groupRoute);

console.log(groupRoute({filter: 1, skip: true, limit: 1, groupId: ""})
  .settingsRoute({settingsId: ""})
  .$self({settingsId: ""})
  .$self({settingsId: ""})
  .$self({settingsId: ""})
  .$self({settingsId: ""})
  .$self({settingsId: ""})
  .$self({settingsId: ""})
  .accountRoute({})
  .$);

groupRoute({filter: 1, skip: true, limit: 1, groupId: ""})
  .$self({filter: 2, skip: false, limit: 4, groupId: ""})
  .$self({filter: 2, skip: false, limit: 4, groupId: ""})
  .$self({filter: 2, skip: false, limit: 4, groupId: ""})
  .$self({filter: 2, skip: false, limit: 4, groupId: ""})
  .userRoute({userId: ""})
  .$;