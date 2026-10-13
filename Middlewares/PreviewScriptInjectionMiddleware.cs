using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using Siteimprove.Umbraco17.Plugin.Services;
using Umbraco.Cms.Core.Configuration;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Web;

namespace Siteimprove.Umbraco17.Plugin.Middlewares;

public sealed class PreviewScriptInjectionMiddleware(RequestDelegate next)
{
    // Resolve scoped services per request, rather than in the middleware constructor.
    public async Task InvokeAsync(HttpContext context, IPreviewService previewService,
        IUmbracoContextAccessor contextAccessor, ISiteimprovePublicUrlService publicUrlService,
        IUmbracoVersion umbracoVersion, IOptions<SiteimproveOptions> options)
    {
        if (!options.Value.EnablePreviewChecks || !HttpMethods.IsGet(context.Request.Method)
            || !context.Request.Headers.Accept.Any(v => v?.Contains("text/html", StringComparison.OrdinalIgnoreCase) == true)
            || !previewService.IsInPreview())
        {
            await next(context);
            return;
        }

        var original = context.Response.Body;
        await using var buffer = new MemoryStream();
        context.Response.Body = buffer;
        try
        {
            await next(context);
            if (context.Response.StatusCode == StatusCodes.Status200OK
                && IsUtf8Html(context.Response.ContentType)
                && !context.Response.Headers.ContainsKey("Content-Encoding")
                && contextAccessor.TryGetUmbracoContext(out var umbracoContext)
                && umbracoContext.InPreviewMode
                && umbracoContext.PublishedRequest?.PublishedContent is { } content)
            {
                buffer.Position = 0;
                using var reader = new StreamReader(buffer, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, bufferSize: 1024, leaveOpen: true);
                var html = await reader.ReadToEndAsync(context.RequestAborted);
                var pageUrl = publicUrlService.GetPageUrl(content, umbracoContext.PublishedRequest.Culture);
                var modified = PreviewHtmlInjector.Inject(html, context.Request.PathBase.Value ?? "", pageUrl,
                    umbracoVersion.Version.ToString());
                if (modified != html)
                {
                    var bytes = Encoding.UTF8.GetBytes(modified);
                    context.Response.ContentLength = bytes.Length;
                    context.Response.Headers.Remove("ETag");
                    context.Response.Headers.Remove("Content-MD5");
                    context.Response.Headers.CacheControl = "no-store";
                    await original.WriteAsync(bytes, context.RequestAborted);
                    return;
                }
            }
            buffer.Position = 0;
            await buffer.CopyToAsync(original, context.RequestAborted);
        }
        finally
        {
            context.Response.Body = original;
        }
    }

    private static bool IsUtf8Html(string? contentType)
    {
        if (contentType is null) return false;
        var parts = contentType.Split(';', StringSplitOptions.TrimEntries);
        return parts[0].Equals("text/html", StringComparison.OrdinalIgnoreCase)
            && parts.Skip(1).Where(p => p.StartsWith("charset=", StringComparison.OrdinalIgnoreCase))
                .All(p => p[8..].Trim('"').Equals("utf-8", StringComparison.OrdinalIgnoreCase));
    }
}

