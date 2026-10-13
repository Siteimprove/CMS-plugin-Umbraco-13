var builder = WebApplication.CreateBuilder(args);
builder.CreateUmbracoBuilder()
    .AddBackOffice()
    .AddWebsite()
    .AddComposers()
    .Build();

// Fixture-only diagnostics: no token/cookie values or credentials are logged.
builder.Services.Configure<Umbraco.Cms.Web.Common.ApplicationBuilder.UmbracoPipelineOptions>(options =>
    options.AddFilter(new Umbraco.Cms.Web.Common.ApplicationBuilder.UmbracoPipelineFilter("BrowserPreviewDiagnostics",
        postPipeline: app => app.Use(async (context, next) =>
        {
            var path = context.Request.Path.Value ?? "";
            var trace = path.Contains("preview", StringComparison.OrdinalIgnoreCase)
                || path.Contains("first-page") || path.Contains("preview-draft");
            await next(context);
            if (trace)
            {
                var accessor = context.RequestServices.GetRequiredService<Umbraco.Cms.Core.Web.IUmbracoContextAccessor>();
                var hasContext = accessor.TryGetUmbracoContext(out var umbracoContext);
                var preview = context.RequestServices.GetRequiredService<Umbraco.Cms.Core.Services.IPreviewService>().IsInPreview();
                Console.WriteLine($"Browser preview diagnostics path={path} status={context.Response.StatusCode} type={context.Response.ContentType} encoding={context.Response.Headers.ContentEncoding} accept={context.Request.Headers.Accept} verified={preview} context={hasContext} mode={umbracoContext?.InPreviewMode} routed={umbracoContext?.PublishedRequest?.PublishedContent is not null}");
            }
        }))));

var app = builder.Build();
await app.BootUmbracoAsync();
app.UseUmbraco()
    .WithMiddleware(u => { u.UseBackOffice(); u.UseWebsite(); })
    .WithEndpoints(u => { u.UseBackOfficeEndpoints(); u.UseWebsiteEndpoints(); });
await app.RunAsync();
