# Next API Route Zod Validator

This is a simple wrapper for API route [Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) in the new (standard now) App Router to validate user input.

# Motivation
I was looking for a simple solution to validate body, dynamic route param segments and search query params that would validate input and return type safe data or return 400 JSON error on failure.
Of course I could add that logic to every route individually, but that sound like convoluted and repetitive process.
So, once I failed to find what I was looking for, I've spent an evening and build this helper library.

# Features
- validates body (JSON)
- validates search query params (arrays are not supported at the moment, maybe in the future, don't need them now)
- validate dynamic route param segments
- returns third param to handler with type safe validated input, an object: `{body: {}, params: {}, queryParams: {}}` 

# Usage
Import validator and wrap your route. 

First param is an object (every key is optional) with your Zod definitions (you need to provide `z.object`), second param is your standard handler with extra 3rd param - validated, type safe input.

```
// src/app/api/route/[someParam]/route.ts

import { NextResponse } from 'next/server';
import { z } from 'zod';
import apiZodValidator from 'next-api-zod';

export const POST = apiZodValidator(
  {
    body: z.object({ someKey: z.string() }),
    params: z.object({ someParam: z.string().max(5) }),
    queryParams: z.object({ someQueryParam: z.string() }),
  },
  (req, nfe, { body, queryParams, params }) => {
    console.log({ body: body.someKey, qp: queryParams.someQueryParam, params: params.someParam });

    return NextResponse.json('OK');
  },
);
```