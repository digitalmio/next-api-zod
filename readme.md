# Next API Route Zod Validator

This is a simple wrapper for API route [Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) in the new (standard now) App Router to validate user input.

# Motivation
I was looking for a simple solution to validate body, dynamic route param segments and search query params that would validate input and return type safe data or return 400 JSON error on failure.
Of course I could add that logic to every route individually, but that sound like convoluted and repetitive process.
So, once I failed to find what I was looking for, I've spent an evening and build this helper library.

# Features
- validates body (JSON)
- validates search query params
- validates dynamic route segments
- validates headers
- returns simple 400 error JSON response or returns error list in third param for you to return own response in handler or pre-handler
- offers to run pre-handler (with access to validated data), so you can re-use logic to check auth tokens etc. Simply throw error to stop execution
- returns third param to main handler with type safe validated input, an object: `{body?: {}, segment?: {}, query?: {}, headers?: {}, errors?: {}}`
- exports `ApiHandlerError` to throw on preHandler (you can also throw standard `Error`, then 400 status will be returned)

# Usage
Import validator and wrap your route. 

First param is an object (every key is optional) with 3 keys available: 
- `schema`, for schema setup with your Zod definitions (you need to provide `z.object`)
- `preHandler`, a function where you can extract logic for repetitive tasks, ie to check token etc.
- `options`, currently you can turn on/off functionality to show 400 page on any Zod error via `return400ValidationError`, this is `true` by default

Second param is your standard handler with extra 3rd param - validated, type safe input and if you set `return400ValidationError` to `false`, you'll also get Zod errors.

# Code example

``` js
// src/app/api/route/[someParam]/route.ts

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler, ApiHandlerError } from 'next-api-zod';

export const POST = apiHandler(
  {
    schema: {
      body: z.object({ someKey: z.string() }),
      segment: z.object({ someParam: z.string().max(5) }),
      query: z.object({ someQueryParam: z.string() }),
      headers: z.object({ someHeader: z.string() }),
    },
    config: {
      return400ValidationError: false,
    },
    preHandler: (req, nfe, { headers }) => {
      // here you can validate token, etc
      // throw to stop execution - handler will not run
      if (!isValidToken(headers)) {
        throw new ApiHandlerError({ msg: "some error" }, 401);
      }
    },
  },
  (req, nfe, { body, query, segment, headers }) => {
    console.log({
      body: body.someKey,
      qp: query.someQueryParam,
      segment: segment.someParam,
      headers: headers.someHeader,
    });

    return new NextResponse("OK");
  }
);
```
