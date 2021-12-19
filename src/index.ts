import {Connection, ConnectionArguments, PageInfo} from 'graphql-relay';
import {PrismaClient} from '@prisma/client';

export const cursorGenerator = (type: string, id: string): string => {
  return Buffer.from(`${type}:${id}`).toString('base64');
};

export const cursorDecoder = (cursor: string): string => {
  const decoded = Buffer.from(cursor, 'base64').toString();
  const parts = decoded.split(':');

  return parts[1];
};

function resolveTake(
  first: number | null | undefined,
  last: number | null | undefined,
): number | undefined {
  if (first && last) {
    throw new Error("first and last can't be set simultaneously");
  }

  if (first) {
    if (first < 0) {
      throw new Error("first can't be negative");
    }

    // To get to know whether more nodes are
    return first + 1;
  }

  if (last) {
    if (last < 0) {
      throw new Error("last can't be negative");
    }

    if (last === 0) {
      return 0;
    }

    return last * -1;
  }

  return undefined;
}

function resolveCursor(
  before: string | null | undefined,
  after: string | null | undefined,
): {id: string} | undefined {
  if (before && after) {
    throw new Error("before and after can't be set simultaneously");
  }

  if (before) {
    const decoded = cursorDecoder(before);

    return {id: decoded};
  }

  if (after) {
    const decoded = cursorDecoder(after);

    return {id: decoded};
  }

  return undefined;
}

function resolveSkip(cursor: {id: string} | null | undefined): 1 | undefined {
  if (cursor) {
    return 1;
  }

  return undefined;
}

export function resolveArgs(args: ConnectionArguments): {
  cursor?: {id: string};
  take?: number;
  skip?: number;
} {
  const {first, last, before, after} = args;

  // If no pagination set, don't touch the args
  if (!first && !last && !before && !after) {
    return {};
  }

  /**
   * This is currently only possible with js transformation on the result. eg:
   * after: 1, last: 1
   * ({
   *   cursor: { id: $before },
   *   take: Number.MAX_SAFE_INTEGER,
   *   skip: 1
   * }).slice(length - $last, length)
   */
  if (after && last) {
    throw new Error("after and last can't be set simultaneously");
  }

  /**
   * This is currently only possible with js transformation on the result. eg:
   * before: 4, first: 1
   * ({
   *   cursor: { id: $before },
   *   take: Number.MIN_SAFE_INTEGER,
   *   skip: 1
   * }).slice(0, $first)
   */
  if (before && first) {
    throw new Error("before and first can't be set simultaneously");
  }

  // Edge-case: simulates a single `before` with a hack
  if (before && !first && !last && !after) {
    return {
      cursor: {id: before},
      skip: 1,
      take: Number.MIN_SAFE_INTEGER,
    };
  }

  const take = resolveTake(first, last);
  const cursor = resolveCursor(before, after);
  const skip = resolveSkip(cursor);

  const newArgs = {
    take,
    cursor,
    skip,
  };

  return newArgs;
}

export async function relayPagination({
  prisma,
  args,
  type,
}: {
  prisma: PrismaClient;
  args: ConnectionArguments;
  type: string;
}): Promise<Connection<{id: string}>> {
  const resolved = resolveArgs(args);

  const nodes = await prisma[type].findMany({
    ...resolved,
  });

  const hasPreviousPage = !!args.after;
  const hasNextPage = !!args.first && nodes.length > args.first;

  if (hasNextPage) {
    // Pop last node since We added one to first args in resolveTake
    nodes.pop();
  }

  const edges = nodes.map((node) => ({
    cursor: cursorGenerator('artist', node.id),
    node,
  }));

  const pageInfo: PageInfo = {
    hasNextPage,
    hasPreviousPage,
    startCursor: edges.length > 0 ? edges[0].cursor : null,
    endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
  };

  return {
    edges,
    pageInfo,
  };
}
