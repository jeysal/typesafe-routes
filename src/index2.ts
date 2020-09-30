import { compile, parse } from "path-to-regexp";
import { stringify } from "qs";

export type ExactShape<T, Shape> =
  T extends Shape
    ? Exclude<keyof T, keyof Shape> extends never ? T : never
    : never;

export type InferPathParams<P extends string> =
  P extends `${infer A}/${infer B}` ? InferParam<A> & InferPathParams<B>
  : P extends `${infer A}&${infer B}` ? InferParam<A> & InferPathParams<B>
  : InferParam<P>
 
export type InferParam<P extends string> =
  P extends `:${infer O}?` ? Partial<Record<O, any>>
  : P extends `:${infer O}*` ? Record<O, any>
  : P extends `:${infer O}` ? Record<O, any>
  : {};

type ExtractParserTypes<P extends Record<string, Parser<any>>> = {
  [K in keyof P]: ReturnType<P[K]["parse"]>;
}

export type RouteNode<P extends string, PM extends ParserMap<P>, C extends ChildrenMap> = {
  parseParams: <K extends keyof InferPathParams<P>>(
    params: Record<K, string>,
    defaults?: Partial<ExtractParserTypes<PM>>,
  ) => ExtractParserTypes<PM>;
  path: P;
  children: C;
  parserMap: PM;
} & (
  (params: ExtractParserTypes<PM>) => {
    $: string;
    $self: RouteNode<P, PM, C>;
  } & {
    [K in keyof C]: C[K];
  }
);

type ChildrenMap = Record<string, RouteNode<any, any, any>>;

export interface Parser<T> {
  parse: (s: string) => T;
  serialize: (x: T) => string;
}
type ParserMap<T extends string> = Record<keyof InferPathParams<T>, Parser<any>>;

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

const stringifyParams = (
  parserMap: Record<string, Parser<any>>,
  params: Record<string, any>,
): Record<string, string> =>
  Object.keys(parserMap).reduce((acc, k) => ({
    ...acc,
    [k]: parserMap[k].serialize(params[k]),
  }), {});

const parsePath = (path: string, params: Record<string, string>) => {
  const [pathWithoutQuery] = path.split("&");
  const tokens = parse(pathWithoutQuery);
  const queryParams = Object.keys(params)
    .filter((k) =>
      tokens.every((t: any) => t.name && k !== t.name)
    )
    .reduce<Record<string, string>>((acc, k) => ({
      ...acc,
      [k]: params[k],
    }), {});
  return { pathWithoutQuery, queryParams };
}

// <T extends string> ensures successful literals inference (paths)
export const route = <T extends string, PM extends ParserMap<T>, C extends ChildrenMap>(
  path: T,
  parserMap: PM, //ExactShape<PM, ParserMap<T>>,
  children?: C,
  previousQueryParams: Record<string, string> = {},
): RouteNode<T, PM, C> => 
  new Proxy<any>(() => {}, {
    apply: (_, __, params: ExtractParserTypes<PM>) => {
      const stringifiedParams = {
        ...previousQueryParams,
        ...stringifyParams(parserMap, params),
      };
      const { pathWithoutQuery, queryParams } = parsePath(path, stringifiedParams);
      return routeWithParams(
        pathWithoutQuery, parserMap, stringifiedParams, children ?? {}, queryParams,
      );
    },
    get: (target, next, receiver) =>
      next === "parse" ? "parseParams(path, parser)"
      : Reflect.get(target, next, receiver)
  });

const routeWithParams = (
  path: string,
  parserMap: Record<string, Parser<any>>,
  params: Record<string, string>,
  children: ChildrenMap,
  queryParams: Record<string, string>,
) =>
  new Proxy<any>({}, {
    get: (target, next, receiver) =>
      typeof next === "symbol" ? Reflect.get(target, next,receiver)
      // full path with search query
      : next === "$" ? stringifyRoute(path, params, queryParams)
      // recursive route 
      : next === "$self" ? route(
          `${stringifyRoute(path, params)}/${path}`,
          parserMap,
          children,
          queryParams,
        )
      // child route
      : route(
        `${stringifyRoute(path, params)}/${children[next].path}`,
        children[next].parserMap,
        children[next].children,
        queryParams,
      ),
  });

const stringifyRoute = (
  path: string,
  params: Record<string, string>,
  queryParams?: Record<string, string>,
): string =>
  compile(path, {encode: encodeURIComponent})(params)
    + queryParams ? stringify(queryParams, { addQueryPrefix: true }) : "";
