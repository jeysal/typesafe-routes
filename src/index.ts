import { Key, parse, Token } from "path-to-regexp";
import { stringify } from "qs";

export type ExactProps<T, Shape, Err> =
  keyof T extends keyof Shape
    ? keyof Shape extends keyof T ? T : Err
    : Err;

export type InferParam<T extends string, M extends [string, string]> =
  T extends `:${infer O}?` ? [M[0], M[1] | O]
  : T extends `:${infer O}*` ? [M[0], M[1] | O]
  : T extends `:${infer O}+` ? [M[0] | O, M[1]]
  : T extends `:${infer O}` ? [M[0] | O, M[1]]
  : M;

export type InferPathParamGroups<P extends string> =
  P extends `${infer A}/${infer B}` ? InferParam<A, InferPathParamGroups<B>>
  : P extends `${infer A}&${infer B}` ? InferParam<A, InferPathParamGroups<B>>
  : InferParam<P, [never, never]>;
 
export type InferPathParams<
  T extends string,
  G extends InferPathParamGroups<T> = InferPathParamGroups<T>,
> = G[0] | G[1];

export type ExtractParserTypes<
  P extends Record<string, Parser<any>>,
  F extends keyof P,
> = {
  [K in F]: ReturnType<P[K]["parse"]>;
}

export type RouteNode<
  T extends string,
  PM extends ParserMap<T>,
  C extends ChildrenMap,
> = {
  parseParams: <
    R extends InferPathParamGroups<T>[0], // required param keys
    O extends InferPathParamGroups<T>[1], // optional param keys
  >(
    params: Record<R, string> & Partial<Record<O, string>>,
    defaults?: ExtractParserTypes<PM, O>,
  ) => ExtractParserTypes<PM, R> & Partial<ExtractParserTypes<PM, O>>;
  templateWithQuery: T;
  template: string;
  children: C;
  parserMap: PM;
} & (
  <
    R extends InferPathParamGroups<T>[0], // required param keys
    O extends InferPathParamGroups<T>[1], // optional param keys
  >(params: ExtractParserTypes<PM, R> & Partial<ExtractParserTypes<PM, O>>) => {
    $: string;
    $self: RouteNode<T, PM, C>;
  } & {
    [K in keyof C]: C[K];
  }
);

type ChildrenMap = Record<string, RouteNode<any, any, any>>;

export interface Parser<T> {
  parse: (s: string) => T;
  serialize: (x: T) => string;
}
type ParserMap<T extends string> = Record<InferPathParams<T>, Parser<any>>;

export const stringParser: Parser<string> = {
  parse: (s) => s,
  serialize: (s) => s,
}
export const floatParser: Parser<number> = {
  parse: (s) => parseFloat(s),
  serialize: (x) => x.toString(),
}
export const intParser: Parser<number> = {
  parse: (s) => parseInt(s),
  serialize: (x) => x.toString(),
}
export const dateParser: Parser<Date> = {
  parse: (s) => new Date(s),
  serialize: (d) => d.toISOString(),
}
export const booleanParser: Parser<boolean> = {
  parse: (s) => s === "true",
  serialize: (b) => b.toString(),
}

const isKey = (x: Token): x is Key => !!(x as Key).name;

const filterParserMap = (
  parserMap: Record<string, Parser<any>>,
  tokens: Token[],
): Record<string, Parser<any>> =>
  tokens.reduce<Record<string, Parser<any>>>((acc, t: Token) =>
    !isKey(t) ? acc : {...acc, [t.name]: parserMap[t.name]},
    {},
  );

type ParseRouteResult = ReturnType<typeof parseRoute>;
const parseRoute = (pathWithQuery: string, parserMap: Record<string, Parser<any>>) => {
  const [pathTemplate, ...queryFragments] = pathWithQuery.split("&");
  const queryTemplate = queryFragments.join("/");
  const pathTokens = parse(pathTemplate);
  const queryTokens = parse(queryTemplate);
  const pathParamParsers =  filterParserMap(parserMap, pathTokens);
  const queryParamParsers = filterParserMap(parserMap, queryTokens);
  return {
    pathTemplate,
    pathTokens,
    queryTokens,
    pathParamParsers,
    queryParamParsers,
  };
}

const stringifyParams = (
  parserMap: Record<string, Parser<any>>,
  params: Record<string, any>,
): Record<string, string> =>
  Object.keys(parserMap).reduce((acc, k) => ({
    ...acc, ...(
      params[k] ? {[k]: parserMap[k].serialize(params[k]) } : {}
    ),
  }), {});

// <T extends string> ensures successful literals inference (paths)
export const route = <
  T extends string,
  PM extends ParserMap<T>,
  C extends ChildrenMap,
>(
  templateWithQuery: T,
  parserMap: ExactProps<PM, ParserMap<T>, "parser map mismatches parameters">,
  children: C,
  previousQueryParams: Record<string, string> = {},
  previousPath = "",
): RouteNode<T, PM, C> => {
  const parsedRoute = parseRoute(templateWithQuery, parserMap);
  return new Proxy<any>(() => {}, {
    apply: (_, __, [rawParams]: [ExtractParserTypes<PM, any>]) =>
      routeWithParams(
        parsedRoute,
        parserMap,
        children,
        rawParams,
        previousQueryParams,
        previousPath,
      ),
    get: (target, next, receiver) =>
      next === "parse" ? "parseParams(path, parser)"
      : next === "templateWithQuery" ? templateWithQuery
      : next === "template" ? parsedRoute.pathTemplate
      : next === "children" ? children
      : next === "parserMap" ? parserMap
      : Reflect.get(target, next, receiver)
  });
}
const routeWithParams = (
  { pathTokens, pathTemplate, queryParamParsers, pathParamParsers }: ParseRouteResult,
  parserMap: Record<string, Parser<any>>,
  children: ChildrenMap,
  rawParams: Record<string, any>,
  previousQueryParams: Record<string, string>,
  previousPath: string,
) =>
  new Proxy<any>({}, {
    get: (target, next, receiver) => {
      const pathParams = stringifyParams(pathParamParsers, rawParams);
      const queryParams = {
        ...previousQueryParams,
        ...stringifyParams(queryParamParsers, rawParams),
      };
      return typeof next === "symbol" ? Reflect.get(target, next,receiver)
        // full path with search query
        : next === "$" ? `${previousPath}/${stringifyRoute(pathTokens, pathParams, queryParams)}`
        // recursive reference
        : next === "$self" ? route(
            pathTemplate,
            parserMap,
            children,
            queryParams,
            `${previousPath}/${stringifyRoute(pathTokens, pathParams)}`,
          )
        // child route
        : route(
          children[next].templateWithQuery,
          children[next].parserMap,
          children[next].children,
          queryParams,
          `${previousPath}/${stringifyRoute(pathTokens, pathParams)}`,
        );
    }
  });

const stringifyRoute = (
  pathTokens: Token[],
  params: Record<string, string>,
  queryParams?: Record<string, string>,
): string =>
  pathTokens.map((t) =>
    isKey(t) ? encodeURIComponent(params[t.name]) : t
  )
  .join("/") + (
    queryParams ? stringify(queryParams, { addQueryPrefix: true }) : ""
  );
