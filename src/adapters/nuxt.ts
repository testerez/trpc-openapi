import { TRPCError } from '@trpc/server';
import {
  NodeIncomingMessage,
  NodeServerResponse,
  createError,
  defineEventHandler,
  getQuery,
  sendError,
} from 'h3';

import { OpenApiErrorResponse, OpenApiRouter } from '../types';
import { normalizePath } from '../utils/path';
import {
  CreateOpenApiNodeHttpHandlerOptions,
  createOpenApiNodeHttpHandler,
} from './node-http/core';

export type CreateOpenApiNuxtHandlerOptions<TRouter extends OpenApiRouter> =
  CreateOpenApiNodeHttpHandlerOptions<TRouter, NodeIncomingMessage, NodeServerResponse>;

export const createOpenApiNuxtHandler = <TRouter extends OpenApiRouter>(
  opts: CreateOpenApiNuxtHandlerOptions<TRouter>,
) => {
  return defineEventHandler(async (event) => {
    const context = event.context as Context;
    const pathname = context.params?.trpc;
    if (pathname === null || pathname === undefined) {
      const error = new TRPCError({
        message: 'Query "trpc" not found - is the `trpc-openapi` file named `[...trpc].ts`?',
        code: 'INTERNAL_SERVER_ERROR',
      });

      opts.onError?.({
        error,
        type: 'unknown',
        path: undefined,
        input: undefined,
        ctx: undefined,
        req: event.node.req,
      });

      event.node.res.statusCode = 500;
      event.node.res.setHeader('Content-Type', 'application/json');
      const body: OpenApiErrorResponse = {
        message: error.message,
        code: error.code,
      };
      event.node.res.end(JSON.stringify(body));
      return;
    }
    const nuxtReq: NuxtIncomingMessage = event.node.req;
    nuxtReq.query = getQuery(event);
    nuxtReq.url = normalizePath(pathname);

    const openApiHttpHandler = createOpenApiNodeHttpHandler(opts);

    await openApiHttpHandler(nuxtReq, event.node.res);
  });
};

interface Context {
  params?: {
    trpc?: string | null;
  };
}

interface NuxtIncomingMessage extends NodeIncomingMessage {
  query?: unknown;
}
