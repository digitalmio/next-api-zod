import {
  type NextRequest,
  type NextFetchEvent,
  NextResponse,
} from "next/server";
import { headers } from "next/headers";
import { z } from "zod";

export class ApiHandlerError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const apiHandler = <
  TBody extends z.AnyZodObject,
  TQueryParam extends z.AnyZodObject,
  TSegment extends z.AnyZodObject,
  THeaders extends z.AnyZodObject
>(
  setup: {
    schema?: {
      body?: TBody;
      query?: TQueryParam;
      segment?: TSegment;
      headers?: THeaders;
    };
    preHandler?: (
      req: NextRequest,
      nfe: NextFetchEvent,
      validated: {
        body: z.infer<TBody>;
        segment: z.infer<TSegment>;
        query: z.infer<TQueryParam>;
        headers: z.infer<THeaders>;
        errors: z.ZodIssue[];
      }
    ) => void | Promise<void>;
    config?: {
      return400ValidationError: boolean;
    };
  },
  handler: (
    req: NextRequest,
    nfe: NextFetchEvent,
    validated: {
      body: z.infer<TBody>;
      segment: z.infer<TSegment>;
      query: z.infer<TQueryParam>;
      headers: z.infer<THeaders>;
      errors: z.ZodIssue[];
    }
  ) => unknown | Promise<unknown>
) => {
  const defaultConfig = {
    return400ValidationError: true,
  };

  const config = {
    ...defaultConfig,
    ...(setup.config || {}),
  };

  const validationError = (type: string, data: z.ZodIssue | undefined) =>
    NextResponse.json(
      {
        type,
        status: "validation_error",
        message: data?.message ?? "",
        path: data?.path ?? [],
      },
      {
        status: 400,
      }
    );

  const objectFromEntries = (
    // headers are IterableIterator, queryParams are URLSearchParams
    entries: IterableIterator<[string, unknown]> | URLSearchParams
  ) => {
    const obj = {} as Record<string, unknown>;
    for (const [key, val] of entries) {
      obj[key] = val;
    }
    return obj;
  };

  return async (
    req: NextRequest,
    nfe: NextFetchEvent & { params: unknown }
  ) => {
    const reqClone = req.clone() as NextRequest;

    const validated = {} as {
      body: z.infer<TBody>;
      segment: z.infer<TSegment>;
      query: z.infer<TQueryParam>;
      headers: z.infer<THeaders>;
      errors: z.ZodIssue[];
    };

    // start with empty list of errors / issues
    validated.errors = [];

    type ValidationKeys = "body" | "segment" | "query" | "headers";

    const getData = async (type: ValidationKeys) => {
      let data;

      switch (type) {
        case "body":
          try {
            data = await req.json();
          } catch (e) {
            if (config.return400ValidationError) {
              return NextResponse.json(
                {
                  type,
                  status: "error",
                  message: "Invalid JSON body provided",
                  path: [],
                },
                {
                  status: 400,
                }
              );
            } else {
              data = {};
              console.log("Invalid JSON body provided");
            }
          }
          break;

        case "segment":
          data = nfe.params;
          break;

        case "query":
          data = objectFromEntries(new URL(req.url).searchParams);
          break;

        case "headers":
          data = objectFromEntries(headers().entries());
          break;

        default:
          throw new Error("Unknown data type");
      }

      return data;
    };

    const toBeParsedList: ValidationKeys[] | null = setup.schema
      ? (Object.entries(setup.schema)
          .filter(([, val]) => !!val)
          .map(([key]) => key) as ValidationKeys[])
      : [];

    if (!!setup.schema && toBeParsedList.length > 0) {
      for (const el of toBeParsedList) {
        const data = await getData(el);
        const parsed = setup.schema[el]?.safeParse(data);

        if (parsed?.success) {
          validated[el] = parsed.data;
        } else {
          // push error list if defined
          if (parsed?.error.errors) {
            validated.errors = [...validated.errors, ...parsed?.error.errors];
          }
          // return 400 if not disabled in config
          if (config.return400ValidationError) {
            return validationError(el, parsed?.error.errors[0]);
          }
        }
      }
    }

    if (setup.preHandler) {
      try {
        await setup.preHandler(reqClone, nfe, validated);
      } catch (e) {
        if (e instanceof ApiHandlerError || e instanceof Error) {
          try {
            return NextResponse.json(JSON.parse(e.message), {
              status: e instanceof ApiHandlerError ? e.statusCode || 400 : 400,
            });
          } catch {
            return new NextResponse(e.message, {
              status: e instanceof ApiHandlerError ? e.statusCode || 400 : 400,
            });
          }
        }

        return NextResponse.json(
          {
            status: "error",
            statusCode: 400,
            message: "Pre-handler failed.",
          },
          {
            status: 400,
          }
        );
      }
    }

    // run handler
    return handler(reqClone, nfe, validated);
  };
};
